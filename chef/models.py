from django.db import models

# Create your models here.

import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Produit(models.Model):
    class ModeStockage(models.TextChoices):
        AMBIANT = "AMBIANT", "Température ambiante"
        REFRIGERE = "REFRIGERE", "Réfrigéré"
        CONGELE = "CONGELE", "Congelé"
    class Categorie(models.TextChoices):
        FRUITS = "FRUITS", "Fruits"
        LEGUMES = "LEGUMES", "Légumes"
        VIANDES = "VIANDES", "Viandes"
        POISSONS = "POISSONS", "Poissons"
        PRODUITS_LAITIERS = "LAITIERS", "Produits laitiers"
        BOULANGERIE = "BOULANGERIE", "Boulangerie"
        AUTRE = "AUTRE", "Autre"

    class Unite(models.TextChoices):
        KG = "KG", "Kilogramme"
        LITRE = "L", "Litre"
        PIECE = "PIECE", "Pièce"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    mode_stockage = models.CharField(
        max_length=12, choices=ModeStockage.choices,
        default=ModeStockage.AMBIANT, blank=True,
    )
    nom = models.CharField(max_length=150)
    categorie = models.CharField(
        max_length=20,
        choices=Categorie.choices,
        default=Categorie.AUTRE
    )
    quantite = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    temperature_min = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    temperature_max = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    duree_conservation_jours = models.PositiveIntegerField(null=True, blank=True)
    consignes_stockage = models.TextField(blank=True, default="")
    reco_ia = models.JSONField(default=dict, blank=True) 
    unite = models.CharField(
        max_length=10,
        choices=Unite.choices,
        default=Unite.KG
    )
    seuil_alerte = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=5,
        validators=[MinValueValidator(0)]
    )
    date_expiration = models.DateField(null=True, blank=True)
    prix_unitaire = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    description = models.TextField(blank=True, default="")
    actif = models.BooleanField(default=True)

    chef = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="produits",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date_expiration", "nom"]
        verbose_name = "Produit"
        verbose_name_plural = "Produits"

    def __str__(self):
        return f"{self.nom} — {self.quantite} {self.unite}"

    @property
    def stock_faible(self):
        return self.quantite <= self.seuil_alerte

    @property
    def proche_expiration(self):
        if self.date_expiration is None:
            return False

        jours_restants = (self.date_expiration - timezone.localdate()).days
        return 0 <= jours_restants <= 3

    @property
    def expire(self):
        if self.date_expiration is None:
            return False

        return self.date_expiration < timezone.localdate()
