"""Test de bout en bout : un faux client discute avec le bot publié (viewer Typebot -> API Django).

Prérequis : pile Typebot lancée, bot chargé (load_workflow.py), backend Django joignable
depuis Typebot, et CHATBOT_API_KEY présent dans ../.env (pour contrôler la base).
Usage : python typebot/e2e_test.py [-v]
Les commandes créées sont réelles (stock décrémenté puis restauré par l'annulation).
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

VIEWER = 'http://localhost:8091'
PUBLIC_ID = 'techshop-assistant'
API = os.getenv('CHATBOT_E2E_API', 'http://localhost:8000')   # URL du backend vue depuis votre PC
ENV_FILE = Path(__file__).resolve().parent.parent / '.env'
VERBOSE = '-v' in sys.argv


def post(url, payload):
    request = urllib.request.Request(
        url, json.dumps(payload).encode(), {'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(request, timeout=60))
    except urllib.error.HTTPError as error:
        raise AssertionError(f'HTTP {error.code} sur {url} : {error.read().decode()[:300]}')


def plain(content):
    # Typebot aplatit un paragraphe réduit à un seul texte en gras : {"bold": true, "text": ...}
    return '\n'.join(
        p['text'] if 'text' in p else ''.join(c.get('text', '') for c in p.get('children', []))
        for p in content.get('richText', []))


class Chat:
    """Une session de conversation ; `output` regroupe tout ce que le bot a dit depuis le dernier envoi."""

    def __init__(self, prefilled=None):
        reply = post(f'{VIEWER}/api/v1/typebots/{PUBLIC_ID}/startChat',
                     {'isOnlyRegistering': False, 'prefilledVariables': prefilled or {}})
        self.session = reply['sessionId']
        self._absorb(reply)

    def _absorb(self, reply):
        self.texts, self.images = [], []
        for message in reply.get('messages', []):
            if message['type'] == 'text':
                self.texts.append(plain(message['content']))
            elif message['type'] == 'image':
                self.images.append(message['content'].get('url', ''))
        self.input = reply.get('input') or {}
        self.choices = [item.get('content', '') for item in self.input.get('items', [])]
        if VERBOSE:
            print('   bot  :', ' | '.join(self.texts).replace('\n', ' / ')[:300])
            print('   image:', self.images, ' choix:', self.choices)

    @property
    def output(self):
        return '\n'.join(self.texts)

    def send(self, message):
        if VERBOSE:
            print(f' > client : {message}')
        self._absorb(post(f'{VIEWER}/api/v1/sessions/{self.session}/continueChat', {'message': message}))
        return self

    def click(self, label):
        """Clique sur le bouton dont le libellé contient `label`."""
        matches = [c for c in self.choices if label.lower() in c.lower()]
        assert matches, f'Bouton « {label} » absent. Boutons : {self.choices}\nBot : {self.output}'
        return self.send(matches[0])

    def expect(self, *fragments):
        for fragment in fragments:
            assert fragment in self.output, f'« {fragment} » absent de la réponse :\n{self.output}'
        return self


def django_check(path, key):
    request = urllib.request.Request(f'{API}{path}', headers={'X-Chatbot-Key': key})
    return json.load(urllib.request.urlopen(request, timeout=30))


def read_key():
    for line in ENV_FILE.read_text(encoding='utf-8').splitlines():
        if line.startswith('CHATBOT_API_KEY='):
            return line.split('=', 1)[1].strip()
    raise SystemExit('CHATBOT_API_KEY introuvable dans ../.env')


def stock_of(key, product_name):
    for product in django_check(f'/api/chatbot/products/?q={urllib.request.quote(product_name)}', key)['results']:
        if product['name'] == product_name:
            return product['stock']
    return 0


def product_name(chat):
    """Nom du produit affiché dans la dernière fiche (première ligne, sans le gras)."""
    return chat.texts[-1].splitlines()[0].strip()


def checkout_as_guest(chat):
    """Du panier à la confirmation : livraison, adresse, Wave. Retourne le numéro de commande."""
    chat.click('Commander maintenant').expect('nom complet')
    chat.send("Awa \"Aïsha\" N'Diaye").expect('téléphone')
    chat.send('12 34').expect('ne semble pas valide')
    chat.send('77 123 45 67').expect('recevoir votre commande')
    chat.click('Livraison').expect('adresse de livraison')
    chat.send('abc').expect('trop courte')
    chat.send('Sicap Liberté 6, villa 12, face pharmacie').expect('payer')
    chat.click('Wave').expect('Récapitulatif', 'Total TTC', 'Livraison à : Sicap')
    chat.click('Confirmer').expect('Votre commande est enregistrée', 'FAC-')
    return re.search(r'FAC-\d{8}-[A-Z0-9]{6}', chat.output).group(0)


def scenario_free_text_order(key):
    chat = Chat().expect('Bonjour et bienvenue', 'Écrivez-moi')
    assert chat.input.get('type') == 'text input', chat.input
    chat.send('Bonsoir').expect('comment puis-je vous aider')
    chat.send('je cherche un casque bluetooth à moins de 60 000 fcfa').expect(
        'Je recherche', 'casque bluetooth', "J'ai trouvé 1 produit")
    assert chat.images and chat.images[0].startswith('http'), chat.images
    name = product_name(chat)
    assert name == 'Casque Bluetooth JBL Tune', name
    before = stock_of(key, name)
    chat.click('Ajouter au panier').expect('Quelle quantité')
    chat.send('99').expect('exemplaire(s)')          # plus que le stock : refusé
    chat.send('2').expect('ajouté à votre panier')
    assert 'contient 2 article' in chat.output, chat.output
    number = checkout_as_guest(chat)
    assert stock_of(key, name) == before - 2, 'le stock doit baisser de 2'
    return number, name, before


def scenario_free_text_search_quality():
    chat = Chat()
    chat.send('un casque à moins de 10000').expect('aucun produit', '48 000 FCFA')
    chat.click('Nouvelle recherche').expect('Écrivez votre demande')
    chat.send('samsumg galaxi').expect("J'ai trouvé", 'Je recherche')          # faute de frappe
    chat.click('Autre recherche').send('ordinateur portable max 600k').expect("J'ai trouvé")
    assert 'Ultrabook' in chat.texts[-1] or 'Laptop' in chat.texts[-1] or 'PC' in chat.texts[-1], chat.texts[-1]
    chat.click('Autre recherche').send('un iphone 15').expect('iPhone 15')


def scenario_free_text_info():
    chat = Chat()
    chat.send('quels sont vos frais de livraison ?').expect('livraison à domicile', 'retrait en boutique')
    chat.send('peut-on payer avec Wave ?').expect('Wave', 'Orange Money')
    chat.send('je veux parler à un conseiller').expect('Dakar', 'Téléphone')
    chat.send('qui êtes-vous ?').expect("l'assistant de TechShop")
    chat.send('merci').expect('Avec plaisir')
    chat.send('xyzqwerty').expect('pas bien compris')
    assert 'Chercher dans le catalogue' in chat.choices, chat.choices
    chat.click('Voir le menu').expect('Voici ce que je peux faire')
    chat.click('Livraison, paiement').click('Moyens de paiement').expect('espèces')
    chat.send('au revoir').expect('À bientôt')


def scenario_track_and_cancel(key, number, name, stock_before):
    chat = Chat()
    chat.send('je veux annuler ma commande').expect('numéro de commande')
    chat.send('n importe quoi').expect('pas le bon format')
    chat.click('Réessayer').expect('numéro de commande')
    chat.send(number).expect('téléphone')
    chat.send('78 000 00 00').expect('Aucune commande ne correspond')
    chat.click('autre numéro').expect('numéro de commande')
    chat.send(number).send('77 123 45 67').expect(number, 'En attente', 'Wave', 'Total TTC')
    chat.click('Annuler cette commande').expect('vraiment annuler')
    chat.click('Oui').expect('est annulée')
    assert stock_of(key, name) == stock_before, 'le stock doit être restauré'
    chat.send(f'où en est ma commande {number.lower()} ?').expect('Annulée')   # numéro lu dans la phrase
    assert 'Annuler cette commande' not in ' '.join(chat.choices)


def scenario_buttons_menu_and_prefilled_client():
    chat = Chat({'nom': 'Moussa Fall', 'telephone': '+221 77 555 66 77'}).expect('Bonjour Moussa Fall')
    chat.send('menu').click('Voir les produits').expect('Quelle catégorie')
    assert chat.choices[0] == 'Tous les produits', chat.choices
    chat.click('Écouteurs').expect('budget')
    chat.click('Pas de limite').expect('Produit 1 sur')
    chat.click('Produit suivant').expect('Produit 2 sur')
    chat.click('Produit précédent').expect('Produit 1 sur')
    chat.click('Ajouter').send('1').click('Continuer')
    chat.click('Voir mon panier').expect('Votre panier', 'Sous-total HT', 'TVA (18 %)')
    chat.click('Retirer un article').expect('Quel article')
    chat.click('1 x').expect('Votre panier est vide')
    chat.click('Écrire ma demande').send('mon panier').expect('vide')


def main():
    key = read_key()
    number, name, before = scenario_free_text_order(key)
    print(f'OK  Texte libre : recherche avec budget, panier, commande livrée Wave ({number})')
    scenario_free_text_search_quality()
    print('OK  Texte libre : budget trop bas, fautes de frappe, modèles')
    scenario_free_text_info()
    print('OK  Texte libre : infos, présentation, incompris, au revoir')
    scenario_track_and_cancel(key, number, name, before)
    print('OK  Suivi et annulation par message (stock restauré)')
    scenario_buttons_menu_and_prefilled_client()
    print('OK  Menu à boutons et client connecté')


if __name__ == '__main__':
    main()
