from django.conf import settings
from django.db import models


class DonationOffer(models.Model):
    chef = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="donation_offers",
        limit_choices_to={"role": "CHEF"},
    )
    product = models.CharField(max_length=120)
    category = models.CharField(max_length=60)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20)
    expiration_date = models.DateField()
    location = models.CharField(max_length=120, default="Hammamet")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("expiration_date", "created_at")

    def __str__(self):
        return f"{self.product} — {self.quantity} {self.unit}"


class AssociationResponse(models.Model):
    class Status(models.TextChoices):
        ACCEPTED = "accepted", "Accepté"
        REFUSED = "refused", "Refusé"

    offer = models.ForeignKey(
        DonationOffer,
        on_delete=models.CASCADE,
        related_name="association_responses",
    )
    association = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="donation_responses",
        limit_choices_to={"role": "ASSOCIATION"},
    )
    status = models.CharField(max_length=10, choices=Status.choices)
    responded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("offer", "association"),
                name="unique_association_response_per_offer",
            )
        ]
        ordering = ("-responded_at",)

    def __str__(self):
        return f"{self.association} — {self.offer}: {self.status}"
