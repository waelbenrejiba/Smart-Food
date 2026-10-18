
from django.db import transaction
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from chef.models import Produit
from .models import PropositionDon
from .serializers import PropositionDonSerializer
from notifications.services import notifier_chef_don_accepte


def est_association(user):
    # Adapte cette valeur au nom exact de ton rôle dans le modèle User.
    return str(getattr(user, "role", "")).upper() == "ASSOCIATION"


class PropositionDonViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PropositionDonSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if est_association(user):
            return PropositionDon.objects.filter(
                statut=PropositionDon.Statut.DISPONIBLE,
                produit__date_expiration__gte=timezone.localdate(),
            ).select_related("produit", "chef", "association")

        # Le chef ne voit que ses propres propositions.
        return PropositionDon.objects.filter(
            chef=user
        ).select_related("produit", "chef", "association")

    @action(detail=True, methods=["post"], url_path="accepter")
    def accepter(self, request, pk=None):
        if not est_association(request.user):
            raise PermissionDenied(
                "Seule une association peut accepter un don."
            )

        # Verrouille la proposition et le produit pendant l'opération.
        with transaction.atomic():
            proposition = (
                PropositionDon.objects.select_for_update()
                .select_related("produit")
                .filter(pk=pk)
                .first()
            )

            if proposition is None:
                return Response(
                    {"detail": "Proposition introuvable."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if proposition.statut != PropositionDon.Statut.DISPONIBLE:
                raise ValidationError(
                    "Cette proposition n'est plus disponible."
                )

            produit = (
                Produit.objects.select_for_update()
                .get(pk=proposition.produit_id)
            )

            aujourd_hui = timezone.localdate()

            if (
                produit.date_expiration is None
                or produit.date_expiration < aujourd_hui
            ):
                proposition.statut = PropositionDon.Statut.EXPIREE
                proposition.save(update_fields=["statut"])
                raise ValidationError(
                    "Ce produit est périmé ou sa date d'expiration manque."
                )

            if produit.quantite < proposition.quantite:
                raise ValidationError(
                    "La quantité disponible est insuffisante."
                )

            # Réserve le don en retirant la quantité du stock disponible.
            produit.quantite -= proposition.quantite
            produit.save(update_fields=["quantite"])

            proposition.association = request.user
            proposition.statut = PropositionDon.Statut.ACCEPTEE
            proposition.acceptee_le = timezone.now()
            proposition.save(
                update_fields=[
                    "association",
                    "statut",
                    "acceptee_le",
                ]
            )

        # L'acceptation est enregistrée avant l'envoi de l'email.
        email_envoye = notifier_chef_don_accepte(proposition)

        if email_envoye:
            proposition.notification_envoyee = True
            proposition.save(update_fields=["notification_envoyee"])

        return Response(
            {
                "message": "Don accepté avec succès.",
                "email_envoye": email_envoye,
                "proposition": PropositionDonSerializer(
                    proposition
                ).data,
            },
            status=status.HTTP_200_OK,
        )
