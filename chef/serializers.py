
from rest_framework import serializers
from .models import Produit


class ProduitSerializer(serializers.ModelSerializer):
    stock_faible = serializers.ReadOnlyField()
    proche_expiration = serializers.ReadOnlyField()
    expire = serializers.ReadOnlyField()

    class Meta:
        model = Produit
        fields = [
            "id",
            "nom",
            "categorie",
            "quantite",
            "unite",
            "seuil_alerte",
            "date_expiration",
            "prix_unitaire",
            "description",
            "actif",
            "chef",
            "stock_faible",
            "proche_expiration",
            "expire",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "chef",
            "stock_faible",
            "proche_expiration",
            "expire",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        quantite = attrs.get(
            "quantite",
            getattr(self.instance, "quantite", None),
        )
        seuil = attrs.get(
            "seuil_alerte",
            getattr(self.instance, "seuil_alerte", None),
        )

        if quantite is not None and quantite < 0:
            raise serializers.ValidationError({
                "quantite": "La quantité ne peut pas être négative."
            })

        if seuil is not None and seuil < 0:
            raise serializers.ValidationError({
                "seuil_alerte": "Le seuil ne peut pas être négatif."
            })

        return attrs
