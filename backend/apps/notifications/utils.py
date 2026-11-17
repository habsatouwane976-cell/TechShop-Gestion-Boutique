"""Utilitaires pour envoyer des notifications"""
import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils.html import escape
from .models import Notification
from apps.users.models import User

logger = logging.getLogger('apps')


def notify_user(user, ntype, title, message, link=''):
    """Crée une notification pour un utilisateur"""
    try:
        Notification.objects.create(
            user=user, type=ntype, title=title, message=message, link=link
        )
    except Exception as e:
        logger.error(f"Erreur notification: {e}")


def notify_admins_and_managers(ntype, title, message, link=''):
    """Notifie tous les admins et gestionnaires"""
    users = User.objects.filter(role__in=['admin', 'manager'], is_active=True)
    for user in users:
        notify_user(user, ntype, title, message, link)


def send_low_stock_alert(product, triggered_by=None):
    """Alerte de stock bas pour un produit"""
    msg = (
        f"Le produit «{product.name}» (Réf: {product.reference}) "
        f"est en stock bas. Stock actuel: {product.quantity} / Min: {product.min_stock}"
    )
    notify_admins_and_managers(
        'low_stock',
        f"⚠️ Stock bas - {product.name}",
        msg,
        f"/products/{product.id}"
    )


def send_out_of_stock_alert(product):
    """Alerte rupture de stock : notification dans l'application + e-mail de confirmation"""
    notify_admins_and_managers(
        'out_of_stock',
        f"🚨 Rupture de stock - {product.name}",
        f"Le produit «{product.name}» (Réf: {product.reference}) est en rupture totale de stock.",
        f"/products/{product.id}"
    )
    send_out_of_stock_email(product)


def send_out_of_stock_email(product):
    """
    Envoie un e-mail aux administrateurs et gestionnaires pour les prévenir
    d'une rupture de stock et leur demander de confirmer le réapprovisionnement.
    L'envoi a lieu une fois la transaction validée et ne bloque jamais la vente.
    """
    recipients = list(
        User.objects.filter(role__in=['admin', 'manager'], is_active=True)
        .exclude(email='')
        .values_list('email', flat=True)
    )
    if not recipients:
        logger.warning("Rupture de stock « %s » : aucun destinataire e-mail.", product.name)
        return

    supplier = product.supplier.name if product.supplier_id else "Non défini"
    category = product.category.name if product.category_id else "-"
    confirm_url = f"{settings.FRONTEND_URL}/inventory"

    subject = f"🚨 Rupture de stock - {product.name}"
    text = (
        f"Bonjour,\n\n"
        f"Le produit « {product.name} » est en rupture de stock.\n\n"
        f"Référence : {product.reference}\n"
        f"Catégorie : {category}\n"
        f"Fournisseur : {supplier}\n"
        f"Stock actuel : 0 (minimum prévu : {product.min_stock})\n\n"
        f"Merci de confirmer le réapprovisionnement :\n{confirm_url}\n\n"
        f"TechShop Electronics"
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827">
      <h2 style="color:#dc2626;margin-bottom:4px">Rupture de stock</h2>
      <p>Le produit <strong>{escape(product.name)}</strong> n'est plus disponible.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 0;color:#6b7280">Référence</td><td>{escape(product.reference)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Catégorie</td><td>{escape(category)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Fournisseur</td><td>{escape(supplier)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Stock actuel</td><td><strong>0</strong> (minimum prévu : {product.min_stock})</td></tr>
      </table>
      <p style="margin-top:24px">
        <a href="{confirm_url}"
           style="background:#f68b1e;color:#fff;padding:12px 22px;border-radius:6px;
                  text-decoration:none;font-weight:bold">Confirmer le réapprovisionnement</a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:28px">TechShop Electronics</p>
    </div>
    """

    def _send():
        try:
            msg = EmailMultiAlternatives(
                subject, text, settings.DEFAULT_FROM_EMAIL, recipients
            )
            msg.attach_alternative(html, "text/html")
            msg.send()
        except Exception as e:
            logger.error(f"Erreur envoi e-mail rupture de stock: {e}")

    transaction.on_commit(_send)
