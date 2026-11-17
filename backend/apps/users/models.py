"""
Modèle utilisateur personnalisé avec gestion des rôles.
Rôles : Administrateur, Gestionnaire, Caissier, Client
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ("admin", "Administrateur"),
        ("manager", "Gestionnaire"),
        ("cashier", "Caissier"),
        ("customer", "Client"),
    ]

    email = models.EmailField(
        unique=True,
        verbose_name="Email"
    )

    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default="cashier",
        verbose_name="Rôle"
    )

    phone = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Téléphone"
    )

    avatar = models.ImageField(
        upload_to="avatars/",
        null=True,
        blank=True,
        verbose_name="Photo"
    )

    is_active = models.BooleanField(default=True)

    last_login_ip = models.GenericIPAddressField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Géolocalisation
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True
    )

    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True
    )

    location_address = models.TextField(blank=True)

    USERNAME_FIELD = "email"

    REQUIRED_FIELDS = [
        "username",
        "first_name",
        "last_name"
    ]

    class Meta:
        db_table = "users"
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"

    @property
    def is_admin(self):
        return self.role == "admin"

    @property
    def is_manager(self):
        return self.role in ["admin", "manager"]

    @property
    def is_cashier(self):
        return self.role == "cashier"

    @property
    def is_customer(self):
        return self.role == "customer"

    def get_full_name(self):
        return (
            f"{self.first_name} {self.last_name}".strip()
            or self.username
        )


class ActivityLog(models.Model):
    """Journal d'activité - enregistre les actions utilisateur."""

    ACTION_CHOICES = [
        ("login", "Connexion"),
        ("logout", "Déconnexion"),
        ("create", "Création"),
        ("update", "Modification"),
        ("delete", "Suppression"),
        ("view", "Consultation"),
        ("export", "Export"),
        ("import", "Import"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="activities"
    )

    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES
    )

    resource = models.CharField(max_length=100)

    resource_id = models.IntegerField(
        null=True,
        blank=True
    )

    description = models.TextField()

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "activity_logs"
        verbose_name = "Journal d'activité"
        verbose_name_plural = "Journal d'activité"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} - {self.action} - {self.resource}"