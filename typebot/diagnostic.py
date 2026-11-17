"""Diagnostic de l'assistant : vérifie chaque maillon et dit quoi corriger.

Usage (depuis la racine du projet) : python typebot/diagnostic.py
Aucune dépendance : bibliothèque standard uniquement.
"""
import json
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = 'http://localhost:8000'
VIEWER = 'http://localhost:8091'
BUILDER = 'http://localhost:8080'
BOT_ID = 'techshop-assistant'

problems = []


def ok(message):
    print(f'  [OK]  {message}')


def ko(message, fix):
    print(f'  [!!]  {message}\n        -> {fix}')
    problems.append(message)


def env_value(path, name):
    if not path.exists():
        return None
    for line in path.read_text(encoding='utf-8', errors='ignore').splitlines():
        if line.startswith(f'{name}='):
            return line.split('=', 1)[1].strip()
    return ''


def get(url, headers=None):
    request = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return response.status, response.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as error:
        return error.code, ''
    except Exception as error:  # connexion refusée, délai dépassé...
        return None, str(error)


print('\n1. Clé de l\'API (.env à la racine)')
key = env_value(ROOT / '.env', 'CHATBOT_API_KEY')
if key is None:
    ko('Fichier .env introuvable à la racine', 'Copiez .env.example en .env puis renseignez CHATBOT_API_KEY')
elif not key:
    ko('CHATBOT_API_KEY est vide', 'python -c "import secrets; print(secrets.token_urlsafe(32))" puis collez la valeur dans .env')
else:
    ok('CHATBOT_API_KEY renseignée')

print('\n2. API Django')
status, body = get(f'{API}/api/chatbot/categories/', {'X-Chatbot-Key': key or 'x'})
if status == 200:
    ok(f'API joignable, clé acceptée ({json.loads(body).get("count", 0)} catégorie(s) en stock)')
elif status in (401, 403):
    ko('Le backend refuse la clé', 'docker compose up -d --force-recreate backend  (il doit relire CHATBOT_API_KEY du .env)')
else:
    ko(f'Backend injoignable sur {API} ({body})', 'docker compose up -d backend puis docker compose logs backend')
status, body = get(f'{API}/api/chatbot/products/', {'X-Chatbot-Key': key or 'x'})
if status == 200:
    count = json.loads(body).get('count', 0)
    (ok if count else ko)(*(
        (f'{count} produit(s) disponible(s) pour le chat',) if count else
        ('Aucun produit en stock : le chat dira "aucun produit"', 'Ajoutez des produits (ou python seed.py)')))

print('\n3. Typebot')
for label, url in (('Viewer (8091)', VIEWER), ('Builder (8080)', BUILDER)):
    status, _ = get(url)
    ok(f'{label} répond') if status else ko(f'{label} injoignable', 'cd typebot ; docker compose up -d')
status, _ = get(f'{VIEWER}/{BOT_ID}')
if status == 200:
    ok(f'Le bot "{BOT_ID}" est publié')
else:
    ko(f'Le bot "{BOT_ID}" est introuvable (code {status})',
       'python typebot/build_workflow.py puis python typebot/load_workflow.py')

print('\n4. Workflow généré')
flow = ROOT / 'typebot' / 'techshop-chatbot.json'
if not flow.exists():
    ko('techshop-chatbot.json absent', 'python typebot/build_workflow.py')
elif not key:
    print('  (clé absente : étape ignorée)')
elif key not in flow.read_text(encoding='utf-8', errors='ignore'):
    ko('Le workflow contient une autre clé que le .env', 'Relancez build_workflow.py puis load_workflow.py')
else:
    ok('Le workflow utilise la clé du .env')

print('\n5. Frontend')
tid = env_value(ROOT / 'frontend' / '.env', 'VITE_TYPEBOT_ID')
if tid:
    ok(f'VITE_TYPEBOT_ID = {tid}')
else:
    ko('VITE_TYPEBOT_ID vide ou frontend/.env absent', 'Mettez VITE_TYPEBOT_ID=techshop-assistant dans frontend/.env puis relancez le frontend')

print('\n6. Clé vue par le conteneur backend')
try:
    seen = subprocess.run(['docker', 'exec', 'boutique-backend', 'printenv', 'CHATBOT_API_KEY'],
                          capture_output=True, text=True, timeout=15).stdout.strip()
    if key and seen == key:
        ok('Le conteneur backend a la même clé que le .env')
    elif key:
        ko('Le conteneur backend n\'a pas la même clé', 'docker compose up -d --force-recreate backend')
except Exception:
    print('  (docker non disponible, étape ignorée)')

print('\n' + ('Tout est en ordre.' if not problems else f'{len(problems)} point(s) à corriger (voir ci-dessus).'))
