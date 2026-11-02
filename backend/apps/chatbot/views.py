"""Endpoints appelés par les blocs « requête HTTP » de Typebot."""
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import Category

from . import services
from .nlu import Vocabulary, significant_words, understand
from .permissions import HasChatbotKey
from .search import budget_hint, search_products
from .serializers import order_summary, parse_order, product_card, public_base_url

IN_STOCK = Q(products__is_active=True, products__quantity__gt=0)


class ChatbotView(APIView):
    authentication_classes = []
    permission_classes = [HasChatbotKey]


class CategoryListView(ChatbotView):
    def get(self, request):
        categories = (
            Category.objects.filter(is_active=True)
            .annotate(available=Count('products', filter=IN_STOCK))
            .filter(available__gt=0)
            .order_by('name')
        )
        results = [{'id': c.id, 'name': c.name, 'available': c.available} for c in categories]
        return Response({'count': len(results), 'results': results})


class ProductListView(ChatbotView):
    def get(self, request):
        params = request.query_params
        category_id = int(params['category']) if params.get('category', '').isdigit() else None
        max_price = int(params['max_price']) if params.get('max_price', '').isdigit() else None
        tokens = significant_words(params.get('q', ''))
        base = public_base_url(request)
        results = [
            product_card(product, base)
            for product in search_products(tokens, category_id, max_price)
        ]
        hint = '' if results else budget_hint(tokens, category_id, max_price)
        return Response({'count': len(results), 'results': results, 'hint': hint})


class UnderstandView(ChatbotView):
    """Analyse un message libre : intention, budget, mots de recherche, numéro de commande."""

    def post(self, request):
        message = request.data.get('message', '')
        return Response(understand(message if isinstance(message, str) else '', Vocabulary.from_catalog()))


class OrderCreateView(ChatbotView):
    def post(self, request):
        sale = services.create_order(parse_order(request.data))
        return Response(order_summary(sale), status=status.HTTP_201_CREATED)


class OrderDetailView(ChatbotView):
    def get(self, request, invoice_number):
        sale = services.find_order(invoice_number, request.query_params.get('phone', ''))
        return Response(order_summary(sale))


class OrderCancelView(ChatbotView):
    def post(self, request, invoice_number):
        sale = services.cancel_order(invoice_number, request.data.get('phone', ''))
        return Response(order_summary(sale))
