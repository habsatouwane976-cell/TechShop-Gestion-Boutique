# 🏪 BoutiqueManager — Gestion Commerciale Professionnelle

> **Projet de Fin de Cycle** | Django 5.1 + React 18 + PostgreSQL  
> ✅ Compatible Python 3.11 / 3.12 / 3.13 — Windows 11 / macOS / Linux

---

## 📦 Architecture du Projet

```
boutique/
├── backend/                  ← API Django REST
│   ├── apps/
│   │   ├── users/            ← Auth, rôles, journal d activité
│   │   ├── products/         ← Produits, catégories
│   │   ├── sales/            ← Ventes, factures PDF
│   │   ├── customers/        ← Clients
│   │   ├── suppliers/        ← Fournisseurs
│   │   ├── inventory/        ← Stocks, approvisionnements
│   │   ├── reports/          ← Dashboard, rapports, export Excel
│   │   ├── notifications/    ← Alertes temps réel
│   │   └── chatbot/          ← API de l'assistant (langage libre, commandes invité)
│   ├── config/               ← Settings, URLs, WSGI
│   ├── seed.py               ← 23 produits, 8 clients, 30 jours de ventes
│   └── requirements.txt
│
├── typebot/                  ← Assistant de vente : workflow, thème, chargement, tests
│
└── frontend/                 ← Interface React + Vite
    └── src/
        ├── pages/            ← 12 pages complètes
        ├── layouts/          ← Sidebar, TopBar, MainLayout
        ├── components/       ← 10 composants réutilisables
        ├── services/         ← 10 services API Axios
        ├── store/            ← Redux Toolkit (auth + UI)
        ├── hooks/            ← useAuth, useGeolocation, useDebounce
        └── utils/            ← formatters, constants
```

---

## ✨ Fonctionnalités

### 🔐 Authentification & Rôles
| Rôle | Accès |
|------|-------|
| **Administrateur** | Accès complet |
| **Gestionnaire** | Produits, ventes, stocks, rapports |
| **Caissier** | Enregistrement des ventes uniquement |

### 📊 Tableau de Bord
- KPIs temps réel (ventes du jour, CA, bénéfices)
- Graphiques : AreaChart, BarChart, PieChart (Recharts)
- Évolution des ventes sur 12 mois
- Top 10 produits les plus vendus
- Répartition par catégorie
- Alertes stock bas

### 💼 Modules Principaux
| Module | Fonctionnalités |
|--------|----------------|
| **Produits** | CRUD + image, catégories, filtre prix, alerte stock, marge |
| **Ventes** | POS complet, remise, TVA, PDF auto, historique |
| **Clients** | CRUD, géolocalisation, historique achats |
| **Fournisseurs** | CRUD, historique approvisionnements |
| **Stocks** | Entrées/sorties, ajustements, approvisionnements |
| **Rapports** | Quotidien/mensuel/annuel, export Excel 3 feuilles |
| **Notifications** | Alertes stock bas, rupture, ventes |
| **Journal** | Toutes les actions enregistrées avec IP |

### 💬 Assistant de vente (chatbot)
Une bulle de chat orange, sur le site pour les visiteurs et les clients, basée sur
[Typebot](https://github.com/baptisteArno/typebot.io) auto-hébergé. Le client **écrit comme il veut**,
l'assistant comprend et répond :

| Le client écrit | L'assistant fait |
|---|---|
| « un casque bluetooth à moins de 60 000 FCFA » | Recherche (budget, accents, pluriels, fautes de frappe) et fiches avec photo |
| « où en est ma commande FAC-… » | Statut, livraison, paiement, articles et total |
| « je veux annuler ma commande » | Annulation tant qu'elle est « En attente » (stock remis) |
| « frais de livraison », « payer avec Wave », « parler à un conseiller » | Informations pratiques et contact |
| « menu » | Boutons : catalogue, panier, commande, suivi |

Il gère aussi le panier (TVA 18 %) et la commande complète sans compte : livraison ou retrait,
paiement espèces, Wave ou Orange Money. Un client connecté retrouve son nom et son téléphone préremplis.
Installation, architecture et tests : **[typebot/README.md](typebot/README.md)**.

### 🗺️ Géolocalisation
- Localisation au moment de la connexion
- Géolocalisation des clients lors de l'ajout
- Conversion coordonnées → adresse (Nominatim/OpenStreetMap)
- Mise à jour du profil utilisateur

---

## 🚀 Installation Windows (PowerShell)

### Prérequis
```powershell
python --version        # 3.11+
node --version          # 18+
psql --version          # 14+
```

### 1. PostgreSQL
```sql
-- Dans pgAdmin ou psql
CREATE DATABASE boutique_db;
CREATE USER boutique_user WITH PASSWORD 'boutique_password';
GRANT ALL PRIVILEGES ON DATABASE boutique_db TO boutique_user;
ALTER USER boutique_user CREATEDB;
```

### 2. Backend Django
```powershell
cd boutique\backend

# Créer l'environnement virtuel
python -m venv venv
venv\Scripts\Activate.ps1

# Si erreur PowerShell :
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Installer les dépendances
pip install -r requirements.txt

# Configuration
copy .env.example .env
# ⚠️  Modifier .env avec vos credentials PostgreSQL

# Créer les dossiers
New-Item -ItemType Directory -Force -Path logs
New-Item -ItemType Directory -Force -Path media\products
New-Item -ItemType Directory -Force -Path static
New-Item -ItemType Directory -Force -Path staticfiles

# Migrations
python manage.py migrate

# Données de démonstration
python manage.py shell -c "exec(open('seed.py').read())"

# Lancer le serveur
python manage.py runserver
```

### 3. Frontend React
```powershell
cd boutique\frontend
npm install
npm run dev
```

---

## 🌐 Accès

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Application React |
| http://localhost:8000/api | API REST |
| http://localhost:8000/swagger/ | Documentation Swagger |
| http://localhost:8000/admin/ | Administration Django |

---

## 👤 Comptes de Démonstration

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| **Administrateur** | admin@boutique.sn | Pass@1234 |
| **Gestionnaire** | manager@boutique.sn | Pass@1234 |
| **Caissier** | caissier@boutique.sn | Pass@1234 |

---

## 📡 API Endpoints

```
# Authentification
POST   /api/auth/login/           Connexion
POST   /api/auth/logout/          Déconnexion
GET    /api/auth/me/              Profil connecté
PUT    /api/auth/change-password/ Changement mot de passe
POST   /api/auth/geolocate/       Géolocalisation inverse

# Utilisateurs (Admin)
GET    /api/auth/users/           Liste utilisateurs
POST   /api/auth/register/        Créer utilisateur
GET    /api/auth/activity/        Journal d activité

# Produits
GET    /api/products/             Liste produits
POST   /api/products/             Créer produit
GET    /api/products/low_stock_alerts/  Alertes stock
GET    /api/products/categories/  Catégories

# Ventes
GET    /api/sales/                Historique ventes
POST   /api/sales/                Nouvelle vente
GET    /api/sales/{id}/pdf/       Télécharger facture PDF
GET    /api/sales/daily_summary/  Résumé du jour

# Clients & Fournisseurs
GET/POST/PUT/DELETE /api/customers/
GET/POST/PUT/DELETE /api/suppliers/

# Stocks
GET    /api/inventory/movements/  Mouvements de stock
POST   /api/inventory/adjust/     Ajustement stock
GET    /api/inventory/supplies/   Approvisionnements

# Rapports
GET    /api/reports/dashboard/    Tableau de bord
GET    /api/reports/sales/        Rapport ventes
GET    /api/reports/export/       Export Excel

# Notifications
GET    /api/notifications/        Mes notifications
PATCH  /api/notifications/        Tout marquer lu

# Assistant (en-tête X-Chatbot-Key obligatoire, réservé à Typebot)
POST   /api/chatbot/understand/           Intention, budget, mots-clés d'un message libre
GET    /api/chatbot/categories/           Catégories avec produits disponibles
GET    /api/chatbot/products/             Recherche (q, category, max_price)
POST   /api/chatbot/orders/               Commande invité
GET    /api/chatbot/orders/<n°>/?phone=   Suivi (numéro + téléphone)
POST   /api/chatbot/orders/<n°>/cancel/   Annulation
```

---

## 🧪 Lancer les Tests

```powershell
cd backend
venv\Scripts\Activate.ps1
python manage.py test
```

Avec Docker, les tests pytest (dont ceux de l'assistant) se lancent ainsi :

```powershell
docker compose exec backend python -m pytest
```

---

## 🔧 Commandes Utiles

```powershell
# Créer superuser admin
python manage.py createsuperuser

# Réinitialiser la base
python manage.py flush

# Nouvelles migrations
python manage.py makemigrations && python manage.py migrate
```

---

## 🗄️ Modèles de Données

| Table | Description |
|-------|-------------|
| `users` | Utilisateurs avec rôles |
| `activity_logs` | Journal de toutes les actions |
| `categories` | Catégories de produits |
| `products` | Produits avec stock |
| `customers` | Clients + géolocalisation |
| `suppliers` | Fournisseurs |
| `sales` | Ventes / Factures |
| `sale_items` | Lignes de vente |
| `stock_movements` | Historique des mouvements |
| `supplies` | Approvisionnements |
| `supply_items` | Lignes d'approvisionnement |
| `notifications` | Notifications utilisateurs |

---

## 📚 Stack Technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Backend | Django | 5.1.7 |
| API REST | DRF | 3.15.2 |
| Auth | SimpleJWT | 5.3.1 |
| BDD | PostgreSQL | 14+ |
| PDF | ReportLab | 4.2.5 |
| Excel | openpyxl | 3.1.5 |
| Géoloc | geopy | 2.4.1 |
| Frontend | React | 18.3.1 |
| Build | Vite | 5.4.8 |
| Style | Tailwind CSS | 3.4.13 |
| État | Redux Toolkit | 2.2.7 |
| Graphiques | Recharts | 2.12.7 |
| HTTP | Axios | 1.7.7 |

---

*© 2025 BoutiqueManager — Projet de Fin de Cycle Universitaire*
