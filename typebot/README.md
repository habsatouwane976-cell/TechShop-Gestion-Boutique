# Assistant TechShop (Typebot)

Assistant de vente de la boutique, basé sur [Typebot](https://github.com/baptisteArno/typebot.io)
auto-hébergé. Il s'affiche en bulle orange sur le site (visiteurs et clients, pas le personnel) et
dialogue avec l'API Django `/api/chatbot/…`.

Le client **écrit librement** ; les boutons restent des raccourcis (tapez « menu »).

## Ce que sait faire l'assistant

| Le client écrit (exemples) | Réponse |
|---|---|
| « je cherche un casque bluetooth à moins de 60 000 FCFA » | recherche, puis fiches produit avec photo, prix, stock |
| « ordinateur portable max 400k », « un iphone 15 », « samsumg galaxi » | budget (k, mille, FCFA), numéros de modèle, fautes de frappe |
| « où en est ma commande FAC-20261031-AB12CD » | statut, livraison, paiement, articles, total |
| « je veux annuler ma commande » | retrouve la commande (numéro + téléphone), annule si « En attente », remet le stock |
| « quels sont vos frais de livraison », « payer avec Wave », « parler à un conseiller » | informations pratiques et contact |
| « mon panier », « je veux commander » | panier (HT, TVA 18 %, TTC) puis commande sans compte |
| « bonjour », « merci », « qui êtes-vous », « au revoir » | conversation courante |
| message non compris | propose de chercher dans le catalogue, le menu ou la boutique |
| « menu » | boutons : catalogue par catégorie et budget, panier, commande, suivi, infos |

Commande : nom, téléphone vérifié, livraison à domicile ou retrait, adresse, paiement (espèces,
Wave ou Orange Money), récapitulatif, confirmation avec un numéro `FAC-…`. Client connecté : nom et
téléphone préremplis.

## Comment ça marche

```
Navigateur ── bulle (frontend/ChatbotWidget.jsx) ──> Typebot viewer (:8091)
                                                          │  blocs « requête HTTP » + X-Chatbot-Key
                                                          ▼
                                       Django  /api/chatbot/understand/   intention + budget + mots-clés
                                               /api/chatbot/products/     recherche tolérante
                                               /api/chatbot/orders/…      commande, suivi, annulation
```

1. Chaque message libre part vers `understand/`, qui renvoie une **intention** (`product_search`,
   `track_order`, `cancel_order`, `delivery_info`, `payment_info`, `contact`, `cart`, `checkout`,
   `catalog`, `menu`, `greeting`, `thanks`, `goodbye`, `about`, `unknown`), le budget, les mots utiles
   et un éventuel numéro de commande.
2. Typebot route vers le bon parcours (groupe `Hub - saisie`, voir `hub.py`).
3. La compréhension est **déterministe et gratuite** (`backend/apps/chatbot/nlu.py`) : règles ordonnées,
   accents et pluriels ignorés, synonymes (`ALIASES`), fautes de frappe tolérées par rapprochement avec le
   catalogue. Aucun service externe, aucune clé à payer, entièrement testée.
4. La recherche (`search.py`) classe par pertinence (nom > catégorie > description), exige tous les mots
   quand c'est possible, puis trie par prix. Si le budget exclut tout, l'assistant indique le prix d'entrée.

### Améliorer la compréhension
- Un mot courant que le bot ne relie pas à une catégorie : l'ajouter à `ALIASES` dans `nlu.py`
  (mot -> mot-clé présent dans le nom de la catégorie).
- Un mot parasite qui pollue les recherches : l'ajouter à `STOPWORDS`.
- Une nouvelle intention : règle dans `_classify` (`nlu.py`), test dans `test_nlu.py`, ligne dans `ROUTES`
  (`hub.py`). Une IA générative pourrait remplacer `understand()` sans toucher au reste du parcours.

## Sécurité

- Toutes les routes exigent l'en-tête `X-Chatbot-Key` (comparaison à temps constant). Sans clé configurée,
  l'API est fermée.
- Prix, TVA et stock viennent toujours du catalogue : le bot ne peut pas fixer un prix.
- Suivi et annulation exigent le numéro de facture **et** le téléphone ; l'erreur est identique si l'un des
  deux est faux.
- Wave et Orange Money : la commande reste « En attente », l'équipe confirme le paiement (aucune passerelle
  simulée n'est appelée par le bot).
- Les messages sont tronqués à 300 caractères avant analyse.

## Installation locale

Docker Desktop lancé. La pile Typebot (ports 8080 builder, 8091 viewer, 8025 mails) peut être partagée
avec un autre projet : si elle tourne déjà, rien à relancer.

1. **Clé API** : dans le `.env` **racine** (copié de `.env.example`), renseigner `CHATBOT_API_KEY`
   (`python -c "import secrets; print(secrets.token_urlsafe(32))"`), puis `docker compose up -d --build`.
   Le backend ne lit le `.env` qu'au démarrage : toujours le relancer après un changement de clé.
2. **Données** : `docker compose exec backend python manage.py migrate` puis `… python seed.py`.
3. **Typebot** :
   ```powershell
   cd typebot
   Copy-Item .env.example .env      # changer ENCRYPTION_SECRET (texte aléatoire de 32 caractères)
   docker compose up -d
   ```
4. **Première connexion** (une seule fois) : http://localhost:8080, saisir un e-mail, lire le code à 6 chiffres
   sur http://localhost:8025, le saisir dans Typebot.
5. **Charger le bot** (publié automatiquement, id public `techshop-assistant`) :
   ```powershell
   python typebot/build_workflow.py
   python typebot/load_workflow.py
   ```
   À refaire après tout changement de clé ou de workflow : la clé est écrite dans le bot à la génération.
6. **Widget** : `frontend/.env` avec `VITE_TYPEBOT_ID=techshop-assistant` et
   `VITE_TYPEBOT_VIEWER_URL=http://localhost:8091`, puis `npm install && npm run dev` (ou
   `docker compose restart frontend`). Sans `VITE_TYPEBOT_ID`, le widget est désactivé.

Variables lues par `build_workflow.py` (environnement ou `.env` racine) : `CHATBOT_API_KEY`,
`CHATBOT_API_URL` (défaut `http://host.docker.internal:8000`, l'adresse du backend vue depuis Docker),
`CHATBOT_SITE_URL` (défaut `http://localhost:5173`, utilisée pour l'avatar du bot).
`CHATBOT_PUBLIC_BASE_URL` (backend) sert aux URL des photos vues par le navigateur.

### Dépannage

| Symptôme | Cause probable |
|---|---|
| Pas de bulle | `frontend/.env` manquant, frontend pas relancé, ou autre site sur le même port |
| « Le catalogue est momentanément indisponible » | clé vide ou ancienne : relancer le backend, puis `build_workflow.py` et `load_workflow.py` ; vérifier `host.docker.internal` dans `ALLOWED_HOSTS` |
| « Aucun produit » partout | base vide : `seed.py` |
| Produits sans photo | `CHATBOT_PUBLIC_BASE_URL` incorrect |
| `Aucun workspace` au chargement | première connexion au builder (étape 4) non faite |
| `Typebot n'est pas lancé` | `docker compose up -d` dans `typebot/` |
| `docker-credential-desktop` introuvable | ajouter `C:\Program Files\Docker\Docker\resources\bin` au PATH |

## Tester

```powershell
docker compose exec backend python -m pytest apps/chatbot     # API, compréhension, recherche (≈ 100 tests)
python typebot/e2e_test.py -v                                  # 5 conversations réelles via le viewer
```

`e2e_test.py` passe de vraies commandes puis les annule (le stock est restauré). Variable
`CHATBOT_E2E_API` pour une autre adresse du backend (défaut `http://localhost:8000`).

## Modifier le bot

| Fichier | Rôle |
|---|---|
| `build_workflow.py` | parcours à boutons, panier, commande, suivi, textes, constantes boutique |
| `hub.py` | saisie libre et routage par intention |
| `theme.py` | couleurs et police (orange `#f68b1e`, texte `#313133`) |
| `flow_lib.py` | briques de construction Typebot |
| `load_workflow.py` | charge et publie dans le Typebot local |

Relancer `build_workflow.py` puis `load_workflow.py` : le bot du même nom est écrasé (brouillon et version
publiée). Dans les blocs de code Typebot, une variable s'écrit `{{nom}}` ; elles ne contiennent que du texte ou
des listes de texte, d'où le panier stocké en JSON.

## À valider avant la production

- `SHOP_PHONE`, `SHOP_EMAIL` dans `build_workflow.py` : repris du pied de page du site (numéro factice
  `+221 00 000 00 00`).
- Textes livraison et paiement (`Infos - …`) : frais et délais non définis dans l'application.
- Le site affiche un total panier sans TVA alors que le backend ajoute 18 % aux commandes clients ; le bot
  affiche le calcul de la facture (HT, TVA, TTC).
- En production, héberger Typebot à part, appeler l'API en HTTPS et retirer
  `SSRF_ALLOWED_HOSTS=host.docker.internal`.
