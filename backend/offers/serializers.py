from rest_framework import serializers

from .models import AssociationResponse, DonationOffer


class DonationOfferSerializer(serializers.ModelSerializer):
    restaurant = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = DonationOffer
        fields = (
            "id",
            "product",
            "category",
            "quantity",
            "unit",
            "expiration_date",
            "restaurant",
            "location",
            "status",
        )
        read_only_fields = ("id", "restaurant", "status")

    def get_restaurant(self, offer):
        full_name = offer.chef.get_full_name().strip()
        return full_name or offer.chef.username

    def get_status(self, offer):
        responses = getattr(offer, "_current_association_responses", [])
        response = responses[0] if responses else None
        return response.status if response else "pending"


class CreateDonationOfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonationOffer
        fields = (
            "id",
            "product",
            "category",
            "quantity",
            "unit",
            "expiration_date",
            "location",
        )
        read_only_fields = ("id",)
        extra_kwargs = {
            "category": {"required": False, "default": "Autres"},
            "location": {"required": False, "default": "Hammamet"},
        }

    def validate_product(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le nom du produit est obligatoire.")
        return value

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("La quantité doit être supérieure à zéro.")
        return value

    def validate_unit(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("L’unité est obligatoire.")
        return value

    def validate_location(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le lieu est obligatoire.")
        return value


class AssociationResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=AssociationResponse.Status.choices)
