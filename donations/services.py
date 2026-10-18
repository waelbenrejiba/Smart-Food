
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from chef.models import Produit
from .models import PropositionDon


def creer_propositions_don():
    aujourd_hui = timezone.localdate()
    date_limite = aujourd_hui + timedelta(days=7)

    produits = Produit.objects.filter(
        date_expiration__gte=aujourd_hui,
        date_expiration__lte=date_limite,
        quantite__gt=0,
    ).select_related("chef")

    creees = 0

    for produit in produits.iterator():
        with transaction.atomic():
            _, created = PropositionDon.objects.get_or_create(
                produit=produit,
                defaults={
                    "chef": produit.chef,
                    "quantite": produit.quantite,
                    "statut": PropositionDon.Statut.DISPONIBLE,
                },
            )
            if created:
                creees += 1

    return {
        "propositions_creees": creees,
        "date_debut": str(aujourd_hui),
        "date_fin": str(date_limite),
    }
