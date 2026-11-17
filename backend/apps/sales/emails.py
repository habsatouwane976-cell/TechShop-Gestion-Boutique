import logging
from django.conf import settings
from django.core.mail import EmailMessage

logger = logging.getLogger('apps')


def send_sale_email(sale, confirmed=False):
    """Envoie la facture (PDF joint) au client, avec copie à la boutique."""
    # Import tardif pour éviter une boucle d'imports avec views.py
    from .views import generate_sale_pdf

    customer = sale.customer
    customer_email = customer.email if customer and customer.email else ''
    shop_email = settings.EMAIL_HOST_USER

    if customer_email:
        to, bcc = [customer_email], ([shop_email] if shop_email else [])
    elif shop_email:
        to, bcc = [shop_email], []
    else:
        return

    nom = customer.name if customer else "Client"
    lignes = "\n".join(
        f"- {i.product_name} x{i.quantity} : {i.subtotal:,.0f} FCFA"
        for i in sale.items.all()
    )

    if confirmed:
        sujet = f"Commande {sale.invoice_number} confirmée"
        intro = "Votre commande a été confirmée."
    else:
        sujet = f"Facture {sale.invoice_number} - TechShop Electronics"
        intro = "Merci pour votre commande chez TechShop Electronics."

    corps = (
        f"Bonjour {nom},\n\n"
        f"{intro}\n\n"
        f"Facture : {sale.invoice_number}\n"
        f"{lignes}\n\n"
        f"Total TTC : {sale.total_amount:,.0f} FCFA\n"
        f"Paiement : {sale.get_payment_method_display()}\n\n"
        f"Cordialement,\nTechShop Electronics"
    )

    try:
        mail = EmailMessage(sujet, corps, None, to, bcc=bcc)
        try:
            mail.attach(
                f"facture_{sale.invoice_number}.pdf",
                generate_sale_pdf(sale),
                "application/pdf",
            )
        except Exception:
            logger.exception("PDF non joint à l'e-mail")
        mail.send(fail_silently=False)
    except Exception:
        # Un e-mail raté ne doit jamais bloquer une vente
        logger.exception("Erreur d'envoi d'e-mail pour %s", sale.invoice_number)