"""Test de bout en bout : un faux client discute avec le bot publié (viewer Typebot -> API Django).

Prérequis : pile Typebot lancée, bot chargé (load_workflow.py), backend Django joignable
depuis Typebot, et CHATBOT_API_KEY présent dans ../.env (pour contrôler la base).
Usage : python typebot/e2e_test.py [-v]
Les commandes créées sont réelles (stock décrémenté puis restauré par l'annulation).
"""
import json
import re
import sys
import urllib.error
import urllib.request

VIEWER = 'http://localhost:8091'
PUBLIC_ID = 'techshop-assistant'
API = 'http://localhost:8001'
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
    for line in open('../.env', encoding='utf-8'):
        if line.startswith('CHATBOT_API_KEY='):
            return line.split('=', 1)[1].strip()
    raise SystemExit('CHATBOT_API_KEY introuvable dans ../.env')


def stock_of(key, product_name):
    for product in django_check(f'/api/chatbot/products/?q={urllib.request.quote(product_name)}', key)['results']:
        if product['name'] == product_name:
            return product['stock']
    return 0


def scenario_browse_and_order(key):
    chat = Chat().expect('Bonjour et bienvenue')
    chat.send('Voir les produits').expect('Quelle catégorie')
    assert chat.choices[0] == 'Tous les produits', chat.choices
    chat.click('Écouteurs').expect('budget')
    chat.click('Pas de limite').expect('Produit 1 sur')
    assert chat.images and chat.images[0].startswith('http'), chat.images
    name = re.search(r'\*?\*?(.+)', chat.texts[0]).group(1).split('\n')[0].strip()
    before = stock_of(key, name)
    chat.click('Produit suivant').expect('Produit 2 sur')
    chat.click('Produit précédent').expect('Produit 1 sur')
    chat.click('Ajouter au panier').expect('Quelle quantité')
    chat.send('99').expect('exemplaire(s)')          # plus que le stock : refusé
    chat.send('2').expect('ajouté à votre panier')
    assert 'contient 2 article' in chat.output, chat.output
    chat.click('Commander maintenant').expect('nom complet')
    chat.send('Awa "Aïsha" N\'Diaye').expect('téléphone')
    chat.send('12 34').expect('ne semble pas valide')
    chat.send('77 123 45 67').expect('recevoir votre commande')
    chat.click('Livraison').expect('adresse de livraison')
    chat.send('abc').expect('trop courte')
    chat.send('Sicap Liberté 6, villa 12, face pharmacie').expect('payer')
    chat.click('Wave').expect('Récapitulatif', 'Total TTC', 'Livraison à : Sicap')
    chat.click('Confirmer').expect('Votre commande est enregistrée', 'FAC-')
    number = re.search(r'FAC-\d{8}-[A-Z0-9]{6}', chat.output).group(0)
    assert stock_of(key, name) == before - 2, 'le stock doit baisser de 2'
    return number, name, before


def scenario_track_and_cancel(key, number, name, stock_before):
    chat = Chat()
    chat.click('Suivre ou annuler').expect('numéro de commande')
    chat.send('n importe quoi').expect('pas le bon format')
    chat.click('Réessayer').expect('numéro de commande')
    chat.send(number).expect('téléphone')
    chat.send('78 000 00 00').expect('Aucune commande ne correspond')
    chat.click('autre numéro').expect('numéro de commande')
    chat.send(number).send('77 123 45 67').expect(number, 'En attente', 'Wave', 'Total TTC')
    chat.expect('annuler')
    chat.click('Annuler cette commande').expect('vraiment annuler')
    chat.click('Oui').expect('est annulée')
    assert stock_of(key, name) == stock_before, 'le stock doit être restauré'
    chat.click('Oui, retour').expect('Que souhaitez-vous faire')
    chat.click('Suivre').send(number).expect('Annulée')   # téléphone déjà mémorisé
    assert 'Annuler cette commande' not in ' '.join(chat.choices)


def scenario_search_cart_prefilled():
    chat = Chat({'nom': 'Moussa Fall', 'telephone': '+221 77 555 66 77'}).expect('Bonjour Moussa Fall')
    chat.click('Rechercher un produit').expect('Quel produit')
    chat.send('zzzintrouvable').expect('Aucun produit').click('Rechercher autre chose')
    chat.send('casque').expect('Produit 1 sur')
    chat.click('Ajouter').send('1').click('Continuer')
    chat.click('Voir mon panier').expect('Votre panier', 'Sous-total HT', 'TVA (18 %)')
    chat.click('Retirer un article').expect('Quel article')
    chat.click('1 x').expect('Votre panier est vide')
    chat.click('Retour au menu').click('Livraison, paiement').click('Contacter').expect('Dakar', 'Téléphone')


def main():
    key = read_key()
    for label, run in (
        ('Parcours catalogue -> commande livrée Wave', lambda: scenario_browse_and_order(key)),
    ):
        number, name, before = run()
        print(f'OK  {label} ({number})')
    scenario_track_and_cancel(key, number, name, before)
    print('OK  Suivi puis annulation (stock restauré)')
    scenario_search_cart_prefilled()
    print('OK  Recherche, panier, client connecté, infos')


if __name__ == '__main__':
    main()
