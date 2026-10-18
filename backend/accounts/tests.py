from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class AccountApiTests(APITestCase):
    def setUp(self):
        self.registration_data = {
            "username": "amina",
            "email": "amina@example.com",
            "password": "SafeFood!2026",
            "first_name": "Amina",
            "last_name": "Ben Ali",
            "role": "CONSUMER",
        }

    def test_register_creates_user_with_hashed_password(self):
        response = self.client.post(
            "/api/users/register/",
            self.registration_data,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="amina")
        self.assertTrue(user.check_password(self.registration_data["password"]))
        self.assertNotIn("password", response.data)

    def test_register_rejects_admin_role(self):
        response = self.client.post(
            "/api/users/register/",
            {**self.registration_data, "role": "ADMIN"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    def test_register_rejects_duplicate_email_case_insensitively(self):
        User.objects.create_user(
            username="existing",
            email=self.registration_data["email"],
            password="AnotherSafe!2026",
        )

        response = self.client.post(
            "/api/users/register/",
            {**self.registration_data, "email": self.registration_data["email"].upper()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_login_returns_jwt_tokens_and_profile_is_authenticated(self):
        User.objects.create_user(
            username="amina",
            email="amina@example.com",
            password=self.registration_data["password"],
            first_name="Amina",
            last_name="Ben Ali",
            role="ASSOCIATION",
        )

        login_response = self.client.post(
            "/api/auth/login/",
            {
                "username": "amina",
                "password": self.registration_data["password"],
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", login_response.data)
        self.assertIn("refresh", login_response.data)

        profile_response = self.client.get(
            "/api/users/me/",
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}",
        )

        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_response.data["role"], "ASSOCIATION")
        self.assertEqual(profile_response.data["email"], "amina@example.com")

    def test_profile_requires_authentication(self):
        response = self.client.get("/api/users/me/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
