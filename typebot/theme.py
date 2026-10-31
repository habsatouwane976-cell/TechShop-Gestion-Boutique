"""Thème et réglages du bot, alignés sur la charte de la boutique (Inter, orange #f68b1e, texte #313133)."""

PRIMARY = '#F68B1E'      # orange de la boutique (StoreHeader, boutons)
INK = '#313133'
MUTED = '#75757A'
SURFACE = '#FFFFFF'
BACKGROUND = '#F5F5F5'


def build_theme(site_url):
    return {
        'general': {
            'font': {'type': 'Google', 'family': 'Inter'},
            'background': {'type': 'Color', 'content': BACKGROUND},
        },
        'chat': {
            'roundness': 'large',
            'hostAvatar': {'isEnabled': True, 'url': f'{site_url}/chatbot-avatar.svg'},
            'guestAvatar': {'isEnabled': False},
            'hostBubbles': {'backgroundColor': SURFACE, 'color': INK},
            'guestBubbles': {'backgroundColor': PRIMARY, 'color': '#FFFFFF'},
            'buttons': {'backgroundColor': PRIMARY, 'color': '#FFFFFF', 'isRounded': True},
            'inputs': {'backgroundColor': SURFACE, 'color': INK, 'placeholderColor': MUTED},
        },
    }


SETTINGS = {
    'general': {
        'isBrandingEnabled': False,
        'rememberUser': {'isEnabled': True, 'storage': 'session'},
    },
    'typingEmulation': {'enabled': True, 'speed': 600, 'maxDelay': 0.8},
}
