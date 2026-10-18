from django.db import models



import uuid

from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        CHEF = "CHEF", "Chef de restaurant"
        ASSOCIATION = "ASSOCIATION", "Association"
        CONSUMER = "CONSUMER", "Consommateur"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CONSUMER
    )

    def __str__(self):
        return f"{self.username} - {self.role}"
