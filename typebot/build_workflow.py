"""Génère le workflow Typebot de l'assistant TechShop (typebot/techshop-chatbot.json).

Usage : python typebot/build_workflow.py
Lit CHATBOT_API_KEY (obligatoire), CHATBOT_API_URL et CHATBOT_SITE_URL dans
l'environnement ou dans ../.env. Le JSON produit contient la clé : il est
ignoré par Git, ne le partagez pas.

Dans les blocs de code Typebot, une variable s'écrit {{nom}} (remplacée par sa
valeur littérale avant exécution). Les variables ne contiennent que du texte ou
des listes de texte : le panier est donc stocké en JSON dans une variable texte.
"""
import json
import os
from pathlib import Path

from flow_lib import Flow
from theme import SETTINGS, build_theme

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT.parent / '.env'

SHOP_NAME = 'TechShop Electronics'
SHOP_PHONE = '+221 00 000 00 00'          # à remplacer par le vrai numéro (voir StoreFooter.jsx)
SHOP_EMAIL = 'contact@techshop-electronics.com'
TVA_RATE = 18                              # identique à Sale.tax_rate côté Django
BUDGETS = [('Moins de 50 000 FCFA', 50000), ('Moins de 150 000 FCFA', 150000),
           ('Moins de 400 000 FCFA', 400000), ('Pas de limite', '')]
PHONE_REGEX = r'^\s*(\+?221|00221)?[\s.-]?(7[05678]|3[03])([\s.-]?\d){7}\s*$'
INVOICE_REGEX = r'^\s*FAC-\d{8}-[A-Za-z0-9]{6}\s*$'

# --- Extraits JavaScript (variables référencées par {{nom}}) -------------
FMT = r"const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';"
CART = "const c = JSON.parse({{panier}} || '[]');"
PRODUCT = ("const p = (x => typeof x === 'string' ? JSON.parse(x) : x)"
           "({{produits}}[Number({{idx}})]);")


def read_env(name, default=''):
    value = os.getenv(name, '')
    if not value and ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding='utf-8').splitlines():
            if line.startswith(f'{name}='):
                value = line.split('=', 1)[1].strip()
    return value or default


def cart_totals(f, group):
    """Recalcule les variables du panier (à appeler après chaque modification)."""
    f.set_var(group, 'panier_count', code=f"{CART} return String(c.reduce((n, x) => n + x.qty, 0));")
    f.set_var(group, 'panier_resume', code=(
        f"{CART} {FMT} return c.map(x => x.qty + ' x ' + x.nom + ' : ' + fmt(x.prix * x.qty)).join('\\n');"))
    f.set_var(group, 'panier_totaux', code=(
        f"{CART} {FMT} const ht = c.reduce((s, x) => s + x.prix * x.qty, 0); "
        f"const ttc = Math.round(ht * (100 + {TVA_RATE}) / 100); "
        "return 'Sous-total HT : ' + fmt(ht) + '\\nTVA (" + str(TVA_RATE) + " %) : ' + fmt(ttc - ht) "
        "+ '\\n**Total TTC : ' + fmt(ttc) + '**';"))
    f.set_var(group, 'panier_labels', code=f"{CART} return c.map(x => x.qty + ' x ' + x.nom);")


def product_fields(f, group):
    """Charge dans des variables simples le produit courant (indice idx)."""
    fields = {
        'p_id': 'String(p.id)', 'p_nom': 'p.name', 'p_prix': 'p.price_display',
        'p_prix_num': 'String(p.price)', 'p_image': 'p.image',
        'p_stock': 'String(p.stock)',
        'p_info': "[p.category, p.description && p.description !== p.name ? p.description : ''].filter(Boolean).join(' - ')",
        'p_dispo': "p.stock <= 3 ? 'Plus que ' + p.stock + ' en stock' : 'En stock'",
        'p_pos': "(Number({{idx}}) + 1) + ' sur ' + {{nb}}",
    }
    for name, expression in fields.items():
        f.set_var(group, name, code=f'{PRODUCT} return {expression};')


def build():
    f = Flow(read_env('CHATBOT_API_KEY'))
    site = read_env('CHATBOT_SITE_URL', 'http://localhost:5173')
    f.var('api_url', read_env('CHATBOT_API_URL', 'http://host.docker.internal:8000'))
    f.var('site_url', site)
    f.var('nom')          # préremplis par le widget quand le client est connecté
    f.var('telephone')
    f.start_target = 'Accueil'
    y = 0

    # --- Accueil et menu -------------------------------------------------
    g = f.group('Accueil', 0, 0)
    f.branch(g, [('nom', 'Is set', None, 'Accueil - connu')], 'Accueil - inconnu')
    g = f.group('Accueil - inconnu', 300, -120)
    f.say(g, f'Bonjour et bienvenue chez {SHOP_NAME}.')
    f.say(g, 'Je peux vous aider à choisir un produit, passer commande ou suivre une livraison.', then='Menu')
    g = f.group('Accueil - connu', 300, 120)
    f.say(g, f'Bonjour {{{{nom}}}}, bienvenue chez {SHOP_NAME}.')
    f.say(g, 'Je peux vous aider à choisir un produit, passer commande ou suivre une livraison.', then='Menu')

    g = f.group('Menu', 700, 0)
    f.say(g, 'Que souhaitez-vous faire ?')
    f.buttons(g, [
        ('Voir les produits', 'Catalogue - catégories'),
        ('Rechercher un produit', 'Recherche - saisie'),
        ('Mon panier', 'Panier - voir'),
        ('Suivre ou annuler une commande', 'Suivi - numéro'),
        ('Livraison, paiement, contact', 'Infos - menu'),
    ])

    # --- Catalogue -------------------------------------------------------
    g = f.group('Catalogue - catégories', 1100, -300)
    f.set_var(g, 'recherche_q', empty=True)
    f.http(g, 'GET', '{{api_url}}/api/chatbot/categories/', [
        ('cat_noms', 'data.results.length ? ["Tous les produits"].concat(data.results.map(c => c.name + " (" + c.available + ")")) : []'),
        ('cat_ids', 'data.results.length ? [""].concat(data.results.map(c => String(c.id))) : []'),
    ])
    f.branch(g, [('cat_noms', 'Is empty', None, 'Erreur - indisponible')], 'Catalogue - choix')

    g = f.group('Catalogue - choix', 1500, -300)
    f.say(g, 'Quelle catégorie vous intéresse ?')
    f.dynamic_buttons(g, 'cat_choix', 'cat_noms')
    f.add(g, {'type': 'Set variable', 'options': {
        'variableId': f.var('cat_id'), 'type': 'Map item with same index',
        'mapListItemParams': {'baseItemVariableId': f.var('cat_choix'),
                              'baseListVariableId': f.var('cat_noms'),
                              'targetListVariableId': f.var('cat_ids')}}})
    f.say(g, 'Quel est votre budget ?')
    f.buttons(g, [(label, 'Catalogue - budget') for label, _ in BUDGETS], var='budget_choix')

    g = f.group('Catalogue - budget', 1900, -300)
    mapping = json.dumps({label: str(value) for label, value in BUDGETS}, ensure_ascii=False)
    f.set_var(g, 'budget', code=f'return ({mapping})[{{{{budget_choix}}}}] || "";', then='Produits - chargement')

    # --- Recherche -------------------------------------------------------
    g = f.group('Recherche - saisie', 1100, 0)
    f.say(g, 'Quel produit cherchez-vous ? Par exemple : casque, Samsung, chargeur.')
    f.ask(g, 'recherche', 'Nom ou type de produit...', button='Rechercher')
    f.set_var(g, 'cat_id', empty=True)
    f.set_var(g, 'budget', empty=True)
    f.set_var(g, 'recherche_q', code='return encodeURIComponent({{recherche}});', then='Produits - chargement')

    # --- Liste et fiche produit -----------------------------------------
    g = f.group('Produits - chargement', 2300, -150)
    f.set_var(g, 'nb', text='0')
    f.http(g, 'GET', '{{api_url}}/api/chatbot/products/?category={{cat_id}}&max_price={{budget}}&q={{recherche_q}}', [
        ('produits', 'data.results'), ('nb', 'String(data.count)'),
    ])
    f.branch(g, [('nb', 'Equal to', '0', 'Produits - aucun')], 'Produits - début')

    g = f.group('Produits - aucun', 2700, -300)
    f.say(g, "Aucun produit disponible ne correspond à votre demande.")
    f.buttons(g, [('Rechercher autre chose', 'Recherche - saisie'),
                  ('Voir les catégories', 'Catalogue - catégories'), ('Retour au menu', 'Menu')])

    g = f.group('Produits - début', 2700, -100)
    f.set_var(g, 'idx', text='0', then='Fiche produit')

    g = f.group('Fiche produit', 3100, -100)
    product_fields(f, g)
    f.image(g, '{{p_image}}')
    f.say(g, '**{{p_nom}}**\n{{p_prix}}\n{{p_info}}\n{{p_dispo}}  |  Produit {{p_pos}}')
    f.buttons(g, [('Ajouter au panier', 'Panier - quantité'), ('Produit suivant', 'Navigation - suivant'),
                  ('Produit précédent', 'Navigation - précédent'), ('Voir mon panier', 'Panier - voir'),
                  ('Retour au menu', 'Menu')])

    g = f.group('Navigation - suivant', 3100, 250)
    f.set_var(g, 'idx', code='return String((Number({{idx}}) + 1) % Number({{nb}}));', then='Fiche produit')
    g = f.group('Navigation - précédent', 3100, 400)
    f.set_var(g, 'idx', code='return String((Number({{idx}}) + Number({{nb}}) - 1) % Number({{nb}}));',
              then='Fiche produit')

    # --- Panier ----------------------------------------------------------
    g = f.group('Panier - quantité', 3500, -100)
    f.say(g, 'Quelle quantité souhaitez-vous ?')
    f.ask_number(g, 'qty', 'Quantité')
    f.set_var(g, 'qty_ok', code='return Number({{qty}}) >= 1 && Number({{qty}}) <= Number({{p_stock}}) ? "oui" : "";')
    f.branch(g, [('qty_ok', 'Is empty', None, 'Panier - quantité trop grande')], 'Panier - ajout')

    g = f.group('Panier - quantité trop grande', 3500, 150)
    f.say(g, 'Il ne reste que {{p_stock}} exemplaire(s) de ce produit en stock.', then='Panier - quantité')

    g = f.group('Panier - ajout', 3900, -100)
    f.set_var(g, 'ajout_cap', code=(
        f"{CART} const i = c.findIndex(x => x.id === Number({{{{p_id}}}})); "
        'return i >= 0 && c[i].qty + Number({{qty}}) > Number({{p_stock}}) ? "oui" : "";'))
    f.set_var(g, 'panier', code=(
        f"{CART} const id = Number({{{{p_id}}}}); const stock = Number({{{{p_stock}}}}); "
        'const q = Number({{qty}}); const i = c.findIndex(x => x.id === id); '
        'if (i >= 0) { c[i].qty = Math.min(c[i].qty + q, stock); } '
        'else { c.push({id: id, nom: {{p_nom}}, prix: Number({{p_prix_num}}), qty: q}); } '
        'return JSON.stringify(c);'))
    cart_totals(f, g)
    f.say(g, '**{{p_nom}}** a été ajouté à votre panier.')
    f.branch(g, [('ajout_cap', 'Is set', None, 'Panier - ajout plafonné')], 'Panier - après ajout')

    g = f.group('Panier - ajout plafonné', 4300, -250)
    f.say(g, "La quantité a été limitée au stock disponible.", then='Panier - après ajout')

    g = f.group('Panier - après ajout', 4300, -50)
    f.say(g, 'Votre panier contient {{panier_count}} article(s).')
    f.buttons(g, [('Continuer mes achats', 'Fiche produit'), ('Commander maintenant', 'Commande - identité'),
                  ('Voir mon panier', 'Panier - voir')])

    g = f.group('Panier - voir', 700, 450)
    cart_totals(f, g)
    f.branch(g, [('panier_count', 'Equal to', '0', 'Panier - vide')], 'Panier - contenu')

    g = f.group('Panier - vide', 1100, 600)
    f.say(g, "Votre panier est vide pour le moment.")
    f.buttons(g, [('Voir les produits', 'Catalogue - catégories'), ('Rechercher un produit', 'Recherche - saisie'),
                  ('Retour au menu', 'Menu')])

    g = f.group('Panier - contenu', 1100, 400)
    f.say(g, '**Votre panier**\n{{panier_resume}}\n\n{{panier_totaux}}')
    f.buttons(g, [('Passer commande', 'Commande - identité'), ('Retirer un article', 'Panier - retirer'),
                  ('Vider le panier', 'Panier - vider'), ('Continuer mes achats', 'Menu')])

    g = f.group('Panier - retirer', 1500, 400)
    f.say(g, 'Quel article souhaitez-vous retirer ?')
    f.dynamic_buttons(g, 'retrait', 'panier_labels')
    f.set_var(g, 'panier', code=(
        f"{CART} const labels = {{{{panier_labels}}}}; "
        'return JSON.stringify(c.filter((x, i) => labels[i] !== {{retrait}}));'), then='Panier - voir')

    g = f.group('Panier - vider', 1500, 650)
    f.set_var(g, 'panier', text='[]')
    f.say(g, 'Votre panier a été vidé.', then='Autre chose')

    # --- Commande --------------------------------------------------------
    g = f.group('Commande - identité', 700, 900)
    f.branch(g, [('nom', 'Is empty', None, 'Commande - nom')], 'Commande - téléphone')
    g = f.group('Commande - nom', 1100, 800)
    f.say(g, "Pour finaliser votre commande, j'ai besoin de quelques informations.")
    f.say(g, 'Quel est votre nom complet ?')
    f.ask(g, 'nom', 'Prénom et nom...', then='Commande - téléphone')

    g = f.group('Commande - téléphone', 1500, 900)
    f.set_var(g, 'retour', text='commande')
    f.branch(g, [('telephone', 'Is empty', None, 'Téléphone - demander')], 'Commande - mode')

    g = f.group('Téléphone - demander', 1900, 800)
    f.say(g, 'Quel est votre numéro de téléphone ? Par exemple : 77 123 45 67.')
    f.ask(g, 'telephone', 'Numéro de téléphone...')
    f.branch(g, [('telephone', 'Does not match regex', PHONE_REGEX, 'Téléphone - invalide')], 'Téléphone - suite')

    g = f.group('Téléphone - invalide', 1900, 1000)
    f.say(g, "Ce numéro ne semble pas valide. Il doit comporter 9 chiffres, par exemple 77 123 45 67.")
    f.set_var(g, 'telephone', empty=True, then='Téléphone - demander')

    g = f.group('Téléphone - suite', 2300, 800)
    f.branch(g, [('retour', 'Equal to', 'commande', 'Commande - mode')], 'Suivi - recherche')

    g = f.group('Commande - mode', 2700, 900)
    f.say(g, 'Comment souhaitez-vous recevoir votre commande ?')
    f.buttons(g, [('Livraison à domicile', 'Commande - mode choisi'),
                  ('Retrait en boutique', 'Commande - mode choisi')], var='mode_choix')
    g = f.group('Commande - mode choisi', 3100, 900)
    f.set_var(g, 'mode', code='return {{mode_choix}} === "Livraison à domicile" ? "delivery" : "store";')
    f.branch(g, [('mode', 'Equal to', 'delivery', 'Commande - adresse')], 'Commande - sans adresse')

    g = f.group('Commande - sans adresse', 3500, 1050)
    f.set_var(g, 'adresse', empty=True, then='Commande - paiement')

    g = f.group('Commande - adresse', 3500, 800)
    f.say(g, 'Indiquez votre adresse de livraison : quartier, rue et un repère proche.')
    f.ask(g, 'adresse', 'Adresse de livraison...', long=True)
    f.branch(g, [('adresse', 'Does not match regex', r'^[\s\S]{6,}$', 'Commande - adresse trop courte')],
             'Commande - paiement')
    g = f.group('Commande - adresse trop courte', 3500, 650)
    f.say(g, "Cette adresse est trop courte. Ajoutez le quartier et un repère.", then='Commande - adresse')

    g = f.group('Commande - paiement', 3900, 900)
    f.say(g, 'Comment souhaitez-vous payer ?')
    f.buttons(g, [('Espèces à la livraison ou au retrait', 'Commande - paiement choisi'),
                  ('Wave', 'Commande - paiement choisi'), ('Orange Money', 'Commande - paiement choisi')],
              var='paiement_choix')
    g = f.group('Commande - paiement choisi', 4300, 900)
    f.set_var(g, 'paiement', code=(
        'return {{paiement_choix}} === "Wave" ? "wave" : '
        '{{paiement_choix}} === "Orange Money" ? "orange_money" : "cash";'))
    cart_totals(f, g)
    f.set_var(g, 'commande_items', code=(
        CART + ' return JSON.stringify(c.map(x => ({product_id: x.id, quantity: x.qty})));'))
    f.set_var(g, 'recap_lieu', code=(
        'return {{mode}} === "delivery" ? "Livraison à : " + {{adresse}} : "Retrait en boutique";'), then='Commande - récapitulatif')

    g = f.group('Commande - récapitulatif', 4700, 900)
    f.say(g, "**Récapitulatif de votre commande**\n{{panier_resume}}\n\n{{panier_totaux}}")
    f.say(g, "Client : {{nom}}\nTéléphone : {{telephone}}\n{{recap_lieu}}\nPaiement : {{paiement_choix}}")
    f.say(g, 'Confirmez-vous cette commande ?')
    f.buttons(g, [('Confirmer la commande', 'Commande - envoi'), ('Corriger mes informations', 'Commande - corriger'),
                  ('Modifier le panier', 'Panier - voir'), ('Annuler', 'Menu')])

    g = f.group('Commande - corriger', 4700, 1200)
    f.set_var(g, 'nom', empty=True)
    f.set_var(g, 'telephone', empty=True, then='Commande - identité')

    g = f.group('Commande - envoi', 5100, 900)
    for name in ('commande_numero', 'commande_total', 'erreur'):
        f.set_var(g, name, empty=True)
    body = ('{\n  "name": "{{nom}}",\n  "phone": "{{telephone}}",\n  "delivery_mode": "{{mode}}",\n'
            '  "payment_method": "{{paiement}}",\n  "address": "{{adresse}}",\n  "items": "{{commande_items}}"\n}')
    f.http(g, 'POST', '{{api_url}}/api/chatbot/orders/', [
        ('commande_numero', 'data.invoice_number'), ('commande_total', 'data.total_display'),
        ('erreur', 'data.error'),
    ], body=body)
    f.branch(g, [('commande_numero', 'Is empty', None, 'Commande - échec')], 'Commande - confirmée')

    g = f.group('Commande - confirmée', 5500, 800)
    f.set_var(g, 'suite', code=(
        'return {{mode}} === "delivery" '
        '? "Notre équipe vous appellera au " + {{telephone}} + " pour organiser la livraison et confirmer le paiement." '
        ': "Nous vous appellerons au " + {{telephone}} + " dès que votre commande est prête à retirer en boutique.";'))
    f.set_var(g, 'panier', text='[]')
    f.say(g, 'Votre commande est enregistrée.')
    f.say(g, '**Numéro de commande : {{commande_numero}}**\nTotal TTC : {{commande_total}}\n\n'
             'Conservez ce numéro, il vous permet de suivre ou d\'annuler votre commande ici.')
    f.say(g, '{{suite}}', then='Autre chose')

    g = f.group('Commande - échec', 5500, 1050)
    f.set_var(g, 'erreur', code='return {{erreur}} || "Le service est momentanément indisponible.";')
    f.say(g, "Je n'ai pas pu enregistrer votre commande.\n{{erreur}}\nAucun montant n'a été débité et votre panier est conservé.")
    f.buttons(g, [('Réessayer', 'Commande - envoi'), ('Modifier mon panier', 'Panier - voir'),
                  ('Retour au menu', 'Menu')])

    # --- Suivi et annulation --------------------------------------------
    g = f.group('Suivi - numéro', 700, 1500)
    f.say(g, 'Indiquez votre numéro de commande. Il ressemble à FAC-20261026-AB12CD.')
    f.ask(g, 'num_cmd', 'FAC-XXXXXXXX-XXXXXX', button='Valider')
    f.branch(g, [('num_cmd', 'Does not match regex', INVOICE_REGEX, 'Suivi - format invalide')], 'Suivi - téléphone')

    g = f.group('Suivi - format invalide', 1100, 1650)
    f.say(g, "Ce numéro n'a pas le bon format. Il commence par FAC- suivi de la date et de 6 caractères.")
    f.buttons(g, [('Réessayer', 'Suivi - numéro'), ('Retour au menu', 'Menu')])

    g = f.group('Suivi - téléphone', 1100, 1500)
    f.set_var(g, 'retour', text='suivi')
    f.branch(g, [('telephone', 'Is empty', None, 'Téléphone - demander')], 'Suivi - recherche')

    g = f.group('Suivi - recherche', 2700, 1500)
    for name in ('suivi_statut', 'suivi_annulable', 'erreur'):
        f.set_var(g, name, empty=True)
    f.http(g, 'GET', '{{api_url}}/api/chatbot/orders/{{num_cmd}}/?phone={{telephone}}', [
        ('suivi_statut', 'data.status_display'), ('suivi_livraison', 'data.delivery_status_display'),
        ('suivi_paiement', 'data.payment_method_display'), ('suivi_total', 'data.total_display'),
        ('suivi_lignes', 'data.lines'), ('suivi_date', 'data.date'),
        ('suivi_annulable', 'data.can_cancel ? "oui" : ""'),
    ])
    f.branch(g, [('suivi_statut', 'Is empty', None, 'Suivi - introuvable')], 'Suivi - résultat')

    g = f.group('Suivi - introuvable', 3100, 1700)
    f.say(g, "Aucune commande ne correspond à ce numéro et à ce téléphone.")
    f.buttons(g, [('Réessayer', 'Suivi - numéro'), ('Utiliser un autre numéro de téléphone', 'Suivi - autre téléphone'),
                  ('Retour au menu', 'Menu')])
    g = f.group('Suivi - autre téléphone', 3500, 1700)
    f.set_var(g, 'telephone', empty=True, then='Suivi - numéro')

    g = f.group('Suivi - résultat', 3100, 1500)
    f.say(g, '**Commande {{num_cmd}}**\nPassée le {{suivi_date}}')
    f.say(g, 'Statut : **{{suivi_statut}}**\nLivraison : {{suivi_livraison}}\nPaiement : {{suivi_paiement}}')
    f.say(g, 'Articles :\n{{suivi_lignes}}\n\nTotal TTC : **{{suivi_total}}**')
    f.branch(g, [('suivi_annulable', 'Is set', None, 'Suivi - actions')], 'Autre chose')

    g = f.group('Suivi - actions', 3500, 1500)
    f.say(g, 'Cette commande est encore en attente : vous pouvez l\'annuler.')
    f.buttons(g, [('Annuler cette commande', 'Annulation - confirmer'), ('Retour au menu', 'Menu')])

    g = f.group('Annulation - confirmer', 3900, 1500)
    f.say(g, 'Voulez-vous vraiment annuler la commande {{num_cmd}} ? Les articles seront remis en stock.')
    f.buttons(g, [('Oui, annuler la commande', 'Annulation - envoi'), ('Non, la conserver', 'Autre chose')])

    g = f.group('Annulation - envoi', 4300, 1500)
    f.set_var(g, 'annul_statut', empty=True)
    f.set_var(g, 'erreur', empty=True)
    f.http(g, 'POST', '{{api_url}}/api/chatbot/orders/{{num_cmd}}/cancel/', [
        ('annul_statut', 'data.status_display'), ('erreur', 'data.error'),
    ], body='{\n  "phone": "{{telephone}}"\n}')
    f.branch(g, [('annul_statut', 'Equal to', 'Annulée', 'Annulation - faite')], 'Annulation - refusée')

    g = f.group('Annulation - faite', 4700, 1450)
    f.say(g, 'La commande {{num_cmd}} est annulée.', then='Autre chose')
    g = f.group('Annulation - refusée', 4700, 1650)
    f.set_var(g, 'erreur', code='return {{erreur}} || "Le service est momentanément indisponible.";')
    f.say(g, "L'annulation n'a pas pu être effectuée.\n{{erreur}}", then='Autre chose')

    # --- Informations pratiques -----------------------------------------
    g = f.group('Infos - menu', 700, 2000)
    f.say(g, 'Quelle information recherchez-vous ?')
    f.buttons(g, [('Livraison et retrait', 'Infos - livraison'), ('Moyens de paiement', 'Infos - paiement'),
                  ('Contacter la boutique', 'Infos - contact'), ('Retour au menu', 'Menu')])
    g = f.group('Infos - livraison', 1100, 1900)
    f.say(g, "Deux options à la commande : la livraison à domicile ou le retrait en boutique. "
             "Les frais et le délai de livraison sont confirmés par notre équipe selon votre adresse.",
          then='Autre chose')
    g = f.group('Infos - paiement', 1100, 2050)
    f.say(g, "Vous pouvez payer en espèces à la livraison ou au retrait, par Wave ou par Orange Money. "
             "Le paiement est confirmé avec notre équipe après l'enregistrement de votre commande.",
          then='Autre chose')
    g = f.group('Infos - contact', 1100, 2200)
    f.say(g, f'**{SHOP_NAME}**, Dakar, Sénégal\nTéléphone : {SHOP_PHONE}\nE-mail : {SHOP_EMAIL}\n'
             'Boutique en ligne : {{site_url}}', then='Autre chose')

    # --- Erreurs et fin --------------------------------------------------
    g = f.group('Erreur - indisponible', 1100, 2500)
    f.say(g, "Le catalogue est momentanément indisponible. Réessayez dans quelques minutes "
             f"ou appelez-nous au {SHOP_PHONE}.", then='Autre chose')

    g = f.group('Autre chose', 6000, 400)
    f.say(g, 'Puis-je vous aider pour autre chose ?')
    f.buttons(g, [('Oui, retour au menu', 'Menu'), ('Non, merci', 'Au revoir')])
    g = f.group('Au revoir', 6400, 400)
    f.say(g, f'Merci de votre visite chez {SHOP_NAME}. À bientôt.')

    return f.export('Assistant TechShop', build_theme(site), SETTINGS)


if __name__ == '__main__':
    if not read_env('CHATBOT_API_KEY'):
        raise SystemExit("CHATBOT_API_KEY introuvable (variable d'environnement ou .env racine).")
    output = ROOT / 'techshop-chatbot.json'
    output.write_text(json.dumps(build(), ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Workflow écrit dans {output}')
