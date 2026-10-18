
from rest_framework import serializers
from .models import PropositionDon


class PropositionDonSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(
        source="produit.nom",
        read_only=True,
    )
    produit_categorie = serializers.CharField(
        source="produit.categorie",
        read_only=True,
    )
    produit_unite = serializers.CharField(
        source="produit.unite",
        read_only=True,
    )
    date_expiration = serializers.DateField(
        source="produit.date_expiration",
        read_only=True,
    )
    chef_email = serializers.EmailField(
        source="chef.email",
        read_only=True,
    )

    class Meta:
        model = PropositionDon
        fields = [
            "id",
            "produit",
            "produit_nom",
            "produit_categorie",
            "produit_unite",
            "date_expiration",
            "chef",
            "chef_email",
            "association",
            "quantite",
            "statut",
            "cree_le",
            "acceptee_le",
        ]
        read_only_fields = fields
