
from django.conf import settings
from django.db import models


class PropositionDon(models.Model):
    class Statut(models.TextChoices):
        DISPONIBLE = "DISPONIBLE", "Disponible"
        ACCEPTEE = "ACCEPTEE", "Acceptée"
        ANNULEE = "ANNULEE", "Annulée"
        EXPIREE = "EXPIREE", "Expirée"

    produit = models.OneToOneField(
        "chef.Produit",
        on_delete=models.PROTECT,
        related_name="proposition_don",
    )

    chef = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dons_proposes",
    )

    association = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dons_acceptes",
        null=True,
        blank=True,
    )

    quantite = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.DISPONIBLE,
    )

    cree_le = models.DateTimeField(auto_now_add=True)
    acceptee_le = models.DateTimeField(null=True, blank=True)

    notification_envoyee = models.BooleanField(default=False)

    class Meta:
      
        ordering = ["-cree_le"]
    def __str__(self):
        return f"Don #{self.pk} - {self.produit.nom}"
