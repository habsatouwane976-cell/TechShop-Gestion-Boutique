"""Vues pour la gestion des ventes et génération de factures PDF"""
from .emails import send_sale_email
import logging
from io import BytesIO
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import APIException, PermissionDenied
from django.db import transaction
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from .models import Sale, SaleItem
from apps.notifications.models import Notification
from apps.users.models import User

from .serializers import SaleSerializer, CreateSaleSerializer
from .payments import ONLINE_PAYMENT_METHODS, process_online_payment
from apps.products.models import Product
from apps.inventory.models import StockMovement
from apps.notifications.utils import send_low_stock_alert, send_out_of_stock_alert
from apps.users.views import log_activity, get_client_ip

logger = logging.getLogger('apps')


class OrderError(APIException):
    """Erreur métier (400) levée dans la transaction : elle annule tout (stock inclus)."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = 'order_error'

    def __init__(self, message):
        super().__init__({'error': message})


def generate_sale_pdf(sale):
    """Génère le PDF de la facture avec ReportLab"""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )
    styles = getSampleStyleSheet()
    blue = colors.HexColor('#1d4ed8')
    light_blue = colors.HexColor('#eff6ff')
    gray = colors.HexColor('#6b7280')
    dark = colors.HexColor('#111827')

    story = []

    # En-tête
    story.append(Paragraph(
        "TechShop Electronics",
        ParagraphStyle('Title', parent=styles['Title'],
                       fontSize=22, textColor=blue, spaceAfter=4)
    ))
    story.append(Paragraph(
        "Votre partenaire de gestion commerciale - Dakar, Sénégal",
        ParagraphStyle('Sub', parent=styles['Normal'],
                       fontSize=10, textColor=gray)
    ))
    story.append(Spacer(1, 0.4*cm))
    story.append(HRFlowable(width="100%", thickness=2, color=blue))
    story.append(Spacer(1, 0.4*cm))

    # Infos facture
    info_data = [
        [
            Paragraph(f"<b>FACTURE N° {sale.invoice_number}</b>",
                      ParagraphStyle('', parent=styles['Normal'],
                                     fontSize=16, textColor=blue)),
            Paragraph(
                f"Date: {sale.created_at.strftime('%d/%m/%Y %H:%M')}<br/>Caissier: {sale.cashier.get_full_name() if sale.cashier else '-'}<br/>Paiement: {sale.get_payment_method_display()}",
                ParagraphStyle('R', parent=styles['Normal'],
                               fontSize=10, alignment=TA_RIGHT)
            )
        ]
    ]
    t = Table(info_data, colWidths=['60%', '40%'])
    story.append(t)
    story.append(Spacer(1, 0.4*cm))

    # Client
    if sale.customer:
        client_data = [
            ['CLIENT', ''],
            [f"Nom: {sale.customer.name}", f"Téléphone: {sale.customer.phone or '-'}"],
            [f"Adresse: {sale.customer.address or '-'}", f"Email: {sale.customer.email or '-'}"],
        ]
        ct = Table(client_data, colWidths=['50%', '50%'])
        ct.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), blue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (-1, -1), light_blue),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
            ('PADDING', (0, 0), (-1, -1), 7),
        ]))
        story.append(ct)
        story.append(Spacer(1, 0.4*cm))

    # Lignes de vente
    rows = [['Ref.', 'Produit', 'Qté', 'Prix U.', 'Remise', 'Total']]
    for item in sale.items.all():
        rows.append([
            item.product_reference or '-',
            item.product_name,
            str(item.quantity),
            f"{item.unit_price:,.0f}",
            f"{item.discount_percent}%",
            f"{item.subtotal:,.0f}",
        ])
    it = Table(rows, colWidths=['12%', '38%', '8%', '14%', '10%', '18%'])
    it.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), blue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, light_blue]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('PADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(it)
    story.append(Spacer(1, 0.3*cm))

    # Totaux
    totals = [
        ['', 'Sous-total HT:', f"{sale.subtotal:,.0f} FCFA"],
        ['', f"Remise ({sale.discount_percent}%):", f"- {sale.discount_amount:,.0f} FCFA"],
        ['', f"TVA ({sale.tax_rate}%):", f"{sale.tax_amount:,.0f} FCFA"],
        ['', 'TOTAL TTC:', f"{sale.total_amount:,.0f} FCFA"],
    ]
    if sale.amount_paid > 0:
        totals.append(['', 'Montant reçu:', f"{sale.amount_paid:,.0f} FCFA"])
        totals.append(['', 'Monnaie rendue:', f"{sale.change_amount:,.0f} FCFA"])

    tt = Table(totals, colWidths=['45%', '32%', '23%'])
    tt.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('BACKGROUND', (1, 3), (-1, 3), blue),
        ('TEXTCOLOR', (1, 3), (-1, 3), colors.white),
        ('FONTNAME', (1, 3), (-1, 3), 'Helvetica-Bold'),
        ('FONTSIZE', (1, 3), (-1, 3), 11),
    ]))
    story.append(tt)

    story.append(Spacer(1, 0.8*cm))
    story.append(HRFlowable(width="100%", thickness=1, color=gray))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        "Merci pour votre confiance ! | TechShop Electronics",
        ParagraphStyle('Footer', parent=styles['Normal'],
                       fontSize=8, textColor=gray, alignment=TA_CENTER)
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


class SaleViewSet(viewsets.ModelViewSet):
    """CRUD des ventes avec création complète et PDF"""
    queryset = Sale.objects.select_related(
        'customer', 'cashier'
    ).prefetch_related('items').all()
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'payment_method', 'cashier', 'customer']
    search_fields = ['invoice_number', 'customer__name', 'cashier__email']
    ordering_fields = ['created_at', 'total_amount']
    ordering = ['-created_at']

    def get_permissions(self):
        perms = super().get_permissions()
        user = self.request.user
        # Un client peut consulter et passer des commandes, mais pas les modifier
        # (sinon il pourrait se marquer lui-même comme « payé »).
        if (
            user.is_authenticated
            and getattr(user, 'role', None) == 'customer'
            and self.action not in ('list', 'retrieve', 'create', 'pdf')
        ):
            raise PermissionDenied("Action réservée au personnel.")
        return perms

    def get_queryset(self):
        qs = super().get_queryset()
        # Un client ne voit que ses propres commandes
        if self.request.user.role == 'customer':
            qs = qs.filter(customer__user=self.request.user)
        # Filtres date
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        # Un caissier ne voit que ses propres ventes
        if (self.request.user.role == 'cashier'
                and self.action == 'list'):
            qs = qs.filter(cashier=self.request.user)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        ser = CreateSaleSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        is_customer = request.user.role == "customer"
        customer = None

        # Un client ne fixe jamais ses prix : seuls le catalogue et la TVA
        # par défaut s'appliquent (sinon un prix à 1 FCFA serait accepté).
        if is_customer:
            data = {
                **data,
                "discount_percent": 0,
                "tax_rate": Sale._meta.get_field("tax_rate").default,
                "amount_paid": 0,
            }

        if is_customer:
            try:
                customer = request.user.customer_profile
            except Exception:
                raise OrderError("Aucun profil client n'est associé à ce compte.")
        elif data.get("customer_id"):
            from apps.customers.models import Customer

            try:
                customer = Customer.objects.get(id=data["customer_id"])
            except Customer.DoesNotExist:
                raise OrderError("Client introuvable.")

        sale = Sale.objects.create(
            invoice_number=Sale.generate_invoice_number(),
            customer=customer,
            cashier=None if is_customer else request.user,
            payment_method=data.get("payment_method", "cash"),
            delivery_status=data.get("delivery_status", "store"),
            delivery_address=data.get("delivery_address", ""),
            customer_phone=data.get("customer_phone", ""),
            discount_percent=data.get("discount_percent", 0),
            tax_rate=data.get("tax_rate", 18),
            amount_paid=data.get("amount_paid", 0),
            notes=data.get("notes", ""),
            status="pending" if is_customer else "completed",
        )

        for item_data in data["items"]:
            try:
                product = Product.objects.select_for_update().get(
                    id=item_data["product_id"],
                    is_active=True,
                )
            except Product.DoesNotExist:
                raise OrderError(f"Produit ID {item_data['product_id']} introuvable.")

            qty = item_data["quantity"]

            if product.quantity < qty:
                raise OrderError(f"Stock insuffisant pour « {product.name} ». "
                            f"Disponible : {product.quantity}")

            if is_customer:
                unit_price = product.selling_price
                item_discount = 0
            else:
                unit_price = item_data.get("unit_price") or product.selling_price
                item_discount = item_data.get("discount_percent", 0)

            SaleItem.objects.create(
                sale=sale,
                product=product,
                product_name=product.name,
                product_reference=product.reference,
                quantity=qty,
                unit_price=unit_price,
                unit_cost=product.purchase_price,
                discount_percent=item_discount,
            )

            qty_before = product.quantity
            product.quantity -= qty
            product.save(update_fields=["quantity", "updated_at"])

            StockMovement.objects.create(
                product=product,
                movement_type="out",
                quantity=qty,
                quantity_before=qty_before,
                quantity_after=product.quantity,
                unit_price=unit_price,
                reference=sale.invoice_number,
                created_by=request.user,
                notes=f"Commande {sale.invoice_number}",
            )

            if product.quantity == 0:
                send_out_of_stock_alert(product)
            elif product.is_low_stock:
                send_low_stock_alert(product, request.user)

        sale.calculate_totals()

        # Paiement en ligne (Wave, Orange Money, carte) : dès que le paiement
        # est confirmé, la commande est complétée automatiquement.
        if is_customer and sale.payment_method in ONLINE_PAYMENT_METHODS:
            paid, payment_ref = process_online_payment(
                sale, sale.payment_method, sale.customer_phone
            )
            if paid:
                sale.status = "completed"
                sale.amount_paid = sale.total_amount
                sale.change_amount = 0
                sale.notes = (
                    f"{sale.notes} - " if sale.notes else ""
                ) + f"Paiement confirmé (réf. {payment_ref})"
                sale.save(update_fields=[
                    "status", "amount_paid", "change_amount", "notes",
                ])

        if is_customer:
            customer_name = customer.name if customer else request.user.email

            admin_users = User.objects.filter(
                role__in=["admin", "manager"],
                is_active=True,
            )

            for admin_user in admin_users:
                Notification.objects.create(
                    user=admin_user,
                    type="sale",
                    title="Nouvelle commande client",
                    message=(
                        f"{customer_name} a passé la commande "
                        f"{sale.invoice_number} pour "
                        f"{sale.total_amount} FCFA."
                    ),
                    link=f"/sales/{sale.id}",
                )

        log_activity(
            request.user,
            "create",
            "Sale",
            sale.id,
            f"Commande {sale.invoice_number} - {sale.total_amount} FCFA",
            get_client_ip(request),
        )

        transaction.on_commit(lambda: send_sale_email(sale))
        
        return Response(
            SaleSerializer(sale).data,
            status=status.HTTP_201_CREATED,
        )
    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Télécharger la facture en PDF"""
        sale = self.get_object()
        pdf_data = generate_sale_pdf(sale)
        response = HttpResponse(pdf_data, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="facture_{sale.invoice_number}.pdf"'
        )
        log_activity(
            request.user,
            'export',
            'Sale',
            sale.id,
            f"Export PDF: {sale.invoice_number}",
            get_client_ip(request)
        )
        return response

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        sale = self.get_object()

        sale.status = "completed"
        sale.cashier = request.user
        sale.save(update_fields=["status", "cashier"])
        send_sale_email(sale, confirmed=True)

        return Response({
            "message": "Commande approuvée avec succès."
        })

    @action(detail=False, methods=['get'])
    def daily_summary(self, request):
        """Résumé des ventes du jour"""
        from django.utils import timezone
        from django.db.models import Sum

        today = timezone.now().date()
        sales = Sale.objects.filter(
            created_at__date=today,
            status='completed'
        )

        return Response({
            "date": str(today),
            "count": sales.count(),
            "total_revenue": float(
                sales.aggregate(t=Sum("total_amount"))["t"] or 0
            ),
            "total_profit": float(
                sales.aggregate(p=Sum("profit"))["p"] or 0
            ),
        })