"""Entrées validées et sorties compactes pour Typebot."""
import json

from django.conf import settings
from rest_framework import serializers

from apps.sales.models import Sale

from .services import ChatbotError, can_cancel, format_fcfa

MAX_LINES = 20
MAX_QUANTITY = 50
DELIVERY_MODES = ('store', 'delivery')
BOT_PAYMENT_METHODS = ('cash', 'wave', 'orange_money')
PLACEHOLDER_IMAGE = 'static/chatbot/no-image.svg'
DESCRIPTION_MAX = 160


class OrderLineSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=MAX_QUANTITY)


class OrderInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, error_messages={
        'blank': 'Le nom est obligatoire.', 'required': 'Le nom est obligatoire.',
    })
    phone = serializers.CharField(max_length=30)
    delivery_mode = serializers.ChoiceField(choices=DELIVERY_MODES)
    payment_method = serializers.ChoiceField(choices=BOT_PAYMENT_METHODS)
    address = serializers.CharField(required=False, allow_blank=True, max_length=500)
    items = OrderLineSerializer(many=True, allow_empty=False, max_length=MAX_LINES)


def first_error(errors):
    """Premier message d'une erreur DRF imbriquée, sous forme de texte simple."""
    if isinstance(errors, dict):
        return first_error(next(iter(errors.values())))
    if isinstance(errors, (list, tuple)):
        return first_error(errors[0]) if errors else 'Données invalides.'
    return str(errors)


def parse_order(data):
    data = data.copy()
    if isinstance(data.get('items'), str):
        try:
            data['items'] = json.loads(data['items'])
        except ValueError:
            raise ChatbotError('Le contenu du panier est illisible.')
    serializer = OrderInputSerializer(data=data)
    if not serializer.is_valid():
        raise ChatbotError(first_error(serializer.errors))
    return serializer.validated_data


def public_base_url(request):
    configured = getattr(settings, 'CHATBOT_PUBLIC_BASE_URL', '')
    return (configured or request.build_absolute_uri('/')).rstrip('/')


def product_card(product, base_url):
    image = product.image.url if product.image else PLACEHOLDER_IMAGE
    description = (product.description or '').split(' — ')[0].strip()
    return {
        'id': product.id,
        'reference': product.reference,
        'name': product.name,
        'category': product.category.name if product.category_id else '',
        'price': int(product.selling_price),
        'price_display': format_fcfa(product.selling_price),
        'stock': product.quantity,
        'description': description[:DESCRIPTION_MAX],
        'image': f"{base_url}/{image.lstrip('/')}",
    }


def order_summary(sale):
    lines = [
        f"{item.quantity} x {item.product_name} : {format_fcfa(item.subtotal)}"
        for item in sale.items.all()
    ]
    return {
        'invoice_number': sale.invoice_number,
        'status': sale.status,
        'status_display': sale.get_status_display(),
        'delivery_status': sale.delivery_status,
        'delivery_status_display': sale.get_delivery_status_display(),
        'payment_method_display': sale.get_payment_method_display(),
        'delivery_address': sale.delivery_address,
        'total': int(sale.total_amount),
        'total_display': format_fcfa(sale.total_amount),
        'lines': '\n'.join(lines),
        'date': sale.created_at.astimezone().strftime('%d/%m/%Y à %H:%M'),
        'can_cancel': can_cancel(sale),
    }
