"""
Modèles pour la gestion des stocks :
- Mouvements de stock (entrées/sorties)
- Approvisionnements fournisseurs
"""
from django.db import models
from django.core.validators import MinValueValidator
from apps.users.models import User
from apps.products.models import Product
from apps.suppliers.models import Supplier


class StockMovement(models.Model):
    """Historique de tous les mouvements de stock"""
    MOVEMENT_TYPES = [
        ('in', 'Entrée de stock'),
        ('out', 'Sortie de stock'),
        ('adjustment', 'Ajustement inventaire'),
        ('return', 'Retour fournisseur'),
        ('loss', 'Perte / Casse'),
    ]
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='movements',
        verbose_name="Produit"
    )
    movement_type = models.CharField(
        max_length=15, choices=MOVEMENT_TYPES, verbose_name="Type"
    )
    quantity = models.IntegerField(
        validators=[MinValueValidator(1)], verbose_name="Quantité"
    )
    quantity_before = models.IntegerField(verbose_name="Stock avant")
    quantity_after = models.IntegerField(verbose_name="Stock après")
    unit_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, verbose_name="Prix unitaire"
    )
    reference = models.CharField(
        max_length=100, blank=True, verbose_name="Référence"
    )
    notes = models.TextField(blank=True, verbose_name="Notes")
    supplier = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='movements', verbose_name="Fournisseur"
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, verbose_name="Créé par"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_movements'
        verbose_name = 'Mouvement de stock'
        verbose_name_plural = 'Mouvements de stock'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_movement_type_display()} - {self.product.name} ({self.quantity})"

    @property
    def total_value(self):
        return self.unit_price * self.quantity


class Supply(models.Model):
    """Approvisionnement fournisseur"""
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('received', 'Reçu'),
        ('partial', 'Partiel'),
        ('cancelled', 'Annulé'),
    ]
    reference = models.CharField(max_length=50, unique=True, verbose_name="Référence")
    supplier = models.ForeignKey(
        Supplier, on_delete=models.CASCADE, related_name='supplies',
        verbose_name="Fournisseur"
    )
    status = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default='pending',
        verbose_name="Statut"
    )
    total_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, verbose_name="Montant total"
    )
    notes = models.TextField(blank=True)
    expected_date = models.DateField(null=True, blank=True, verbose_name="Date prévue")
    received_date = models.DateField(null=True, blank=True, verbose_name="Date réception")
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, verbose_name="Créé par"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'supplies'
        verbose_name = 'Approvisionnement'
        verbose_name_plural = 'Approvisionnements'
        ordering = ['-created_at']

    def __str__(self):
        return f"Appro {self.reference} - {self.supplier.name}"

    def calculate_total(self):
        self.total_amount = sum(item.subtotal for item in self.items.all())
        self.save(update_fields=['total_amount'])


class SupplyItem(models.Model):
    """Ligne d'un approvisionnement"""
    supply = models.ForeignKey(
        Supply, on_delete=models.CASCADE, related_name='items'
    )
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='supply_items'
    )
    quantity_ordered = models.IntegerField(validators=[MinValueValidator(1)])
    quantity_received = models.IntegerField(default=0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'supply_items'

    @property
    def subtotal(self):
        return self.unit_price * self.quantity_received
