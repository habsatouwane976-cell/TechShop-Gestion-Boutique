"""Compréhension du langage libre : intentions, budget, produits, fautes de frappe."""
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.products.models import Category, Product

from .nlu import Vocabulary, fold, understand

KEY = 'cle-de-test'
INVOICE = 'FAC-20261031-AB12CD'

VOCAB = Vocabulary(words={'casque', 'bluetooth', 'jbl', 'samsung', 'galaxy', 'iphone', 'airpods',
                          'smartphones', 'ordinateurs', 'portables', 'souris', 'chargeur'})


def intent(message):
    return understand(message, VOCAB)['intent']


# --- Intentions ---------------------------------------------------------

@pytest.mark.parametrize('message, expected', [
    ('Bonjour', 'greeting'),
    ('salut !', 'greeting'),
    ('Bonsoir', 'greeting'),
    ('merci beaucoup', 'thanks'),
    ('Merci !', 'thanks'),
    ('au revoir', 'goodbye'),
    ('bye', 'goodbye'),
    ('menu', 'menu'),
    ('aide', 'menu'),
    ('que pouvez-vous faire ?', 'menu'),
    ('je cherche un casque bluetooth', 'product_search'),
    ('avez-vous des iPhone ?', 'product_search'),
    ('je voudrais un téléphone à moins de 100 000 fcfa', 'product_search'),
    ('casque pas cher', 'product_search'),
    ('combien coûte le Galaxy', 'product_search'),
    ('où en est ma commande', 'track_order'),
    ('comment suivre ma livraison', 'track_order'),
    ('je veux savoir le statut de ma commande', 'track_order'),
    (f'suivi {INVOICE}', 'track_order'),
    ('je veux annuler ma commande', 'cancel_order'),
    (f'annuler {INVOICE}', 'cancel_order'),
    ('quels sont vos frais de livraison ?', 'delivery_info'),
    ('est-ce que vous livrez à Thiès', 'delivery_info'),
    ('puis-je retirer ma commande en boutique', 'delivery_info'),
    ('peut-on payer avec Wave ?', 'payment_info'),
    ('quels moyens de paiement acceptez-vous', 'payment_info'),
    ('je veux parler à un conseiller', 'contact'),
    ("quelle est votre adresse ?", 'contact'),
    ('comment vous joindre', 'contact'),
    ('voir mon panier', 'cart'),
    ('je veux commander', 'checkout'),
    ('passer commande', 'checkout'),
    ('je veux annuler', 'cancel_order'),
    ('annuler', 'cancel_order'),
    ('comment ça va ?', 'greeting'),
    ("qui êtes-vous ?", 'about'),
    ('quels produits vendez-vous ?', 'catalog'),
    ('montre-moi le catalogue', 'catalog'),
])
def test_intent(message, expected):
    assert intent(message) == expected


@pytest.mark.parametrize('message', ['', '   ', '???', 'xyzqwerty', 'la météo de demain'])
def test_unrecognised_messages_are_unknown(message):
    assert intent(message) == 'unknown'


def test_buying_a_named_product_is_a_search_not_a_checkout():
    assert intent('je voudrais commander un casque JBL') == 'product_search'


def test_greeting_with_a_request_is_the_request():
    assert intent('bonjour je cherche une souris') == 'product_search'


def test_unknown_product_with_a_buying_verb_still_searches():
    # Le client doit obtenir « aucun résultat », pas « je n'ai pas compris ».
    assert intent('avez-vous des tablettes ?') == 'product_search'


def test_typos_are_tolerated():
    assert intent('samsumg galaxi') == 'product_search'


# --- Entités ------------------------------------------------------------

@pytest.mark.parametrize('message, budget', [
    ('un téléphone à moins de 100 000 fcfa', 100000),
    ('un téléphone moins de 100000', 100000),
    ('ordinateur budget 300k', 300000),
    ('casque max 50 mille', 50000),
    ('un casque jusqu\'à 60.000 francs', 60000),
    ('souris sous 15000', 15000),
    ('chargeur 10000 fcfa', 10000),
])
def test_budget_is_extracted(message, budget):
    assert understand(message, VOCAB)['max_price'] == budget


def test_no_budget_means_none():
    assert understand('je cherche un casque', VOCAB)['max_price'] is None


def test_query_keeps_product_words_only():
    result = understand('Bonjour, je voudrais un casque bluetooth JBL à moins de 60 000 fcfa svp', VOCAB)
    assert result['query'] == 'casque bluetooth jbl'
    assert result['max_price'] == 60000


def test_invoice_number_is_normalised():
    result = understand('où en est ma commande fac-20261031-ab12cd ?', VOCAB)
    assert result['invoice_number'] == INVOICE


def test_summary_describes_what_was_understood():
    summary = understand('un casque jbl à moins de 60 000 fcfa', VOCAB)['summary']
    assert 'casque jbl' in summary and '60 000 FCFA' in summary


def test_fold_removes_accents_case_and_punctuation():
    assert fold("L'Écouteur Bluetooth-JBL") == 'l ecouteur bluetooth jbl'


# --- Endpoint et recherche ---------------------------------------------

@pytest.fixture
def bot(settings):
    settings.CHATBOT_API_KEY = KEY
    settings.CHATBOT_PUBLIC_BASE_URL = 'https://boutique.test'
    api = APIClient()
    api.credentials(HTTP_X_CHATBOT_KEY=KEY)
    return api


@pytest.fixture
def shop(db):
    phones = Category.objects.create(name='Smartphones')
    audio = Category.objects.create(name='Écouteurs et casques')
    computers = Category.objects.create(name='Ordinateurs portables')

    def make(reference, name, category, price, stock=10, description=''):
        return Product.objects.create(
            reference=reference, name=name, category=category, description=description,
            purchase_price=Decimal('1'), selling_price=Decimal(price), quantity=stock,
        )
    iphone15 = make('P15', 'iPhone 15 Pro', phones, '900000')
    iphone13 = make('P13', 'iPhone 13', phones, '500000')
    return {
        'iphone15': iphone15, 'iphone13': iphone13,
        'galaxy': make('S1', 'Samsung Galaxy S24', phones, '450000'),
        'redmi': make('S2', 'Redmi Note 13', phones, '90000'),
        'jbl': make('A1', 'Casque Bluetooth JBL Tune', audio, '48000'),
        'airpods': make('A2', 'AirPods Pro', audio, '170000'),
        'laptop': make('C1', 'HP Pavilion 15', computers, '380000'),
    }


def search(bot, **params):
    return [p['reference'] for p in bot.get('/api/chatbot/products/', params).data['results']]


def test_understand_endpoint_returns_intent_and_entities(bot, shop):
    res = bot.post('/api/chatbot/understand/', {'message': 'un casque jbl à moins de 60 000 fcfa'}, format='json')
    assert res.status_code == 200
    assert res.data['intent'] == 'product_search'
    assert res.data['query'] == 'casque jbl'
    assert res.data['max_price'] == 60000


def test_understand_endpoint_requires_the_key(db):
    assert APIClient().post('/api/chatbot/understand/', {'message': 'bonjour'}, format='json').status_code == 403


def test_understand_endpoint_ignores_oversized_input(bot, shop):
    res = bot.post('/api/chatbot/understand/', {'message': 'casque ' * 500}, format='json')
    assert res.status_code == 200


def test_understand_endpoint_matches_typos_against_the_catalog(bot, shop):
    res = bot.post('/api/chatbot/understand/', {'message': 'samsumg galaxi'}, format='json')
    assert res.data['intent'] == 'product_search'


def test_search_is_accent_and_case_insensitive(bot, shop):
    assert search(bot, q='ECOUTEURS') == ['A1', 'A2']


def test_search_with_several_words_requires_all_when_possible(bot, shop):
    assert search(bot, q='casque bluetooth jbl') == ['A1']


def test_search_ranks_name_matches_before_category_matches(bot, shop):
    assert search(bot, q='casque')[0] == 'A1'


def test_search_uses_synonyms_for_categories(bot, shop):
    assert search(bot, q='telephone') == ['S2', 'S1', 'P13', 'P15']
    assert search(bot, q='pc') == ['C1']


def test_search_uses_model_numbers(bot, shop):
    assert search(bot, q='iphone 15') == ['P15']


def test_laptop_wording_does_not_return_phones(bot, shop):
    assert search(bot, q='ordinateur portable') == ['C1']


def test_wireless_wording_is_ignored(bot, shop):
    assert search(bot, q='casque sans fil')[0] == 'A1'


def test_earphones_are_not_mistaken_for_a_router_typo(bot, shop):
    Product.objects.create(reference='R1', name='Routeur Wi-Fi', category=shop['laptop'].category,
                           purchase_price=1, selling_price=30000, quantity=5)
    assert 'R1' not in search(bot, q='ecouteurs')


def test_search_tolerates_typos(bot, shop):
    assert search(bot, q='samsumg') == ['S1']


def test_search_with_budget_filters_by_price(bot, shop):
    assert search(bot, q='telephone', max_price=100000) == ['S2']


def test_empty_result_with_budget_gives_a_hint(bot, shop):
    res = bot.get('/api/chatbot/products/', {'q': 'galaxy', 'max_price': 1000})
    assert res.data['results'] == []
    assert '450 000 FCFA' in res.data['hint']


def test_empty_result_without_match_has_no_hint(bot, shop):
    assert bot.get('/api/chatbot/products/', {'q': 'tablette'}).data['hint'] == ''
