"""
Rapports et exports (PDF + Excel) :
- Quotidien, Hebdomadaire, Mensuel, Annuel
- Ventes, Bénéfices, Stocks
"""
import io
import logging
from datetime import date, timedelta
from calendar import monthrange

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Sum, Count, Avg, F, Q
from django.db.models.functions import TruncDay, TruncWeek, TruncMonth, TruncYear
from django.utils import timezone

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from django.http import HttpResponse

from apps.sales.models import Sale, SaleItem
from apps.products.models import Product, Category
from apps.inventory.models import StockMovement
from apps.customers.models import Customer
from apps.users.permissions import IsManager
from apps.users.views import log_activity, get_client_ip

logger = logging.getLogger('apps')


def _style_header(cell, bg='1d4ed8'):
    cell.font = Font(bold=True, color='FFFFFF', size=11)
    cell.fill = PatternFill('solid', fgColor=bg)
    cell.alignment = Alignment(horizontal='center', vertical='center')


def _auto_width(ws):
    for col in ws.columns:
        w = max((len(str(c.value or '')) for c in col), default=8)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(w + 4, 50)


def get_date_range(period, year=None, month=None, week=None):
    """Retourne (start_date, end_date) selon la période"""
    today = date.today()
    if period == 'today':
        return today, today
    elif period == 'yesterday':
        d = today - timedelta(days=1)
        return d, d
    elif period == 'week':
        start = today - timedelta(days=today.weekday())
        return start, today
    elif period == 'month':
        if year and month:
            y, m = int(year), int(month)
        else:
            y, m = today.year, today.month
        _, last = monthrange(y, m)
        return date(y, m, 1), date(y, m, last)
    elif period == 'year':
        y = int(year) if year else today.year
        return date(y, 1, 1), date(y, 12, 31)
    elif period == 'last30':
        return today - timedelta(days=30), today
    elif period == 'last7':
        return today - timedelta(days=7), today
    return today - timedelta(days=30), today


class DashboardView(APIView):
    """Données du tableau de bord principal"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        month_start = today.replace(day=1)

        # Ventes du jour
        today_sales = Sale.objects.filter(
            created_at__date=today, status='completed'
        ).aggregate(
            count=Count('id'),
            revenue=Sum('total_amount'),
            profit=Sum('profit'),
        )

        # Ventes du mois
        month_sales = Sale.objects.filter(
            created_at__date__gte=month_start, status='completed'
        ).aggregate(
            count=Count('id'),
            revenue=Sum('total_amount'),
            profit=Sum('profit'),
        )

        # Evolution des ventes (7 derniers jours)
        sales_evolution = (
            Sale.objects.filter(
                created_at__date__gte=today - timedelta(days=6),
                status='completed'
            )
            .annotate(day=TruncDay('created_at'))
            .values('day')
            .annotate(revenue=Sum('total_amount'), count=Count('id'))
            .order_by('day')
        )

        # Produits les plus vendus
        top_products = (
            SaleItem.objects.filter(sale__status='completed')
            .values('product_name')
            .annotate(total_qty=Sum('quantity'), total_revenue=Sum(
                F('quantity') * F('unit_price')
            ))
            .order_by('-total_qty')[:10]
        )

        # Catégories
        category_sales = (
            SaleItem.objects.filter(sale__status='completed')
            .values('product__category__name', 'product__category__color')
            .annotate(total=Sum(F('quantity') * F('unit_price')))
            .order_by('-total')[:8]
        )

        # Alertes stock
        from django.db.models import ExpressionWrapper, IntegerField
        low_stock = Product.objects.filter(
            is_active=True
        ).annotate(
            diff=ExpressionWrapper(F('quantity') - F('min_stock'), output_field=IntegerField())
        ).filter(diff__lte=0)

        # Monthly evolution (12 months)
        monthly_evolution = (
            Sale.objects.filter(
                created_at__date__gte=today - timedelta(days=365),
                status='completed'
            )
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(revenue=Sum('total_amount'), profit=Sum('profit'), count=Count('id'))
            .order_by('month')
        )

        return Response({
            'today': {
                'sales_count': today_sales['count'] or 0,
                'revenue': float(today_sales['revenue'] or 0),
                'profit': float(today_sales['profit'] or 0),
            },
            'month': {
                'sales_count': month_sales['count'] or 0,
                'revenue': float(month_sales['revenue'] or 0),
                'profit': float(month_sales['profit'] or 0),
            },
            'totals': {
                'products': Product.objects.filter(is_active=True).count(),
                'customers': Customer.objects.filter(is_active=True).count(),
                'low_stock_alerts': low_stock.count(),
                'all_time_revenue': float(
                    Sale.objects.filter(status='completed').aggregate(
                        t=Sum('total_amount')
                    )['t'] or 0
                ),
            },
            'sales_evolution': [
                {
                    'date': item['day'].strftime('%d/%m'),
                    'revenue': float(item['revenue'] or 0),
                    'count': item['count'],
                }
                for item in sales_evolution
            ],
            'monthly_evolution': [
                {
                    'month': item['month'].strftime('%b %Y'),
                    'revenue': float(item['revenue'] or 0),
                    'profit': float(item['profit'] or 0),
                    'count': item['count'],
                }
                for item in monthly_evolution
            ],
            'top_products': list(top_products),
            'category_sales': [
                {
                    'name': item['product__category__name'] or 'Sans catégorie',
                    'color': item['product__category__color'] or '#6b7280',
                    'total': float(item['total'] or 0),
                }
                for item in category_sales
            ],
            'low_stock_alerts': [
                {
                    'id': p.id,
                    'name': p.name,
                    'reference': p.reference,
                    'quantity': p.quantity,
                    'min_stock': p.min_stock,
                }
                for p in low_stock[:10]
            ],
        })


class SalesReportView(APIView):
    """Rapports de ventes par période"""
    permission_classes = [IsManager]

    def get(self, request):
        period = request.query_params.get('period', 'month')
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        start, end = get_date_range(period, year, month)

        sales = Sale.objects.filter(
            created_at__date__gte=start,
            created_at__date__lte=end,
            status='completed'
        )
        summary = sales.aggregate(
            count=Count('id'),
            revenue=Sum('total_amount'),
            profit=Sum('profit'),
            cost=Sum('total_cost'),
            avg_basket=Avg('total_amount'),
        )

        # Évolution journalière
        daily = (
            sales.annotate(day=TruncDay('created_at'))
            .values('day')
            .annotate(
                revenue=Sum('total_amount'),
                profit=Sum('profit'),
                count=Count('id')
            )
            .order_by('day')
        )

        # Top produits
        top_products = (
            SaleItem.objects.filter(
                sale__created_at__date__gte=start,
                sale__created_at__date__lte=end,
                sale__status='completed'
            )
            .values('product_name')
            .annotate(
                qty=Sum('quantity'),
                revenue=Sum(F('quantity') * F('unit_price')),
            )
            .order_by('-qty')[:10]
        )

        # Par mode de paiement
        by_payment = (
            sales.values('payment_method')
            .annotate(count=Count('id'), total=Sum('total_amount'))
            .order_by('-total')
        )

        return Response({
            'period': period,
            'start_date': str(start),
            'end_date': str(end),
            'summary': {
                'count': summary['count'] or 0,
                'revenue': float(summary['revenue'] or 0),
                'profit': float(summary['profit'] or 0),
                'cost': float(summary['cost'] or 0),
                'avg_basket': float(summary['avg_basket'] or 0),
                'margin_rate': (
                    round(float(summary['profit'] or 0) / float(summary['revenue'] or 1) * 100, 2)
                ),
            },
            'daily': [
                {
                    'date': item['day'].strftime('%d/%m/%Y'),
                    'revenue': float(item['revenue'] or 0),
                    'profit': float(item['profit'] or 0),
                    'count': item['count'],
                }
                for item in daily
            ],
            'top_products': list(top_products),
            'by_payment': list(by_payment),
        })


class ExportExcelView(APIView):
    """Export Excel des rapports"""
    permission_classes = [IsManager]

    def get(self, request):
        report_type = request.query_params.get('type', 'sales')
        period = request.query_params.get('period', 'month')
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        start, end = get_date_range(period, year, month)

        wb = Workbook()

        if report_type == 'sales':
            ws = wb.active
            ws.title = 'Ventes'
            headers = ['N° Facture', 'Date', 'Client', 'Caissier', 'Mode Paiement',
                       'Sous-total', 'Remise', 'TVA', 'Total TTC', 'Bénéfice', 'Statut']
            for i, h in enumerate(headers, 1):
                _style_header(ws.cell(row=1, column=i, value=h))

            STATUS_COLORS = {
                'completed': 'DCFCE7', 'cancelled': 'FEE2E2',
                'refunded': 'FEF3C7', 'pending': 'DBEAFE'
            }
            sales = Sale.objects.filter(
                created_at__date__gte=start,
                created_at__date__lte=end
            ).select_related('customer', 'cashier').order_by('-created_at')

            for row, s in enumerate(sales, 2):
                bg = STATUS_COLORS.get(s.status, 'FFFFFF')
                vals = [
                    s.invoice_number,
                    s.created_at.strftime('%d/%m/%Y %H:%M'),
                    s.customer.name if s.customer else '-',
                    s.cashier.get_full_name() if s.cashier else '-',
                    s.get_payment_method_display(),
                    float(s.subtotal), float(s.discount_amount),
                    float(s.tax_amount), float(s.total_amount),
                    float(s.profit), s.get_status_display(),
                ]
                for col, val in enumerate(vals, 1):
                    c = ws.cell(row=row, column=col, value=val)
                    c.fill = PatternFill('solid', fgColor=bg)
                    if col in [6, 7, 8, 9, 10]:
                        c.number_format = '#,##0'
            _auto_width(ws)

            # Feuille résumé
            ws2 = wb.create_sheet('Résumé')
            agg = sales.filter(status='completed').aggregate(
                cnt=Count('id'), rev=Sum('total_amount'),
                prof=Sum('profit'), cost=Sum('total_cost')
            )
            summary_data = [
    ["Indicateur", "Valeur"],
    ["Periode", f"{start} -> {end}"],
    ["Nombre de ventes", agg["cnt"] or 0],
    ["Chiffre affaires (FCFA)", float(agg["rev"] or 0)],
    ["Benefices (FCFA)", float(agg["prof"] or 0)],
    ["Cout des ventes (FCFA)", float(agg["cost"] or 0)],
    [
        "Taux de marge (%)",
        round(
            float(agg["prof"] or 0) /
            max(float(agg["rev"] or 1), 1) * 100,
            2
        ),
    ],
]
            for row, (label, val) in enumerate(summary_data, 1):
                _style_header(ws2.cell(row=row, column=1, value=label), bg='374151')
                cell = ws2.cell(row=row, column=2, value=val)
                if isinstance(val, float):
                    cell.number_format = '#,##0.00'
            _auto_width(ws2)

        elif report_type == 'stock':
            ws = wb.active
            ws.title = 'Inventaire Stock'
            headers = ['Réf.', 'Produit', 'Catégorie', 'Fournisseur',
                       'Prix Achat', 'Prix Vente', 'Quantité', 'Stock Min',
                       'Statut', 'Valeur Stock', 'Marge %']
            for i, h in enumerate(headers, 1):
                _style_header(ws.cell(row=1, column=i, value=h))

            for row, p in enumerate(Product.objects.select_related('category', 'supplier').order_by('name'), 2):
                if p.quantity == 0:
                    bg = 'FEE2E2'
                    status_txt = 'Rupture'
                elif p.quantity <= p.min_stock:
                    bg = 'FEF3C7'
                    status_txt = 'Stock bas'
                else:
                    bg = 'DCFCE7'
                    status_txt = 'Normal'

                vals = [
                    p.reference, p.name,
                    p.category.name if p.category else '-',
                    p.supplier.name if p.supplier else '-',
                    float(p.purchase_price), float(p.selling_price),
                    p.quantity, p.min_stock, status_txt,
                    float(p.stock_value), float(p.margin),
                ]
                for col, val in enumerate(vals, 1):
                    c = ws.cell(row=row, column=col, value=val)
                    if col == 9:
                        c.fill = PatternFill('solid', fgColor=bg)
                        c.font = Font(bold=True)
                    if col in [5, 6, 10]:
                        c.number_format = '#,##0'
            _auto_width(ws)

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        resp = HttpResponse(
            buf.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        resp['Content-Disposition'] = f'attachment; filename="rapport_{report_type}_{start}_{end}.xlsx"'
        log_activity(request.user, 'export', 'Report', None,
                     f"Export Excel {report_type} {period}", get_client_ip(request))
        return resp
