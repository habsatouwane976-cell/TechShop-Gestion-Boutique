"""Briques de construction d'un workflow Typebot (schéma 6.1) en Python.

Chaque méthode ajoute un bloc à un groupe ; les liens entre groupes sont
déclarés par nom (`then=`, cibles des boutons et des conditions) et résolus
à l'export, ce qui permet les boucles et les renvois en arrière.
"""
import json
import random
import re
import string
from datetime import datetime, timezone

_ALPHABET = string.ascii_lowercase + string.digits


def new_id():
    return random.choice(string.ascii_lowercase) + ''.join(random.choices(_ALPHABET, k=23))


def rich_text(content):
    """Lignes séparées par \\n ; **gras** pris en charge."""
    paragraphs = []
    for line in content.split('\n'):
        children = []
        for index, part in enumerate(re.split(r'\*\*', line)):
            if part:
                children.append({'text': part, **({'bold': True} if index % 2 else {})})
        paragraphs.append({'id': new_id(), 'type': 'p', 'children': children or [{'text': ''}]})
    return {'richText': paragraphs}


class Flow:
    def __init__(self, api_key=''):
        self.api_key = api_key
        self.groups = {}
        self.edges = []
        self.variables = {}
        self.pending = []
        self.start_target = None

    # --- Structure -------------------------------------------------------
    def var(self, name, value=None):
        if name not in self.variables:
            self.variables[name] = {
                'id': 'v' + new_id()[1:], 'name': name, 'isSessionVariable': False,
                **({'value': value} if value is not None else {}),
            }
        return self.variables[name]['id']

    def group(self, name, x=0, y=0):
        group = {'id': new_id(), 'title': name, 'graphCoordinates': {'x': x, 'y': y}, 'blocks': []}
        self.groups[name] = group
        return group

    def _link(self, holder, target, from_ref):
        self.pending.append((holder, target, from_ref))

    def add(self, group, block, then=None):
        block = {'id': new_id(), **block}
        group['blocks'].append(block)
        if then:
            self._link(block, then, {'blockId': block['id']})
        return block

    # --- Messages --------------------------------------------------------
    def say(self, group, content, then=None):
        return self.add(group, {'type': 'text', 'content': rich_text(content)}, then)

    def image(self, group, url, then=None):
        return self.add(group, {'type': 'image', 'content': {'url': url}}, then)

    # --- Saisies ---------------------------------------------------------
    def ask(self, group, var, placeholder, long=False, button='Envoyer', then=None):
        labels = {'placeholder': placeholder, 'button': button}
        return self.add(group, {'type': 'text input', 'options': {
            'variableId': self.var(var), 'isLong': long, 'labels': labels,
        }}, then)

    def ask_number(self, group, var, placeholder, button='Valider', then=None):
        """Pas de min/max : Typebot répondrait « Invalid message » ; la plage est vérifiée par une condition."""
        return self.add(group, {'type': 'number input', 'options': {
            'variableId': self.var(var),
            'labels': {'placeholder': placeholder, 'button': button},
        }}, then)

    def buttons(self, group, choices, var=None):
        """choices : liste de (libellé, groupe cible)."""
        block = {'id': new_id(), 'type': 'choice input', 'items': [], 'options': {}}
        if var:
            block['options']['variableId'] = self.var(var)
        for label, target in choices:
            item = {'id': new_id(), 'content': label}
            block['items'].append(item)
            self._link(item, target, {'blockId': block['id'], 'itemId': item['id']})
        group['blocks'].append(block)
        return block

    def dynamic_buttons(self, group, var, list_var, searchable=False):
        """Boutons générés depuis une variable liste ; la suite est portée par le groupe suivant."""
        return self.add(group, {'type': 'choice input', 'items': [{'id': new_id(), 'content': 'Click to edit'}],
                                'options': {'variableId': self.var(var), 'dynamicVariableId': self.var(list_var),
                                            'isSearchable': searchable,
                                            'areInitialSearchButtonsVisible': False}})

    # --- Logique ---------------------------------------------------------
    def set_var(self, group, var, code=None, text=None, empty=False, then=None):
        """code : corps JavaScript (avec return) ; text : gabarit avec {{variables}} ; empty : vide la variable."""
        options = {'variableId': self.var(var)}
        if empty:
            options['type'] = 'Empty'
        elif code is not None:
            options.update({'type': 'Custom', 'expressionToEvaluate': code, 'isCode': True})
        elif text is not None:
            options.update({'expressionToEvaluate': text, 'isCode': False})
        return self.add(group, {'type': 'Set variable', 'options': options}, then)

    def http(self, group, method, url, mapping, body=None):
        webhook = {'method': method, 'url': url,
                   'headers': [{'id': new_id(), 'key': 'X-Chatbot-Key', 'value': self.api_key}]}
        options = {'webhook': webhook, 'responseVariableMapping': [
            {'id': new_id(), 'variableId': self.var(variable), 'bodyPath': path}
            for variable, path in mapping
        ]}
        if body is not None:
            webhook['body'] = body if isinstance(body, str) else json.dumps(body, ensure_ascii=False, indent=2)
            options['isCustomBody'] = True
        return self.add(group, {'type': 'Webhook', 'options': options})

    def branch(self, group, rules, otherwise):
        """rules : liste de (variable, opérateur, valeur|None, groupe cible)."""
        block = {'id': new_id(), 'type': 'Condition', 'items': []}
        for variable, operator, value, target in rules:
            comparison = {'id': new_id(), 'variableId': self.var(variable), 'comparisonOperator': operator}
            if value is not None:
                comparison['value'] = value
            item = {'id': new_id(), 'content': {'logicalOperator': 'AND', 'comparisons': [comparison]}}
            block['items'].append(item)
            self._link(item, target, {'blockId': block['id'], 'itemId': item['id']})
        self._link(block, otherwise, {'blockId': block['id']})
        group['blocks'].append(block)
        return block

    # --- Export ----------------------------------------------------------
    def _resolve(self):
        for holder, target, from_ref in self.pending:
            if target not in self.groups:
                raise KeyError(f'Groupe cible inconnu : {target}')
            edge_id = new_id()
            holder['outgoingEdgeId'] = edge_id
            self.edges.append({'id': edge_id, 'from': from_ref, 'to': {'groupId': self.groups[target]['id']}})

    def export(self, name, theme, settings):
        self._resolve()
        now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
        start = {'id': new_id(), 'type': 'start', 'graphCoordinates': {'x': -200, 'y': 0}}
        edge_id = new_id()
        start['outgoingEdgeId'] = edge_id
        self.edges.append({'id': edge_id, 'from': {'eventId': start['id']},
                           'to': {'groupId': self.groups[self.start_target]['id']}})
        return {
            'version': '6.1', 'id': new_id(), 'name': name,
            'events': [start], 'groups': list(self.groups.values()), 'edges': self.edges,
            'variables': list(self.variables.values()),
            'theme': theme, 'selectedThemeTemplateId': None, 'settings': settings,
            'createdAt': now, 'updatedAt': now, 'icon': None, 'folderId': None,
            'publicId': None, 'customDomain': None, 'workspaceId': None,
            'resultsTablePreferences': None, 'isArchived': False, 'isClosed': False,
            'whatsAppCredentialsId': None, 'riskLevel': None, 'spaceId': None,
        }
