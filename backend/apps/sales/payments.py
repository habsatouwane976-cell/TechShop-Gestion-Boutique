"""
Paiement en ligne des commandes clients.

Modes de paiement instantanés : dès que le paiement est confirmé,
la commande passe automatiquement à « Complétée ».

⚠️  Passerelle de paiement simulée : aucune somme réelle n'est débitée.
    Pour passer en production, il suffit de remplacer le corps de
    `process_online_payment` par l'appel à l'API de Wave, d'Orange Money
    ou d'un prestataire de cartes bancaires (PayDunya, CinetPay, Stripe...).
"""
import logging
import uuid

logger = logging.getLogger('apps')

# Paiements confirmés immédiatement. Espèces (à la livraison), virement et crédit
# restent « En attente » : l'équipe valide la commande une fois l'argent reçu.
ONLINE_PAYMENT_METHODS = {'wave', 'orange_money', 'card'}


def process_online_payment(sale, method, phone=''):
    """
    Débite le client et retourne (succès, référence_de_transaction).
    Version démo : le paiement est toujours accepté.
    """
    reference = f"PAY-{uuid.uuid4().hex[:10].upper()}"
    logger.info(
        "Paiement %s accepté pour %s (%s FCFA) - réf. %s",
        method, sale.invoice_number, sale.total_amount, reference,
    )
    return True, reference
