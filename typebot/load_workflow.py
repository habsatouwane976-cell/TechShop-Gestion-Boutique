"""Charge techshop-chatbot.json dans le Typebot local, publié et prêt pour le widget.

Crée ou met à jour le bot « Assistant TechShop » (brouillon ET version publiée),
sans passer par l'interface « Import a file ». Nécessite que la pile Docker de ce
dossier tourne et qu'un premier compte ait été créé dans le builder
(http://localhost:8080).

Usage : python typebot/load_workflow.py
"""
import json
import secrets
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BOT_NAME = 'Assistant TechShop'
PUBLIC_ID = 'techshop-assistant'
DB_CONTAINER = 'typebot-typebot-db-1'
JSON_COLUMNS = ('groups', 'variables', 'edges', 'events', 'theme', 'settings')
SCHEMA_VERSION = '6.1'


def psql(sql):
    result = subprocess.run(
        ['docker', 'exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', 'typebot',
         '-At', '-v', 'ON_ERROR_STOP=1'],
        input=sql, capture_output=True, text=True, encoding='utf-8',
    )
    if result.returncode:
        raise SystemExit(result.stderr)
    return result.stdout.strip()


def literal(value):
    """Littéral jsonb sûr : délimiteur dollar-quoting aléatoire."""
    tag = 'q' + secrets.token_hex(6)
    return f"${tag}${json.dumps(value, ensure_ascii=False)}${tag}$::jsonb"


def new_id():
    return 'c' + secrets.token_hex(11)


def upsert_draft(workspace, values):
    existing = psql(f"select id from \"Typebot\" where name = '{BOT_NAME}' limit 1;")
    if existing:
        assignments = ', '.join(f'"{column}" = {sql}' for column, sql in values.items())
        psql(f"update \"Typebot\" set {assignments}, \"version\" = '{SCHEMA_VERSION}', "
             f"\"publicId\" = '{PUBLIC_ID}', \"updatedAt\" = now() where id = '{existing}';")
        return existing
    bot_id = new_id()
    columns = ', '.join(f'"{column}"' for column in values)
    psql(f"insert into \"Typebot\" (id, name, \"workspaceId\", \"version\", \"publicId\", {columns}) "
         f"values ('{bot_id}', '{BOT_NAME}', '{workspace}', '{SCHEMA_VERSION}', '{PUBLIC_ID}', "
         f"{', '.join(values.values())});")
    return bot_id


def publish(bot_id, values):
    """Équivalent du bouton « Publish » : insère ou met à jour la version publique."""
    published = psql(f"select id from \"PublicTypebot\" where \"typebotId\" = '{bot_id}';")
    if published:
        assignments = ', '.join(f'"{column}" = {sql}' for column, sql in values.items())
        psql(f"update \"PublicTypebot\" set {assignments}, \"version\" = '{SCHEMA_VERSION}', "
             f"\"updatedAt\" = now() where \"typebotId\" = '{bot_id}';")
        return
    columns = ', '.join(f'"{column}"' for column in values)
    psql(f"insert into \"PublicTypebot\" (id, \"typebotId\", \"version\", {columns}) values "
         f"('{new_id()}', '{bot_id}', '{SCHEMA_VERSION}', {', '.join(values.values())});")


def main():
    bot = json.loads((ROOT / 'techshop-chatbot.json').read_text(encoding='utf-8'))
    workspace = psql('select id from "Workspace" limit 1;')
    if not workspace:
        raise SystemExit("Aucun workspace : connectez-vous d'abord au builder (http://localhost:8080).")
    values = {column: literal(bot[column]) for column in JSON_COLUMNS}
    bot_id = upsert_draft(workspace, values)
    publish(bot_id, values)
    print(f'Bot « {BOT_NAME} » publié (id public : {PUBLIC_ID})')
    print(f'Édition : http://localhost:8080/typebots/{bot_id}/edit')


if __name__ == '__main__':
    main()
