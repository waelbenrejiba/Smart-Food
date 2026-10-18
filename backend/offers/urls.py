from django.urls import path

from .views import DonationOfferListCreateView, RespondToDonationOfferView

urlpatterns = [
    path("", DonationOfferListCreateView.as_view(), name="donation-offers"),
    path(
        "<int:pk>/respond/",
        RespondToDonationOfferView.as_view(),
        name="respond-to-donation-offer",
    ),
]
