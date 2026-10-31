"""Accès réservé au serveur Typebot : clé partagée dans l'en-tête X-Chatbot-Key."""
import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission

HEADER = 'HTTP_X_CHATBOT_KEY'


class HasChatbotKey(BasePermission):
    """Refuse tout appel si la clé n'est pas configurée ou ne correspond pas."""

    def has_permission(self, request, view):
        expected = getattr(settings, 'CHATBOT_API_KEY', '')
        received = request.META.get(HEADER, '')
        if not expected or not received:
            return False
        return hmac.compare_digest(received.encode(), expected.encode())
