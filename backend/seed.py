"""
BoutiqueManager - TechShop Dakar - Boutique Électronique
Données de démonstration avec produits exacts
Usage Windows : python manage.py shell -c "exec(open('seed.py').read())"
Usage Linux   : python manage.py shell < seed.py
"""
import os
import random
from decimal import Decimal
from datetime import timedelta

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.utils import timezone
from django.core.files.base import ContentFile
from apps.users.models import User
from apps.products.models import Category, Product
from apps.suppliers.models import Supplier
from apps.customers.models import Customer
from apps.sales.models import Sale, SaleItem
from apps.notifications.models import Notification

print("🏪 Initialisation - TechShop Dakar (Électronique)")
print("=" * 55)

# ── Utilisateurs ──────────────────────────────────────────
USERS = [
    ("admin@boutique.sn",    "admin",    "Amadou",  "Diallo", "admin",   "+221771000001"),
    ("manager@boutique.sn",  "manager",  "Fatou",   "Ndiaye", "manager", "+221771000002"),
    ("caissier@boutique.sn", "caissier", "Omar",    "Ba",     "cashier", "+221771000003"),
]
users = {}
for email, username, first, last, role, phone in USERS:
    if not User.objects.filter(email=email).exists():
        u = User.objects.create_user(
            email=email, username=username, first_name=first,
            last_name=last, phone=phone, password="Pass@1234", role=role,
        )
        print(f"  ✅ {role.capitalize()}: {email} / Pass@1234")
    else:
        u = User.objects.get(email=email)
        print(f"  ✓  Existant: {email}")
    users[role] = u

admin = users.get("admin")

# ── 18 Catégories électroniques ───────────────────────────
CATS = [
    ("Smartphones",               "📱", "#2563eb"),
    ("Ordinateurs portables",     "💻", "#1d4ed8"),
    ("Ordinateurs de bureau",     "🖥️",  "#7c3aed"),
    ("Tablettes",                 "⬜", "#0891b2"),
    ("Téléviseurs",               "📺", "#0f766e"),
    ("Imprimantes",               "🖨️",  "#b45309"),
    ("Écouteurs et casques",      "🎧", "#db2777"),
    ("Accessoires informatiques", "⌨️",  "#16a34a"),
    ("Composants informatiques",  "🔧", "#dc2626"),
    ("Réseaux et connectivité",   "📡", "#ea580c"),
    ("Stockage et mémoire",       "💾", "#4f46e5"),
    ("Gaming et consoles",        "🎮", "#9333ea"),
    ("Caméras et appareils photo","📷", "#0284c7"),
    ("Montres connectées",        "⌚", "#059669"),
    ("Chargeurs et batteries",    "🔋", "#ca8a04"),
    ("Câbles et adaptateurs",     "🔌", "#64748b"),
    ("Haut-parleurs et audio",    "🔊", "#be185d"),
    ("Sécurité et surveillance",  "🔐", "#374151"),
]
cats = {}
for name, icon, color in CATS:
    c, created = Category.objects.get_or_create(
        name=name,
        defaults={"icon": icon, "color": color,
                  "description": f"Produits électroniques - {name}"}
    )
    cats[name] = c
print(f"  ✅ {len(cats)} catégories créées")

# ── 6 Fournisseurs spécialisés ─────────────────────────────
SUPPLIERS = [
    ("Samsung Electronics Dakar",  "Mamadou Koné",  "+221338101010", "samsung@dakar.sn",  "Dakar"),
    ("Apple Authorized Reseller",  "Awa Thiam",     "+221338202020", "apple@reseller.sn", "Dakar"),
    ("HP & Dell Distribution SN",  "Ibrahima Sarr", "+221338303030", "hp.dell@sn.com",    "Dakar"),
    ("Sony & LG Sénégal",          "Rokhaya Fall",  "+221338404040", "sonylg@sn.com",     "Thiès"),
    ("TechZone Import",            "Cheikh Mbaye",  "+221338505050", "techzone@sn.com",   "Dakar"),
    ("GamingPro West Africa",      "Aïssatou Diop", "+221338606060", "gaming@pro.sn",     "Dakar"),
]
suppliers = []
for name, contact, phone, email, city in SUPPLIERS:
    s, _ = Supplier.objects.get_or_create(
        name=name,
        defaults={"contact_person": contact, "phone": phone,
                  "email": email, "city": city}
    )
    suppliers.append(s)
print(f"  ✅ {len(suppliers)} fournisseurs créés")

# ── Produits : chacun utilise une vraie photo déjà présente dans media/products ──
#  Colonnes: (ref, nom, catégorie, prix_achat, prix_vente, stock, min_stock, sup_idx, photo)
PRODUCTS = [
    # ─ Smartphones ─
    ("ELEC-0001","iPhone 17 Pro",              "Smartphones",             720000, 900000, 10, 2, 1, "17XA2.1.responsive-lg.centre.png"),
    ("ELEC-0002","iPhone 17 Pro Max",          "Smartphones",             800000, 990000,  6, 2, 1, "813p5LEFZFL._AC_SL1500_.jpg"),
    ("ELEC-0003","iPhone 16",                  "Smartphones",             620000, 780000,  9, 2, 1, "04vffdjbrqymnxal9e7c11f-5_13ek.960.webp"),
    ("ELEC-0004","iPhone 15 Pro",              "Smartphones",             650000, 820000,  7, 2, 1, "iphone-15-pro-finish-select-202309-6-1inch-bluetitanium.jfif"),
    ("ELEC-0005","iPhone 13",                  "Smartphones",             380000, 470000, 12, 3, 1, "R.jfif"),
    ("ELEC-0006","Samsung Galaxy S24 Ultra",   "Smartphones",             780000, 950000,  5, 2, 0, "OIP_12.webp"),
    ("ELEC-0007","Samsung Galaxy A15 5G",      "Smartphones",              95000, 125000, 20, 5, 0, "1JpAx.jpg"),
    ("ELEC-0008","Xiaomi Redmi Note 13",       "Smartphones",             110000, 145000, 15, 4, 4, "65ab98db198a6.jpeg"),
    ("ELEC-0009","Smartphone Android 5G",      "Smartphones",              70000,  95000, 18, 5, 4, "OIP_13.webp"),
    # ─ Ordinateurs portables ─
    ("ELEC-0010","MacBook Air",                "Ordinateurs portables",   760000, 950000,  5, 1, 1, "OIP_10.webp"),
    ("ELEC-0011","HP ProBook 15",              "Ordinateurs portables",   420000, 550000,  8, 2, 2, "3-6-e1685954073423.jpg"),
    ("ELEC-0012","HP EliteBook 840",           "Ordinateurs portables",   480000, 620000,  6, 2, 2, "OIP_9.webp"),
    ("ELEC-0013","Dell Latitude 14",           "Ordinateurs portables",   365000, 480000,  6, 2, 2, "5-32-scaled-e1687163325267.jpg"),
    ("ELEC-0014","Ultrabook 14 pouces",        "Ordinateurs portables",   330000, 430000,  7, 2, 4, "150732.png"),
    # ─ Écouteurs, casques et audio ─
    ("ELEC-0015","AirPods Pro",                "Écouteurs et casques",    130000, 170000, 12, 3, 1, "OIP_5.webp"),
    ("ELEC-0016","Casque Bluetooth JBL Tune",  "Écouteurs et casques",     35000,  48000, 14, 4, 4, "359091.jpg"),
    ("ELEC-0017","Enceinte JBL Go 4",          "Haut-parleurs et audio",   30000,  42000, 16, 4, 4, "OIP_8.webp"),
    # ─ Accessoires informatiques ─
    ("ELEC-0018","Clavier sans fil Logitech",  "Accessoires informatiques",18000,  27000, 20, 5, 4, "41YQIYANJnL._AC_.jpg"),
    ("ELEC-0019","Souris sans fil Logitech",   "Accessoires informatiques",10000,  15000, 25, 5, 4, "OIP_14.webp"),
    # ─ Stockage et mémoire ─
    ("ELEC-0020","Disque SSD SanDisk Ultra 1 To","Stockage et mémoire",   58000,  75000, 18, 5, 4, "OIP_7.webp"),
    ("ELEC-0021","Clé USB 64 Go SanDisk Ultra","Stockage et mémoire",      7500,  12000, 30, 8, 4, "71f7w2li-iL._AC_.jpg"),
    # ─ Réseaux et câbles ─
    ("ELEC-0022","Routeur Wi-Fi 6 TP-Link AX1500","Réseaux et connectivité",45000, 62000, 10, 3, 4, "OIP_11.webp"),
    ("ELEC-0023","Switch NETGEAR 8 ports",     "Réseaux et connectivité", 22000,  32000, 12, 3, 4, "GS108_Productcarousel_hero_image_tcm169-104003.jpg"),
    ("ELEC-0024","Point d'accès Wi-Fi D-Link", "Réseaux et connectivité", 38000,  52000,  8, 2, 4, "R_1.jfif"),
    ("ELEC-0025","Câble réseau RJ45 10 m",     "Câbles et adaptateurs",    2500,   5000, 40, 10, 4, "CABLE_RESEAU_RG45_10M-0.jpg"),
]

from django.conf import settings
MEDIA_DIR = os.path.join(settings.MEDIA_ROOT, "products")
products = []
for ref, name, cat_name, purchase, selling, qty, min_stock, sup_idx, img_file in PRODUCTS:
    p, created = Product.objects.get_or_create(
        reference=ref,
        defaults={
            "name": name,
            "category": cats[cat_name],
            "purchase_price": Decimal(purchase),
            "selling_price": Decimal(selling),
            "quantity": qty,
            "min_stock": min_stock,
            "supplier": suppliers[sup_idx],
            "description": (
                f"{name} - Produit électronique de qualité, "
                f"disponible chez TechShop Dakar. "
                f"Prix: {selling:,} FCFA. Stock: {qty} unités."
            ),
            "created_by": admin,
            "unit": "unité",
        }
    )
    # Photo réelle déjà présente dans media/products
    photo_path = os.path.join(MEDIA_DIR, img_file)
    if not os.path.exists(photo_path):
        print(f"  ⚠️  Photo introuvable : {img_file}")
    elif not p.image:
        # Le fichier est déjà dans media/products : on le référence sans le dupliquer.
        p.image.name = f"products/{img_file}"
        p.save(update_fields=["image"])

    products.append(p)
    status = "créé" if created else "existant"
    margin = round((selling - purchase) / purchase * 100, 1)
    print(f"  {'✅' if created else '✓ '} [{ref}] {name} - {selling:,} FCFA (marge: {margin}%)")

print(f"\n  📦 {len(products)} produits électroniques prêts")

# ── 12 Clients ────────────────────────────────────────────
CUSTOMERS = [
    ("Moussa Diallo",         "+221771234567", "moussa.diallo@email.sn",  "Médina, Dakar"),
    ("Fatou Ndiaye",          "+221782345678", "fatou.ndiaye@email.sn",   "Plateau, Dakar"),
    ("Ibrahima Sow",          "+221763456789", "ibra.sow@email.sn",       "Thiès Centre"),
    ("Aminata Ba",            "+221774567890", "aminata.ba@email.sn",     "Parcelles Assainies"),
    ("Omar Diop",             "+221785678901", "omar.diop@email.sn",      "Saint-Louis"),
    ("Rokhaya Fall",          "+221776789012", None,                       "Grand-Yoff, Dakar"),
    ("Cheikh Touré",          "+221787890123", None,                       "Kaolack"),
    ("Awa Mbaye",             "+221768901234", "awa.mbaye@email.sn",      "Sicap Liberté"),
    ("Youssou Dembélé",       "+221779012345", None,                       "Guédiawaye"),
    ("Marième Seck",          "+221780123456", "marieme@email.sn",        "Rufisque"),
    ("Entreprise InfoTech SN","+221338111222", "infotech@entreprise.sn",  "Zone Industrielle, Dakar"),
    ("Cabinet Dr. Ibrahima Bâ","+221338333444","cabinet.ba@sante.sn",    "Almadies, Dakar"),
]
customers = []
for index, (name, phone, email, address) in enumerate(CUSTOMERS, start=1):
    # Customer.email est unique : un client sans e-mail reçoit une adresse fictive distincte.
    c, _ = Customer.objects.get_or_create(
        name=name,
        defaults={"phone": phone, "email": email or f"client{index}@demo.techshop.sn", "address": address}
    )
    customers.append(c)
print(f"  ✅ {len(customers)} clients créés")

# ── Ventes réalistes (30 jours d'historique) ──────────────
cashier = users.get("cashier", admin)
manager_u = users.get("manager", admin)
payment_methods = ["cash","cash","cash","wave","orange_money","card","transfer"]

# Regrouper par type pour ventes réalistes
smartphones_laptops = [p for p in products if p.category.name in ["Smartphones","Ordinateurs portables","Tablettes"]]
tvs_consoles = [p for p in products if p.category.name in ["Téléviseurs","Gaming et consoles","Montres connectées"]]
accessories = [p for p in products if p.category.name in ["Accessoires informatiques","Stockage et mémoire","Câbles et adaptateurs","Chargeurs et batteries"]]
audio = [p for p in products if p.category.name in ["Écouteurs et casques","Haut-parleurs et audio"]]

created_sales = 0
for days_ago in range(30, 0, -1):
    base_dt = timezone.now() - timedelta(days=days_ago)
    dow = base_dt.weekday()
    # Weekends plus actifs pour l'électronique
    n_sales = random.randint(5, 14) if dow >= 5 else random.randint(3, 8)

    for _ in range(n_sales):
        sale_dt = base_dt.replace(
            hour=random.randint(9, 19),
            minute=random.randint(0, 59),
            second=random.randint(0, 59),
        )
        sale = Sale(
            invoice_number=Sale.generate_invoice_number(),
            customer=random.choice(customers + [None]*4),
            cashier=random.choice([cashier, cashier, manager_u]),
            status="completed",
            payment_method=random.choice(payment_methods),
            discount_percent=random.choice([0,0,0,0,0,2,3,5]),
            tax_rate=18,
            amount_paid=0,
        )
        sale.save()
        Sale.objects.filter(pk=sale.pk).update(created_at=sale_dt)

        # Panier réaliste pour boutique électronique
        basket = []
        r = random.random()

        if r < 0.35 and smartphones_laptops:
            # Achat principal : smartphone ou laptop
            main = random.choice(smartphones_laptops)
            basket.append((main, 1))
            # Accessoire complémentaire (prob 55%)
            if random.random() < 0.55 and accessories:
                acc = random.choice(accessories)
                if acc.id not in [x[0].id for x in basket]:
                    basket.append((acc, random.randint(1, 2)))
        elif r < 0.55 and accessories:
            # Achat accessoires uniquement
            n = random.randint(1, 3)
            chosen = random.sample(accessories, min(n, len(accessories)))
            for p in chosen:
                basket.append((p, random.randint(1, 3)))
        elif r < 0.70 and audio:
            # Écouteurs / casques
            main = random.choice(audio)
            basket.append((main, 1))
        elif r < 0.85 and tvs_consoles:
            # TV ou console
            main = random.choice(tvs_consoles)
            basket.append((main, 1))
        else:
            # Produit aléatoire
            main = random.choice(products)
            basket.append((main, 1))

        for prod, qty in basket:
            if prod.quantity <= 0:
                continue
            safe_qty = min(qty, prod.quantity, 3)
            if safe_qty < 1:
                continue
            SaleItem.objects.create(
                sale=sale,
                product=prod,
                product_name=prod.name,
                product_reference=prod.reference,
                quantity=safe_qty,
                unit_price=prod.selling_price,
                unit_cost=prod.purchase_price,
                discount_percent=0,
            )

        sale.calculate_totals()
        # Simuler montant reçu (arrondi supérieur)
        total = float(sale.total_amount)
        paid = total + random.choice([0, 0, 0, 5000, 10000, 25000])
        Sale.objects.filter(pk=sale.pk).update(amount_paid=paid)
        sale.refresh_from_db()
        sale.calculate_totals()
        created_sales += 1

print(f"  ✅ {created_sales} ventes créées (30 jours)")

# ── Alertes stock ─────────────────────────────────────────
low = [p for p in products if p.quantity <= p.min_stock]
for p in low:
    Notification.objects.get_or_create(
        user=admin, title=f"⚠️ Stock bas - {p.name}",
        defaults={
            "type": "low_stock",
            "message": (
                f"«{p.name}» (Réf: {p.reference}) - "
                f"Stock: {p.quantity} unité(s) / Minimum: {p.min_stock}. "
                "Veuillez réapprovisionner."
            ),
            "link": f"/products/{p.id}",
        }
    )
if low:
    print(f"  ⚠️  {len(low)} alertes stock bas créées")

print("")
print("=" * 60)
print("  🎉 TECHSHOP DAKAR - INITIALISATION COMPLÈTE !")
print("=" * 60)
print(f"  📦 {len(products)} produits électroniques")
print(f"  🗂️  {len(cats)} catégories")
print(f"  👥 {len(customers)} clients")
print(f"  🏭 {len(suppliers)} fournisseurs")
print(f"  🛒 {created_sales} ventes (30 jours)")
print("=" * 60)
print("  👤 Admin    : admin@boutique.sn    / Pass@1234")
print("  👤 Manager  : manager@boutique.sn  / Pass@1234")
print("  👤 Caissier : caissier@boutique.sn / Pass@1234")
print("=" * 60)
