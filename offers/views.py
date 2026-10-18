from django.db import IntegrityError  # type: ignore[reportMissingModuleSource]
from django.db import transaction  # type: ignore[reportMissingModuleSource]
from django.db.models import Prefetch  # type: ignore[reportMissingModuleSource]
from django.shortcuts import get_object_or_404  # type: ignore[reportMissingModuleSource]
from rest_framework import generics, permissions, status  # type: ignore[reportMissingImports]
from rest_framework.exceptions import ValidationError  # type: ignore[reportMissingImports]
from rest_framework.response import Response  # type: ignore[reportMissingImports]
from rest_framework.views import APIView  # type: ignore[reportMissingImports]

from .models import AssociationResponse, DonationOffer
from .permissions import IsAssociation, IsChef
from .serializers import (
    AssociationResponseSerializer,
    CreateDonationOfferSerializer,
    DonationOfferSerializer,
)


class DonationOfferListCreateView(generics.ListCreateAPIView):
    queryset = DonationOffer.objects.select_related("chef")

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated(), IsChef()]
        return [permissions.IsAuthenticated(), IsAssociation()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateDonationOfferSerializer
        return DonationOfferSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.method == "GET" and self.request.user.is_authenticated:
            responses = AssociationResponse.objects.filter(
                association=self.request.user
            )
            return queryset.prefetch_related(
                Prefetch(
                    "association_responses",
                    queryset=responses,
                    to_attr="_current_association_responses",
                )
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save(chef=self.request.user)


class RespondToDonationOfferView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAssociation]

    def post(self, request, pk):
        offer = get_object_or_404(DonationOffer, pk=pk)
        serializer = AssociationResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if AssociationResponse.objects.filter(
            offer=offer,
            association=request.user,
        ).exists():
            raise ValidationError(
                {"status": "Une réponse a déjà été enregistrée pour ce don."}
            )

        try:
            with transaction.atomic():
                response = AssociationResponse.objects.create(
                    offer=offer,
                    association=request.user,
                    status=serializer.validated_data["status"],
                )
        except IntegrityError as exc:
            raise ValidationError(
                {"status": "Une réponse a déjà été enregistrée pour ce don."}
            ) from exc

        return Response(
            {
                "offer_id": offer.pk,
                "status": response.status,
                "responded_at": response.responded_at,
            },
            status=status.HTTP_201_CREATED,
        )
