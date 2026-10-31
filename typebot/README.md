# Assistant TechShop (Typebot)

Chatbot de la boutique, basé sur [Typebot](https://github.com/baptisteArno/typebot.io)
auto-hébergé. Il s'affiche en bulle orange sur le site (visiteurs et clients, pas le
personnel) et appelle l'API Django `/api/chatbot/…`.

## Ce que sait faire le bot

| Menu | Détail | Appel API |
|---|---|---|
| Voir les produits | catégories, budget, fiche avec photo, prix, stock, navigation suivant/précédent | `GET categories/`, `GET products/` |
| Rechercher un produit | recherche libre (nom, description, référence) | `GET products/?q=` |
| Mon panier | ajout, quantité contrôlée par le stock, retrait, vidage, total HT + TVA 18 % | local (variable) |
| Passer commande | nom, téléphone validé, livraison ou retrait, adresse, paiement, récapitulatif, confirmation | `POST orders/` |
| Suivre ou annuler une commande | numéro FAC-… + téléphone ; annulation tant que « En attente » (stock remis) | `GET orders/<n>/`, `POST orders/<n>/cancel/` |
| Livraison, paiement, contact | textes d'information | aucun |

Client connecté : le widget préremplit nom et téléphone, le bot ne les redemande pas.

## Sécurité

- Toutes les routes exigent l'en-tête `X-Chatbot-Key` (comparaison à temps constant). Sans clé
  configurée, l'API est fermée.
- Prix, TVA et stock viennent toujours du catalogue : le bot ne peut pas fixer un prix.
- Suivi et annulation exigent le numéro de facture **et** le téléphone ; l'erreur est identique
  si l'un des deux est faux.
- Wave et Orange Money : la commande reste « En attente », l'équipe confirme le paiement
  (aucune passerelle simulée n'est appelée par le bot).

## Installation locale

Docker Desktop lancé. La pile est la même que celle de `projet_GIU` (mêmes conteneurs `typebot-*`,
ports 8080 builder / 8091 viewer / 8025 mails) : si elle tourne déjà, rien à relancer.

```powershell
cd typebot
Copy-Item .env.example .env      # puis changer ENCRYPTION_SECRET (openssl rand -base64 24)
docker compose up -d
```

1. Dans le `.env` **racine** : renseigner `CHATBOT_API_KEY`, `CHATBOT_PUBLIC_BASE_URL`,
   `CHATBOT_API_URL` (voir `.env.example`), puis `docker compose up -d backend`.
2. Se connecter une fois au builder (http://localhost:8080, code à 6 chiffres dans Mailpit
   http://localhost:8025) pour créer le workspace.
3. Générer et charger le bot (publié automatiquement, id public `techshop-assistant`) :
   ```powershell
   python typebot/build_workflow.py
   python typebot/load_workflow.py
   ```
4. Frontend : `frontend/.env` avec `VITE_TYPEBOT_ID=techshop-assistant` et
   `VITE_TYPEBOT_VIEWER_URL=http://localhost:8091`, puis `npm install && npm run dev`.
   Sans `VITE_TYPEBOT_ID`, le widget est désactivé.

## Tester

```powershell
docker compose exec backend python -m pytest apps/chatbot     # API (30 tests)
python typebot/e2e_test.py -v   # conversation réelle ; CHATBOT_E2E_API pour un autre port du backend
```

`e2e_test.py` passe de vraies commandes puis les annule (le stock est restauré).

## Modifier le bot

Les fichiers à éditer : `build_workflow.py` (parcours et textes), `theme.py` (couleurs),
`flow_lib.py` (briques). Relancer `build_workflow.py` puis `load_workflow.py` : le bot du même
nom est écrasé, brouillon et version publiée. Dans les blocs de code Typebot, une variable
s'écrit `{{nom}}` ; les variables ne contiennent que du texte ou des listes de texte, d'où le
panier stocké en JSON.

## À valider avant la production

- `SHOP_PHONE`, `SHOP_EMAIL` dans `build_workflow.py` : repris du pied de page du site
  (numéro factice `+221 00 000 00 00`).
- Textes livraison et paiement (`Infos - …`) : frais et délais non définis dans l'application.
- En production, héberger Typebot à part, appeler l'API en HTTPS et retirer
  `SSRF_ALLOWED_HOSTS=host.docker.internal`.
