"""Logique métier de l'assistant : commandes invités, suivi et annulation.

Les commandes passées par le chatbot suivent les mêmes règles que celles du
site (prix du catalogue, TVA par défaut, statut « En attente », stock décrémenté),
mais sans compte client : le téléphone sert d'identifiant.
"""
import re
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound

from apps.customers.models import Customer
from apps.inventory.models import StockMovement
from apps.notifications.utils import (
    notify_admins_and_managers, send_low_stock_alert, send_out_of_stock_alert,
)
from apps.products.models import Product
from apps.sales.models import Sale, SaleItem

PHONE_DIGITS = 9
GUEST_EMAIL_DOMAIN = 'clients.techshop.local'
CANCELLABLE_DELIVERY = ('store', 'pending')


class ChatbotError(APIException):
    """Erreur métier (400) : le message est affiché tel quel dans le chat."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = 'chatbot_error'

    def __init__(self, message):
        super().__init__({'error': message})


def format_fcfa(amount):
    return f"{int(round(Decimal(amount))):,}".replace(',', ' ') + ' FCFA'


def normalize_phone(raw):
    """Garde les 9 derniers chiffres (771234567), quel que soit le format saisi."""
    digits = re.sub(r'\D', '', raw or '')
    if len(digits) < PHONE_DIGITS:
        raise ChatbotError('Numéro de téléphone invalide.')
    return digits[-PHONE_DIGITS:]


def display_phone(digits):
    return f"+221 {digits[:2]} {digits[2:5]} {digits[5:7]} {digits[7:]}"


def _guest_customer(name, digits, address):
    customer, created = Customer.objects.get_or_create(
        email=f'chatbot-{digits}@{GUEST_EMAIL_DOMAIN}',
        defaults={
            'name': name,
            'phone': display_phone(digits),
            'password': make_password(None),
            'address': address,
        },
    )
    if not created and address and customer.address != address:
        customer.address = address
        customer.save(update_fields=['address', 'updated_at'])
    return customer


def _lock_products(items):
    ids = sorted({item['product_id'] for item in items})
    products = Product.objects.select_for_update().filter(id__in=ids, is_active=True)
    return {product.id: product for product in products}


def _add_line(sale, product, quantity):
    if quantity > product.quantity:
        raise ChatbotError(
            f"Stock insuffisant pour « {product.name} » (disponible : {product.quantity})."
        )
    SaleItem.objects.create(
        sale=sale, product=product, product_name=product.name,
        product_reference=product.reference, quantity=quantity,
        unit_price=product.selling_price, unit_cost=product.purchase_price,
    )
    before = product.quantity
    product.quantity = before - quantity
    product.save(update_fields=['quantity', 'updated_at'])
    StockMovement.objects.create(
        product=product, movement_type='out', quantity=quantity,
        quantity_before=before, quantity_after=product.quantity,
        unit_price=product.selling_price, reference=sale.invoice_number,
        notes=f'Commande assistant {sale.invoice_number}',
    )
    if product.quantity == 0:
        send_out_of_stock_alert(product)
    elif product.is_low_stock:
        send_low_stock_alert(product)


@transaction.atomic
def create_order(data):
    """Crée la commande ; toute erreur annule aussi les mouvements de stock."""
    digits = normalize_phone(data['phone'])
    delivery = data['delivery_mode'] == 'delivery'
    address = data.get('address', '').strip()
    if delivery and not address:
        raise ChatbotError("L'adresse de livraison est obligatoire.")

    products = _lock_products(data['items'])
    for item in data['items']:
        if item['product_id'] not in products:
            raise ChatbotError('Un des produits demandés n\'est plus disponible.')

    customer = _guest_customer(data['name'].strip(), digits, address)
    sale = Sale.objects.create(
        invoice_number=Sale.generate_invoice_number(),
        customer=customer,
        cashier=None,
        status='pending',
        payment_method=data['payment_method'],
        delivery_status='pending' if delivery else 'store',
        delivery_address=address if delivery else '',
        customer_phone=display_phone(digits),
        notes="Commande passée via l'assistant en ligne.",
    )
    for item in data['items']:
        _add_line(sale, products[item['product_id']], item['quantity'])
    sale.calculate_totals()

    notify_admins_and_managers(
        'sale', 'Nouvelle commande client',
        f"{customer.name} a passé la commande {sale.invoice_number} "
        f"pour {format_fcfa(sale.total_amount)} via l'assistant.",
        f'/sales/{sale.id}',
    )
    return sale


def find_order(invoice_number, phone):
    """Retourne la commande si facture et téléphone correspondent, sinon 404.

    Le même message est renvoyé dans les deux cas : on ne révèle pas
    l'existence d'une facture à quelqu'un qui n'en connaît pas le téléphone.
    """
    digits = normalize_phone(phone)
    sale = Sale.objects.select_related('customer').filter(
        invoice_number=invoice_number.strip().upper(),
    ).first()
    if not sale or not sale.customer_phone.replace(' ', '').endswith(digits):
        raise NotFound({'error': 'Aucune commande ne correspond à ces informations.'})
    return sale


def can_cancel(sale):
    return sale.status == 'pending' and sale.delivery_status in CANCELLABLE_DELIVERY


@transaction.atomic
def cancel_order(invoice_number, phone):
    sale = find_order(invoice_number, phone)
    sale = Sale.objects.select_for_update().get(pk=sale.pk)
    if not can_cancel(sale):
        raise ChatbotError(
            "Cette commande ne peut plus être annulée ici. Contactez la boutique."
        )
    items = list(sale.items.select_related('product'))
    locked = {
        product.id: product
        for product in Product.objects.select_for_update().filter(
            id__in=sorted(item.product_id for item in items if item.product_id)
        )
    }
    for item in items:
        product = locked.get(item.product_id)
        if not product:
            continue
        before = product.quantity
        product.quantity = before + item.quantity
        product.save(update_fields=['quantity', 'updated_at'])
        StockMovement.objects.create(
            product=product, movement_type='in', quantity=item.quantity,
            quantity_before=before, quantity_after=product.quantity,
            unit_price=item.unit_price, reference=sale.invoice_number,
            notes=f'Annulation de la commande {sale.invoice_number} par le client',
        )
    sale.status = 'cancelled'
    sale.save(update_fields=['status', 'updated_at'])
    notify_admins_and_managers(
        'sale', 'Commande annulée par le client',
        f"La commande {sale.invoice_number} a été annulée via l'assistant.",
        f'/sales/{sale.id}',
    )
    return sale
