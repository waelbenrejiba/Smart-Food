from rest_framework import viewsets, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Produit
from datetime import timedelta

from django.utils import timezone
from django.db.models import F
from .serializers import ProduitSerializer
from ia.storage import recommander_stockage

class RecoStockageInput(serializers.Serializer):
    nom = serializers.CharField(max_length=150)
    categorie = serializers.ChoiceField(choices=Produit.Categorie.choices)
    etat = serializers.ChoiceField(
        choices=["frais", "cuit", "ouvert", "congele"], default="frais"
    )



class ProduitViewSet(viewsets.ModelViewSet):
    serializer_class = ProduitSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Produit.objects.filter(chef=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_active:
            raise PermissionDenied("Ce compte est inactif.")

        d = serializer.validated_data
        extra = {}

        if not d.get("consignes_stockage") or d.get("duree_conservation_jours") is None:
            reco = recommander_stockage(d["nom"], d.get("categorie", "AUTRE"))
            extra.update(
                mode_stockage=reco["mode_stockage"],
                temperature_min=reco["temperature_min"],
                temperature_max=reco["temperature_max"],
                duree_conservation_jours=reco["duree_conservation_jours"],
                consignes_stockage="\n".join(reco["consignes"]),
                reco_ia=reco,
            )

            if not d.get("date_expiration"):
                extra["date_expiration"] = reco["date_expiration_suggeree"]

        serializer.save(chef=user, **extra)

    @action(detail=False, methods=["get"], url_path="alertes")
    def alertes(self, request):
        today = timezone.localdate()
        base = self.get_queryset()

        expires = base.filter(date_expiration__lt=today)
        proches = base.filter(
            date_expiration__gte=today,
            date_expiration__lte=today + timedelta(days=3)
        )
        faible = base.filter(quantite__lte=F("seuil_alerte"))

        return Response({
            "expires": ProduitSerializer(expires, many=True).data,
            "proche_expiration": ProduitSerializer(proches, many=True).data,
            "stock_faible": ProduitSerializer(faible, many=True).data,
            "total": expires.count() + proches.count() + faible.count(),
        })

    @action(detail=False, methods=["post"], url_path="recommandation-stockage")
    def recommandation_stockage(self, request):
        s = RecoStockageInput(data=request.data)
        s.is_valid(raise_exception=True)
        return Response(recommander_stockage(**s.validated_data))
