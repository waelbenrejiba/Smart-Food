
from django.core.management.base import BaseCommand
from donations.services import creer_propositions_don


class Command(BaseCommand):
    help = "Détecte les produits proches de leur expiration."

    def handle(self, *args, **options):
        resultat = creer_propositions_don()

        self.stdout.write(
            self.style.SUCCESS(
                f"Propositions créées : "
                f"{resultat['propositions_creees']}"
            )
        )
