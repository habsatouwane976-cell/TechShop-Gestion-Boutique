from django.urls import path

from . import views

urlpatterns = [
    path('categories/', views.CategoryListView.as_view(), name='chatbot-categories'),
    path('products/', views.ProductListView.as_view(), name='chatbot-products'),
    path('orders/', views.OrderCreateView.as_view(), name='chatbot-order-create'),
    path('orders/<str:invoice_number>/', views.OrderDetailView.as_view(), name='chatbot-order'),
    path(
        'orders/<str:invoice_number>/cancel/',
        views.OrderCancelView.as_view(), name='chatbot-order-cancel',
    ),
]
