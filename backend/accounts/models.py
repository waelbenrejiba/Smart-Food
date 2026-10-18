from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)

    class Role(models.TextChoices):
        CONSUMER = "CONSUMER", "Consommateur"
        CHEF = "CHEF", "Chef de restaurant"
        ASSOCIATION = "ASSOCIATION", "Association"
        ADMIN = "ADMIN", "Administrateur"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CONSUMER,
    )
