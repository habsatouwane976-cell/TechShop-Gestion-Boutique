"""Endpoints appelés par les blocs « requête HTTP » de Typebot."""
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import Category, Product

from . import services
from .permissions import HasChatbotKey
from .serializers import order_summary, parse_order, product_card, public_base_url

PRODUCT_LIMIT = 12
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
        products = Product.objects.select_related('category').filter(
            is_active=True, quantity__gt=0
        )
        params = request.query_params
        if params.get('category', '').isdigit():
            products = products.filter(category_id=int(params['category']))
        if params.get('max_price', '').isdigit():
            products = products.filter(selling_price__lte=int(params['max_price']))
        query = params.get('q', '').strip()
        if query:
            products = products.filter(
                Q(name__icontains=query) | Q(description__icontains=query)
                | Q(reference__icontains=query)
            )
        base = public_base_url(request)
        results = [
            product_card(p, base)
            for p in products.order_by('selling_price', 'name')[:PRODUCT_LIMIT]
        ]
        return Response({'count': len(results), 'results': results})


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
