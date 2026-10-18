
import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def notifier_chef_don_accepte(proposition):
    chef_email = proposition.chef.email

    if not chef_email:
        logger.warning(
            "Aucun email pour le chef de la proposition %s",
            proposition.pk,
        )
        return False

    sujet = f"SmartFood : don accepté - {proposition.produit.nom}"

    message = (
        f"Bonjour,\n\n"
        f"Votre proposition de don a été acceptée.\n\n"
        f"Produit : {proposition.produit.nom}\n"
        f"Quantité : {proposition.quantite} "
        f"{proposition.produit.unite}\n"
        f"Association : {proposition.association}\n"
        f"Date d'expiration : "
        f"{proposition.produit.date_expiration}\n\n"
        f"Connectez-vous à SmartFood pour consulter les détails.\n"
    )

    try:
        envoye = send_mail(
            sujet,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [chef_email],
            fail_silently=False,
        )
        return envoye == 1
    except Exception:
        logger.exception(
            "Échec de l'email pour la proposition %s",
            proposition.pk,
        )
        return False
