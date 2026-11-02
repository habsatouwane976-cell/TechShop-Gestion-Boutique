"""Accueil en langage libre : le client écrit, l'API `understand` détermine l'intention, le bot route.

Chaque message passe par `Hub - saisie`. Les parcours à boutons (catalogue, panier, commande...)
restent disponibles comme raccourcis (« menu »), et chacun propose un retour vers la saisie libre.
"""

COUNT_CART = ("const c = JSON.parse({{panier}} || '[]'); "
              "return String(c.reduce((n, x) => n + x.qty, 0));")

# intention renvoyée par l'API -> groupe Typebot
ROUTES = [
    ('product_search', 'Hub - recherche'),
    ('catalog', 'Catalogue - catégories'),
    ('cart', 'Panier - voir'),
    ('checkout', 'Hub - commande'),
    ('track_order', 'Hub - suivi'),
    ('cancel_order', 'Hub - annulation'),
    ('delivery_info', 'Infos - livraison'),
    ('payment_info', 'Infos - paiement'),
    ('contact', 'Infos - contact'),
    ('menu', 'Menu'),
    ('greeting', 'Hub - bonjour'),
    ('about', 'Hub - présentation'),
    ('thanks', 'Hub - merci'),
    ('goodbye', 'Au revoir'),
    ('unknown', 'Hub - incompris'),
    ('erreur', 'Erreur - indisponible'),
]


def add_hub(f, shop_name):
    f.var('message')
    g = f.group('Hub - invite', 700, -700)
    f.say(g, 'Que puis-je faire pour vous ? Écrivez votre demande.', then='Hub - saisie')

    g = f.group('Hub - saisie', 1100, -700)
    f.ask(g, 'message', 'Écrivez votre demande...', button='Envoyer')
    for name in ('nlu_q', 'nlu_max', 'nlu_invoice', 'nlu_resume'):
        f.set_var(g, name, empty=True)
    f.set_var(g, 'intent', text='erreur')     # reste « erreur » si l'analyse n'aboutit pas
    f.http(g, 'POST', '{{api_url}}/api/chatbot/understand/', [
        ('intent', 'data && data.intent ? data.intent : "erreur"'),
        ('nlu_q', 'data && data.query ? data.query : ""'),
        ('nlu_max', 'data && data.max_price ? String(data.max_price) : ""'),
        ('nlu_invoice', 'data && data.invoice_number ? data.invoice_number : ""'),
        ('nlu_resume', 'data && data.summary ? data.summary : ""'),
    ], body='{\n  "message": "{{message}}"\n}')
    f.branch(g, [('intent', 'Equal to', intent, target) for intent, target in ROUTES], 'Hub - incompris')

    # --- Recherche produit --------------------------------------------------
    g = f.group('Hub - recherche', 1500, -1000)
    f.say(g, 'Je recherche : {{nlu_resume}}.')
    f.set_var(g, 'cat_id', empty=True)
    f.set_var(g, 'budget', text='{{nlu_max}}')
    f.set_var(g, 'recherche_q', code='return encodeURIComponent({{nlu_q}});', then='Produits - chargement')

    g = f.group('Hub - recherche brute', 1500, -850)
    f.set_var(g, 'cat_id', empty=True)
    f.set_var(g, 'budget', empty=True)
    f.set_var(g, 'recherche_q', code='return encodeURIComponent({{message}});', then='Produits - chargement')

    # --- Commande, suivi, annulation ----------------------------------------
    g = f.group('Hub - commande', 1500, -700)
    f.set_var(g, 'panier_count', code=COUNT_CART)
    f.branch(g, [('panier_count', 'Equal to', '0', 'Panier - vide')], 'Commande - identité')

    g = f.group('Hub - annulation', 1500, -550)
    f.say(g, "Je vais d'abord retrouver votre commande ; l'annulation vous sera proposée si elle est encore possible.",
          then='Hub - suivi')
    g = f.group('Hub - suivi', 1900, -550)
    f.set_var(g, 'num_cmd', text='{{nlu_invoice}}')
    f.branch(g, [('nlu_invoice', 'Is empty', None, 'Suivi - numéro')], 'Suivi - téléphone')

    # --- Conversation -------------------------------------------------------
    g = f.group('Hub - bonjour', 1500, -400)
    f.say(g, 'Bonjour, comment puis-je vous aider ?', then='Hub - saisie')
    g = f.group('Hub - présentation', 1500, -250)
    f.say(g, f"Je suis l'assistant de {shop_name}. Je peux vous aider à trouver un produit, "
             "enregistrer une commande, et suivre ou annuler une commande déjà passée.", then='Hub - saisie')
    g = f.group('Hub - merci', 1500, -100)
    f.say(g, "Avec plaisir. N'hésitez pas si vous avez une autre question.", then='Hub - saisie')

    g = f.group('Hub - incompris', 1500, 50)
    f.say(g, "Je n'ai pas bien compris votre demande. Vous pouvez écrire par exemple : "
             "« un casque à moins de 50 000 FCFA », « où en est ma commande ? » ou « frais de livraison ».")
    f.buttons(g, [('Chercher dans le catalogue', 'Hub - recherche brute'), ('Voir le menu', 'Menu'),
                  ('Parler à la boutique', 'Infos - contact'), ('Reformuler', 'Hub - invite')])
