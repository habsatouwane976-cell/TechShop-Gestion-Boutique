"""
Modèles pour la gestion des ventes et factures.
Calcul automatique : sous-total, remise, TVA, total, bénéfice
"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
from apps.users.models import User
from apps.products.models import Product
from apps.customers.models import Customer

class Sale(models.Model):
    """Vente / Facture"""

    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('completed', 'Complétée'),
        ('cancelled', 'Annulée'),
        ('refunded', 'Remboursée'),
    ]

    DELIVERY_STATUS = [
        ('store', 'Retrait boutique'),
        ('pending', 'En attente'),
        ('shipping', 'En livraison'),
        ('delivered', 'Livrée'),
    ]

    PAYMENT_METHODS = [
        ('cash', 'Espèces'),
        ('wave', 'Wave'),
        ('orange_money', 'Orange Money'),
        ('credit', 'Crédit'),
        ('transfer', 'Virement'),
        ('card', 'Carte bancaire'),
    ]

    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="N° Facture"
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales',
        verbose_name="Client"
    )

    cashier = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sales_made',
        verbose_name="Caissier"
    )

    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='completed',
        verbose_name="Statut"
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHODS,
        default='cash',
        verbose_name="Mode de paiement"
    )

    delivery_status = models.CharField(
        max_length=20,
        choices=DELIVERY_STATUS,
        default='store',
        verbose_name="Statut livraison"
    )

    delivery_address = models.TextField(
        blank=True,
        verbose_name="Adresse de livraison"
    )

    customer_phone = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Téléphone client"
    )

    # Montants calculés automatiquement
    subtotal = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Sous-total HT"
    )

    discount_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Remise (montant)"
    )

    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="Remise (%)"
    )

    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=18,
        verbose_name="Taux TVA (%)"
    )

    tax_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Montant TVA"
    )

    total_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Total TTC"
    )

    total_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Coût total (achat)"
    )

    profit = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Bénéfice"
    )

    amount_paid = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Montant reçu"
    )

    change_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Monnaie rendue"
    )

    notes = models.TextField(
        blank=True,
        verbose_name="Notes"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales'
        verbose_name = 'Vente'
        verbose_name_plural = 'Ventes'
        ordering = ['-created_at']

    def __str__(self):
        return f"Facture {self.invoice_number} - {self.total_amount} FCFA"

    def calculate_totals(self):
        """Recalcule tous les totaux à partir des lignes"""
        items = self.items.all()
        subtotal = sum(item.subtotal for item in items)
        total_cost = sum(item.cost_subtotal for item in items)

        discount = (
            subtotal * self.discount_percent / 100
        ) if self.discount_percent else self.discount_amount

        after_discount = subtotal - discount
        tax = after_discount * self.tax_rate / 100
        total = after_discount + tax

        self.subtotal = subtotal
        self.discount_amount = discount
        self.tax_amount = tax
        self.total_amount = total
        self.total_cost = total_cost
        self.profit = total - total_cost
        self.change_amount = max(0, self.amount_paid - total)

        self.save(update_fields=[
            'subtotal',
            'discount_amount',
            'tax_amount',
            'total_amount',
            'total_cost',
            'profit',
            'change_amount'
        ])

    @classmethod
    def generate_invoice_number(cls):
        """Génère un numéro de facture unique"""
        from datetime import datetime
        import uuid

        now = datetime.now()
        return f"FAC-{now.year}{now.month:02d}{now.day:02d}-{uuid.uuid4().hex[:6].upper()}"
class SaleItem(models.Model):
    """Ligne d'une vente"""

    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name='items'
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sale_items'
    )
    product_name = models.CharField(max_length=200)
    product_reference = models.CharField(max_length=50, blank=True)

    quantity = models.IntegerField(
        validators=[MinValueValidator(1)]
    )

    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    unit_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )

    class Meta:
          db_table = 'sale_items'

    @property
    def subtotal(self):
        if not self.unit_price or not self.quantity:
            return 0

        discount_percent = self.discount_percent or 0
        discount = self.unit_price * discount_percent / 100

        return (self.unit_price - discount) * self.quantity

    @property
    def cost_subtotal(self):
        if not self.unit_cost or not self.quantity:
            return 0

        return self.unit_cost * self.quantity

    @property
    def profit(self):
        return (self.subtotal or 0) - (self.cost_subtotal or 0)