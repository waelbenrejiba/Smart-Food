from datetime import date, timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AssociationResponse, DonationOffer


User = get_user_model()


class DonationOfferApiTests(APITestCase):
    def setUp(self):
        self.chef = User.objects.create_user(
            username="chef",
            email="chef@example.com",
            password="Chef!Secure2026",
            first_name="Le",
            last_name="Jardin",
            role="CHEF",
        )
        self.association = User.objects.create_user(
            username="association",
            email="association@example.com",
            password="Association!2026",
            role="ASSOCIATION",
        )
        self.offer_data = {
            "product": "Tomates",
            "category": "Légumes",
            "quantity": "4.00",
            "unit": "kg",
            "expiration_date": (date.today() + timedelta(days=2)).isoformat(),
            "location": "Hammamet",
        }

    def test_chef_can_create_offer_and_association_can_list_it(self):
        self.client.force_authenticate(user=self.chef)
        create_response = self.client.post(
            "/api/offers/",
            self.offer_data,
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        offer = DonationOffer.objects.get()
        self.assertEqual(offer.chef, self.chef)

        self.client.force_authenticate(user=self.association)
        list_response = self.client.get("/api/offers/")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["product"], "Tomates")
        self.assertEqual(list_response.data[0]["restaurant"], "Le Jardin")
        self.assertEqual(list_response.data[0]["status"], "pending")

    def test_association_can_refuse_offer_and_cannot_change_its_response(self):
        offer = DonationOffer.objects.create(chef=self.chef, **self.offer_data)
        self.client.force_authenticate(user=self.association)

        response = self.client.post(
            f"/api/offers/{offer.pk}/respond/",
            {"status": "refused"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "refused")
        self.assertEqual(AssociationResponse.objects.get().association, self.association)

        duplicate_response = self.client.post(
            f"/api/offers/{offer.pk}/respond/",
            {"status": "accepted"},
            format="json",
        )

        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(AssociationResponse.objects.count(), 1)

        list_response = self.client.get("/api/offers/")
        self.assertEqual(list_response.data[0]["status"], "refused")

    def test_association_can_accept_offer(self):
        offer = DonationOffer.objects.create(chef=self.chef, **self.offer_data)
        self.client.force_authenticate(user=self.association)

        response = self.client.post(
            f"/api/offers/{offer.pk}/respond/",
            {"status": "accepted"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "accepted")

    def test_response_is_private_to_each_association(self):
        offer = DonationOffer.objects.create(chef=self.chef, **self.offer_data)
        self.client.force_authenticate(user=self.association)
        self.client.post(
            f"/api/offers/{offer.pk}/respond/",
            {"status": "accepted"},
            format="json",
        )

        another_association = User.objects.create_user(
            username="association2",
            email="association2@example.com",
            password="Association!2026",
            role="ASSOCIATION",
        )
        self.client.force_authenticate(user=another_association)
        response = self.client.get("/api/offers/")

        self.assertEqual(response.data[0]["status"], "pending")

    def test_consumer_cannot_create_or_list_offers(self):
        consumer = User.objects.create_user(
            username="consumer",
            email="consumer@example.com",
            password="Consumer!2026",
            role="CONSUMER",
        )
        self.client.force_authenticate(user=consumer)

        create_response = self.client.post(
            "/api/offers/",
            self.offer_data,
            format="json",
        )
        list_response = self.client.get("/api/offers/")

        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(list_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_user_cannot_list_offers(self):
        response = self.client.get("/api/offers/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
