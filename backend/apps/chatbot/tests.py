"""Tests de l'API réservée à l'assistant Typebot."""
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.inventory.models import StockMovement
from apps.notifications.models import Notification
from apps.products.models import Category, Product
from apps.sales.models import Sale
from apps.users.models import User

KEY = 'cle-de-test'
PHONE = '77 123 45 67'

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def chatbot_settings(settings):
    settings.CHATBOT_API_KEY = KEY
    settings.CHATBOT_PUBLIC_BASE_URL = 'https://boutique.test'


@pytest.fixture
def bot():
    api = APIClient()
    api.credentials(HTTP_X_CHATBOT_KEY=KEY)
    return api


@pytest.fixture
def category():
    return Category.objects.create(name='Téléphones')


@pytest.fixture
def make_product(category):
    def _make(reference, price='1000', stock=10, **extra):
        return Product.objects.create(
            reference=reference,
            name=extra.pop('name', f'Produit {reference}'),
            category=extra.pop('category', category),
            purchase_price=Decimal('400'),
            selling_price=Decimal(price),
            quantity=stock,
            **extra,
        )
    return _make


@pytest.fixture
def admin_user():
    return User.objects.create_user(
        username='admin', email='admin@test.sn', password='pass12345', role='admin'
    )


def _order_payload(product, **overrides):
    payload = {
        'name': 'Awa Diop',
        'phone': PHONE,
        'delivery_mode': 'store',
        'payment_method': 'cash',
        'items': [{'product_id': product.id, 'quantity': 2}],
    }
    payload.update(overrides)
    return payload


# --- Accès ------------------------------------------------------------

def test_requests_without_key_are_rejected():
    res = APIClient().get('/api/chatbot/categories/')
    assert res.status_code == 403


def test_requests_with_wrong_key_are_rejected():
    api = APIClient()
    api.credentials(HTTP_X_CHATBOT_KEY='mauvaise')
    assert api.get('/api/chatbot/categories/').status_code == 403


def test_endpoint_is_closed_when_no_key_is_configured(settings):
    settings.CHATBOT_API_KEY = ''
    api = APIClient()
    api.credentials(HTTP_X_CHATBOT_KEY='')
    assert api.get('/api/chatbot/categories/').status_code == 403


# --- Catalogue --------------------------------------------------------

def test_categories_only_list_categories_with_available_products(bot, category, make_product):
    make_product('A1')
    empty = Category.objects.create(name='Vide')
    res = bot.get('/api/chatbot/categories/')
    names = [c['name'] for c in res.data['results']]
    assert category.name in names
    assert empty.name not in names


def test_products_hide_out_of_stock_and_inactive(bot, make_product):
    make_product('OK1')
    make_product('OUT', stock=0)
    make_product('OFF', is_active=False)
    res = bot.get('/api/chatbot/products/')
    assert [p['reference'] for p in res.data['results']] == ['OK1']


def test_products_expose_prices_and_absolute_image_url(bot, make_product):
    make_product('P1', price='125000', image='products/photo.png')
    item = bot.get('/api/chatbot/products/').data['results'][0]
    assert item['price'] == 125000
    assert item['price_display'] == '125 000 FCFA'
    assert item['image'] == 'https://boutique.test/media/products/photo.png'


def test_products_have_a_placeholder_image_when_none(bot, make_product):
    make_product('P1')
    item = bot.get('/api/chatbot/products/').data['results'][0]
    assert item['image'].startswith('https://boutique.test/')


def test_products_filter_by_category_search_and_budget(bot, make_product):
    other = Category.objects.create(name='Audio')
    make_product('T1', name='Galaxy S24', price='500000')
    make_product('T2', name='Redmi Note', price='90000')
    make_product('A1', name='Casque JBL', price='40000', category=other)

    by_category = bot.get('/api/chatbot/products/', {'category': other.id}).data['results']
    assert [p['reference'] for p in by_category] == ['A1']

    by_search = bot.get('/api/chatbot/products/', {'q': 'galaxy'}).data['results']
    assert [p['reference'] for p in by_search] == ['T1']

    by_budget = bot.get('/api/chatbot/products/', {'max_price': 100000}).data['results']
    assert {p['reference'] for p in by_budget} == {'T2', 'A1'}


def test_products_are_limited_and_cheapest_first(bot, make_product):
    for index in range(15):
        make_product(f'R{index}', price=str(1000 + index))
    results = bot.get('/api/chatbot/products/').data['results']
    assert len(results) == 12
    assert results[0]['price'] == 1000


# --- Commandes --------------------------------------------------------

def test_order_for_store_pickup_creates_pending_sale_and_decrements_stock(bot, make_product, admin_user):
    product = make_product('P1', price='10000', stock=5)
    res = bot.post('/api/chatbot/orders/', _order_payload(product), format='json')

    assert res.status_code == 201
    sale = Sale.objects.get(invoice_number=res.data['invoice_number'])
    assert sale.status == 'pending'
    assert sale.delivery_status == 'store'
    assert sale.cashier is None
    assert sale.items.count() == 1
    assert sale.subtotal == Decimal('20000')
    assert sale.total_amount == Decimal('23600')
    assert res.data['total_display'] == '23 600 FCFA'
    product.refresh_from_db()
    assert product.quantity == 3
    assert StockMovement.objects.filter(reference=sale.invoice_number, movement_type='out').exists()
    assert Notification.objects.filter(user=admin_user, type='sale').exists()


def test_delivery_order_requires_an_address(bot, make_product):
    product = make_product('P1')
    res = bot.post(
        '/api/chatbot/orders/',
        _order_payload(product, delivery_mode='delivery'),
        format='json',
    )
    assert res.status_code == 400
    assert 'adresse' in res.data['error'].lower()


def test_delivery_order_is_marked_pending_delivery(bot, make_product):
    product = make_product('P1')
    res = bot.post(
        '/api/chatbot/orders/',
        _order_payload(product, delivery_mode='delivery', address='Sicap Liberté 6, Dakar'),
        format='json',
    )
    sale = Sale.objects.get(invoice_number=res.data['invoice_number'])
    assert sale.delivery_status == 'pending'
    assert sale.delivery_address == 'Sicap Liberté 6, Dakar'


def test_order_ignores_client_supplied_price(bot, make_product):
    product = make_product('P1', price='1000')
    payload = _order_payload(product)
    payload['items'][0]['unit_price'] = '1'
    res = bot.post('/api/chatbot/orders/', payload, format='json')
    assert Sale.objects.get(invoice_number=res.data['invoice_number']).subtotal == Decimal('2000')


def test_order_with_insufficient_stock_is_rejected_and_rolled_back(bot, make_product):
    ok = make_product('P1', stock=5)
    short = make_product('P2', stock=1, name='Rare')
    payload = _order_payload(ok)
    payload['items'].append({'product_id': short.id, 'quantity': 3})
    res = bot.post('/api/chatbot/orders/', payload, format='json')

    assert res.status_code == 400
    assert 'Rare' in res.data['error']
    ok.refresh_from_db()
    assert ok.quantity == 5
    assert Sale.objects.count() == 0


@pytest.mark.parametrize('overrides', [
    {'name': ''},
    {'phone': '12'},
    {'payment_method': 'bitcoin'},
    {'delivery_mode': 'drone'},
    {'items': []},
])
def test_invalid_orders_are_rejected(bot, make_product, overrides):
    product = make_product('P1')
    res = bot.post('/api/chatbot/orders/', _order_payload(product, **overrides), format='json')
    assert res.status_code == 400
    assert res.data['error']


def test_items_can_be_sent_as_a_json_string(bot, make_product):
    # Typebot ne sait pas envoyer un tableau dans un corps de requête : il envoie du texte JSON.
    product = make_product('P1', price='1000')
    payload = _order_payload(product, items=f'[{{"product_id": {product.id}, "quantity": 3}}]')
    res = bot.post('/api/chatbot/orders/', payload, format='json')
    assert res.status_code == 201
    assert Sale.objects.get(invoice_number=res.data['invoice_number']).items.get().quantity == 3


def test_malformed_items_string_is_rejected(bot, make_product):
    product = make_product('P1')
    res = bot.post('/api/chatbot/orders/', _order_payload(product, items='pas du json'), format='json')
    assert res.status_code == 400


def test_names_with_quotes_are_stored_as_is(bot, make_product):
    product = make_product('P1')
    name = "Aïssatou \"Aïsha\" N'Diaye"
    res = bot.post('/api/chatbot/orders/', _order_payload(product, name=name), format='json')
    assert res.status_code == 201
    assert Customer.objects.get().name == name


def test_same_phone_reuses_the_same_customer(bot, make_product):
    product = make_product('P1')
    bot.post('/api/chatbot/orders/', _order_payload(product), format='json')
    bot.post('/api/chatbot/orders/', _order_payload(product, phone='+221771234567'), format='json')
    assert Customer.objects.count() == 1
    assert Customer.objects.get().sales.count() == 2


# --- Suivi et annulation ---------------------------------------------

@pytest.fixture
def placed_order(bot, make_product):
    product = make_product('P1', price='10000', stock=5)
    res = bot.post('/api/chatbot/orders/', _order_payload(product), format='json')
    return res.data['invoice_number'], product


def test_tracking_returns_status_and_lines(bot, placed_order):
    number, _ = placed_order
    res = bot.get(f'/api/chatbot/orders/{number}/', {'phone': '221771234567'})
    assert res.status_code == 200
    assert res.data['status'] == 'pending'
    assert res.data['status_display'] == 'En attente'
    assert res.data['can_cancel'] is True
    assert 'Produit P1' in res.data['lines']


def test_tracking_with_wrong_phone_looks_like_not_found(bot, placed_order):
    number, _ = placed_order
    res = bot.get(f'/api/chatbot/orders/{number}/', {'phone': '78 000 00 00'})
    assert res.status_code == 404


def test_tracking_unknown_invoice_is_404(bot):
    assert bot.get('/api/chatbot/orders/FAC-00000000-AAAAAA/', {'phone': PHONE}).status_code == 404


def test_cancel_pending_order_restores_stock(bot, placed_order):
    number, product = placed_order
    res = bot.post(f'/api/chatbot/orders/{number}/cancel/', {'phone': PHONE}, format='json')

    assert res.status_code == 200
    assert Sale.objects.get(invoice_number=number).status == 'cancelled'
    product.refresh_from_db()
    assert product.quantity == 5
    assert StockMovement.objects.filter(reference=number, movement_type='in').exists()


def test_cancel_twice_is_rejected_without_double_restock(bot, placed_order):
    number, product = placed_order
    bot.post(f'/api/chatbot/orders/{number}/cancel/', {'phone': PHONE}, format='json')
    res = bot.post(f'/api/chatbot/orders/{number}/cancel/', {'phone': PHONE}, format='json')
    assert res.status_code == 400
    product.refresh_from_db()
    assert product.quantity == 5


def test_cancel_with_wrong_phone_is_refused(bot, placed_order):
    number, _ = placed_order
    res = bot.post(f'/api/chatbot/orders/{number}/cancel/', {'phone': '78 000 00 00'}, format='json')
    assert res.status_code == 404
    assert Sale.objects.get(invoice_number=number).status == 'pending'


def test_completed_orders_cannot_be_cancelled(bot, placed_order):
    number, _ = placed_order
    Sale.objects.filter(invoice_number=number).update(status='completed')
    res = bot.post(f'/api/chatbot/orders/{number}/cancel/', {'phone': PHONE}, format='json')
    assert res.status_code == 400
    assert bot.get(f'/api/chatbot/orders/{number}/', {'phone': PHONE}).data['can_cancel'] is False
