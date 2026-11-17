"""Remplace les tirets longs (— et –) par « - » dans les textes déjà enregistrés en base.

Usage : python manage.py fix_dashes
"""
from django.core.management.base import BaseCommand

from apps.notifications.models import Notification
from apps.products.models import Category, Product

TARGETS = (
    (Product, ('name', 'description')),
    (Category, ('name', 'description')),
    (Notification, ('title', 'message')),
)


def clean(value):
    return value.replace('\u2014', '-').replace('\u2013', '-')


class Command(BaseCommand):
    help = "Remplace les tirets longs par « - » dans les produits, catégories et notifications."

    def handle(self, *args, **options):
        total = 0
        for model, fields in TARGETS:
            for obj in model.objects.all():
                updates = {}
                for field in fields:
                    value = getattr(obj, field) or ''
                    new = clean(value)
                    if new != value:
                        updates[field] = new
                if updates:
                    model.objects.filter(pk=obj.pk).update(**updates)
                    total += 1
        self.stdout.write(self.style.SUCCESS(f"{total} enregistrement(s) mis à jour."))
