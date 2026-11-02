"""Recherche de produits tolérante : accents, pluriels, synonymes, fautes de frappe, plusieurs mots."""
from apps.products.models import Product

from .nlu import ALIASES, MIN_FUZZY_LENGTH, fold, format_fcfa, has_close_match, stem

DEFAULT_LIMIT = 12
SHORT_WORD = 3
SCORE_NAME, SCORE_CATEGORY, SCORE_DETAILS, SCORE_FUZZY = 3, 2, 1, 1.5


def _token_score(token, product):
    """Pertinence d'un mot pour un produit : nom > catégorie > description > faute de frappe."""
    root = stem(token)
    in_name = root in product['name_words'] if len(root) <= SHORT_WORD else root in product['name']
    if in_name:
        return SCORE_NAME
    alias = ALIASES.get(token) or ALIASES.get(root)
    if (alias and alias in product['category']) or (len(root) > SHORT_WORD and root in product['category']):
        return SCORE_CATEGORY
    if len(root) > SHORT_WORD and root in product['details']:
        return SCORE_DETAILS
    if len(token) >= MIN_FUZZY_LENGTH:
        known = product['name_words'] | product['category_words']
        if has_close_match(root, known):
            return SCORE_FUZZY
    return 0


def _index(product):
    name = fold(product.name)
    category = fold(product.category.name) if product.category_id else ''
    return {
        'product': product,
        'name': name,
        'name_words': {stem(w) for w in name.split()},
        'category': category,
        'category_words': {stem(w) for w in category.split()},
        'details': f'{fold(product.description)} {fold(product.reference)}',
    }


def _available(category_id=None, max_price=None):
    products = Product.objects.select_related('category').filter(is_active=True, quantity__gt=0)
    if category_id:
        products = products.filter(category_id=category_id)
    if max_price:
        products = products.filter(selling_price__lte=max_price)
    return products


def search_products(tokens, category_id=None, max_price=None, limit=DEFAULT_LIMIT):
    """Produits en stock triés par pertinence puis par prix croissant."""
    products = list(_available(category_id, max_price))
    if not tokens:
        return sorted(products, key=lambda p: (p.selling_price, p.name))[:limit]
    scored = []
    for product in products:
        indexed = _index(product)
        scores = [_token_score(token, indexed) for token in tokens]
        matched = sum(1 for score in scores if score)
        if matched:
            scored.append((matched, sum(scores), product))
    if not scored:
        return []
    best = max(matched for matched, _, _ in scored)
    ranked = [item for item in scored if item[0] == best]
    ranked.sort(key=lambda item: (-item[1], item[2].selling_price, item[2].name))
    return [product for _, _, product in ranked][:limit]


def budget_hint(tokens, category_id, max_price):
    """Phrase d'aide quand le budget exclut tout : indique le prix d'entrée réel."""
    if not (max_price and tokens):
        return ''
    cheapest = search_products(tokens, category_id, None, limit=DEFAULT_LIMIT)
    if not cheapest:
        return ''
    lowest = min(product.selling_price for product in cheapest)
    return f'Les produits correspondants commencent à {format_fcfa(lowest)}.'

