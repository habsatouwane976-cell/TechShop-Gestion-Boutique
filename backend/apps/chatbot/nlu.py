"""Compréhension du langage libre : intention + critères de recherche, sans service externe.

Le client écrit comme il veut (« un casque bluetooth pas cher, max 60 000 »). On en tire
une intention (suivre une commande, livraison, recherche produit...), un budget et les mots
utiles pour chercher dans le catalogue. Tout est déterministe, testable et gratuit ; une IA
générative pourra remplacer `understand` plus tard sans changer le reste du parcours.
"""
import difflib
import re
import unicodedata
from dataclasses import dataclass, field

MAX_MESSAGE_LENGTH = 300
MIN_BUDGET, MAX_BUDGET = 500, 100_000_000
FUZZY_CUTOFF = 0.8
MIN_FUZZY_LENGTH = 4

INVOICE_RE = re.compile(r'\bfac\s?(\d{8})\s?([a-z0-9]{6})\b')
_AMOUNT = r'(?P<num>\d{1,3}(?:[ .,]\d{3})+|\d+)\s*(?P<unit>k|mille|millions?)?'
_BUDGET_WORDS = (r'(?:moins de|moins que|maximum de|maximum|max|jusqu a|jusqu au|sous|budget(?: de| max| maximum)?'
                 r'|pas plus de|inferieur a|au plus|plafond de|plafond)')
BUDGET_RE = re.compile(rf'\b{_BUDGET_WORDS}\s*(?:de\s+)?{_AMOUNT}\b(?:\s*(?:fcfa|cfa|francs?|f)\b)?')
CURRENCY_RE = re.compile(rf'\b{_AMOUNT}\s*(?:fcfa|cfa|francs?)\b')

# Mot courant -> mot-clé cherché dans le nom des catégories (« pc » -> « Ordinateurs portables »).
ALIASES = {
    'telephone': 'smartphone', 'tel': 'smartphone', 'mobile': 'smartphone', 'iphone': 'smartphone',
    'android': 'smartphone', 'smartphone': 'smartphone',
    'ordinateur': 'ordinateur', 'pc': 'ordinateur', 'laptop': 'ordinateur', 'macbook': 'ordinateur',
    'notebook': 'ordinateur',
    'ecouteur': 'ecouteur', 'oreillette': 'ecouteur', 'casque': 'ecouteur', 'airpods': 'ecouteur',
    'enceinte': 'audio', 'speaker': 'audio', 'baffle': 'audio', 'son': 'audio',
    'cable': 'cable', 'chargeur': 'cable', 'adaptateur': 'cable', 'usb': 'cable', 'hdmi': 'cable',
    'souris': 'accessoire', 'clavier': 'accessoire', 'accessoire': 'accessoire',
    'wifi': 'reseau', 'routeur': 'reseau', 'modem': 'reseau', 'box': 'reseau', 'reseau': 'reseau',
    'disque': 'stockage', 'ssd': 'stockage', 'memoire': 'stockage', 'stockage': 'stockage',
    'flash': 'stockage',
}

STOPWORDS = set("""
a au aux avec ce ces cet cette ceci cela ca c d de des du en et il ils elle elles on nous vous je j tu te
me moi toi lui leur leurs mon ma mes ton ta tes son sa ses notre nos votre vos le la les l un une uns unes
ou par pour sans sur sous dans chez que qui quoi quel quels quelle quelles si ne n se s t m y
est es sont suis etes sommes ete avoir ai as avez avons ont aurait faut fait faire peut peux pouvez puis
veux voulez voulais voudrais voudrait souhaite souhaitez aimerais cherche cherchez chercher cherchons
recherche rechercher recherches besoin besoins trouver trouve propose proposer proposez montre montrez montrer
donne donnez donner voir regarder prendre acheter achete commander commande commandes passer finaliser valider
plus moins tres trop assez beaucoup vraiment aussi encore deja toujours tout tous toute toutes
combien coute coutent cout prix tarif tarifs disponible disponibles dispo stock existe exist
bonjour bonsoir salut hello hey coucou salam slt bjr merci svp stp plait s il bye revoir ciao
produit produits article articles chose choses truc
pas cher chere chers economique budget bon marche petit petite gamme
quoi comment pourquoi quand donc alors voila ok oui non peut etre
fcfa cfa franc francs mille millions million
fil annuler annule annulee annulation suivre suivi statut
""".split())

BUY_VERBS = re.compile(
    r'\b(cherch\w*|veux|voudrais?|voulais|souhait\w*|besoin\w*|avez|aimerais|prix|combien|tarif\w*|'
    r'disponibles?|dispo|acheter|commander|recherch\w*|existe|propos\w+)\b')

_GREETING = re.compile(r'\b(bonjour|bonsoir|salut|hello|hey|coucou|salam|slt|bjr)\b')
_THANKS = re.compile(r'\b(merci|thanks|thank you)\b')
_GOODBYE = re.compile(r'\b(au revoir|bye|a bientot|a plus|bonne journee|bonne soiree|ciao)\b')
_MENU = re.compile(r'\b(que (peux|pouvez) (tu|vous) faire|comment (ca )?(marche|fonctionne)|vos options)\b')
_CANCEL = re.compile(r'\bannul\w*')
_TRACK_STRONG = re.compile(
    r'\b(suivre|suivi|statut|ou en est|ou est (ma|mon)|etat de (ma|mon)|colis|avancement)\b')
_TRACK_WEAK = re.compile(r'\b(ma commande|mes commandes|ma livraison|mon achat)\b')
_DELIVERY = re.compile(
    r'\b(livraison|livrer|livrez|livre|livrons|expedition|expedier|delais?|frais de port|retrait|'
    r'retirer|recuperer|venir chercher)\b')
_PAYMENT = re.compile(
    r'\b(paiement|payer|regler|reglement|wave|orange money|especes?|virement|carte bancaire|'
    r'moyens? de paiement|modes? de paiement|cash)\b')
_CONTACT = re.compile(
    r'\b(contact\w*|joindre|appeler|telephoner|conseill\w+|humain|agent|responsable|whatsapp|e mail|'
    r'email|mail|adresse|horaires?|ouvert|ouverture|ou etes vous|ou se trouve|localisation|parler a|'
    r'vendeur)\b')
_CART = re.compile(r'\bpanier\b')
_CHECKOUT = re.compile(r'\b(passer (une |ma |la )?commande|commander|finaliser|valider|acheter|je commande|checkout)\b')
_CATALOG = re.compile(
    r'\b(catalogue|categories?|tous les produits|voir les produits|que vendez|quels produits|quels articles|'
    r'vous vendez|rayons?|nouveautes?|promotions?|promo)\b')
_SMALLTALK = re.compile(r'\b(ca va|comment vas tu|comment allez vous|comment tu vas)\b')
_ABOUT = re.compile(r'\b(qui es tu|qui etes vous|tu es qui|vous etes qui|es tu un robot|etes vous un robot|tu es un robot)\b')
_MENU_WORDS = {'menu', 'aide', 'help', 'options', 'accueil'}


def fold(text):
    """Minuscules, sans accents ni ponctuation (sauf . et , des montants)."""
    text = (text or '').lower()
    text = re.sub(r"[’'`\-]", ' ', text)
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    text = re.sub(r'[^a-z0-9., ]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def words(text):
    return re.findall(r'[a-z0-9]+', fold(text))


def has_close_match(token, candidates):
    """Faute de frappe probable : mot très proche d'un mot connu, avec la même première lettre."""
    same_start = [word for word in candidates if word[:1] == token[:1]]
    return bool(difflib.get_close_matches(token, same_start, n=1, cutoff=FUZZY_CUTOFF))


def stem(token):
    """Singulier approximatif : « ecouteurs » -> « ecouteur »."""
    return token[:-1] if len(token) > 4 and token[-1] in 'sx' else token


def significant_words(text):
    """Mots utiles à une recherche produit : mots vides retirés, numéros de modèle conservés."""
    return [w for w in words(text) if w not in STOPWORDS]


def format_fcfa(amount):
    return f'{int(amount):,}'.replace(',', ' ') + ' FCFA'


@dataclass
class Vocabulary:
    """Mots connus du catalogue (noms de produits, catégories) pour reconnaître les fautes de frappe."""
    words: set = field(default_factory=set)

    def __post_init__(self):
        self.words = {stem(w) for w in self.words}

    @classmethod
    def from_catalog(cls):
        from apps.products.models import Category, Product
        texts = list(Product.objects.filter(is_active=True).values_list('name', flat=True))
        texts += list(Category.objects.filter(is_active=True).values_list('name', flat=True))
        return cls({w for text in texts for w in words(text) if len(w) > 2})

    def knows(self, token):
        stemmed = stem(token)
        if stemmed in self.words or token in ALIASES or stemmed in ALIASES:
            return True
        if len(token) < MIN_FUZZY_LENGTH:
            return False
        return has_close_match(stemmed, self.words)


def _amount(num, unit):
    value = int(re.sub(r'\D', '', num))
    if unit in ('k', 'mille'):
        value *= 1000
    elif unit and unit.startswith('million'):
        value *= 1_000_000
    return value if MIN_BUDGET <= value <= MAX_BUDGET else None


def extract_budget(text):
    """Retourne (montant ou None, texte sans la partie budget)."""
    for pattern in (BUDGET_RE, CURRENCY_RE):
        match = pattern.search(text)
        if match:
            amount = _amount(match.group('num'), match.group('unit'))
            if amount:
                return amount, text[:match.start()] + ' ' + text[match.end():]
    return None, text


def _summary(query, budget):
    parts = [query] if query else ['tous les produits']
    if budget:
        parts.append(f'budget maximum {format_fcfa(budget)}')
    return ', '.join(parts)


def _classify(text, query_tokens, invoice, vocab):
    """Intention selon des règles ordonnées : le plus spécifique d'abord."""
    if _CANCEL.search(text) and (invoice or not query_tokens or re.search(r'\b(commande|achat|livraison)\b', text)):
        return 'cancel_order'
    if invoice or _TRACK_STRONG.search(text):
        return 'track_order'
    if _DELIVERY.search(text):
        return 'delivery_info'
    if _PAYMENT.search(text):
        return 'payment_info'
    if _CONTACT.search(text):
        return 'contact'
    if _CART.search(text):
        return 'cart'
    if _CATALOG.search(text):
        return 'catalog'
    if text in _MENU_WORDS or _MENU.search(text):
        return 'menu'
    if _ABOUT.search(text):
        return 'about'
    if _SMALLTALK.search(text):
        return 'greeting'
    if _TRACK_WEAK.search(text):
        return 'track_order'
    if not query_tokens:
        if _CHECKOUT.search(text):
            return 'checkout'
        if _GOODBYE.search(text):
            return 'goodbye'
        if _THANKS.search(text):
            return 'thanks'
        if _GREETING.search(text):
            return 'greeting'
        return 'unknown'
    if BUY_VERBS.search(text) or any(vocab.knows(token) for token in query_tokens):
        return 'product_search'
    return 'unknown'


def understand(message, vocab):
    """Analyse un message libre. Ne lève jamais d'exception : au pire, intention « unknown »."""
    raw = fold(str(message or '')[:MAX_MESSAGE_LENGTH])
    invoice_match = INVOICE_RE.search(raw)
    invoice = f'FAC-{invoice_match.group(1)}-{invoice_match.group(2).upper()}' if invoice_match else ''
    if invoice_match:
        raw = raw[:invoice_match.start()] + ' ' + raw[invoice_match.end():]
    budget, without_budget = extract_budget(raw)
    tokens = significant_words(without_budget)
    query = ' '.join(tokens)
    intent = _classify(without_budget, tokens, invoice, vocab)
    is_search = intent == 'product_search'
    return {
        'intent': intent,
        'query': query if is_search else '',
        'max_price': budget if is_search else None,
        'invoice_number': invoice,
        'summary': _summary(query, budget) if is_search else '',
    }
