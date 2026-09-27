from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import User, UserProfile, SpacePlan, Discovery


class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('index')
        self.token_url = reverse('access_token')

    def test_registration_creates_user_and_profile(self):
        data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        user = User.objects.get(username="testuser")
        self.assertTrue(user.check_password("testpassword123"))
        
        # Profile should be auto-created via signal
        self.assertTrue(UserProfile.objects.filter(user=user).exists())

    def test_login_returns_tokens(self):
        User.objects.create_user(username="testuser", password="testpassword123")
        
        data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        response = self.client.post(self.token_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)


class CurrentUserTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="testpassword123")
        # Profile created by signal
        self.me_url = reverse('current_user')

    def test_get_current_user_unauthenticated(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_current_user_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.me_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")
        self.assertIn("profile", response.data)
        self.assertEqual(response.data["profile"]["theme"], "system")


class SpacePlanTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username="user1", password="testpassword123")
        self.user2 = User.objects.create_user(username="user2", password="testpassword123")
        
        self.plan1 = SpacePlan.objects.create(
            user=self.user1, title="User 1 Plan", prompt="test", status="completed"
        )
        self.discovery1 = Discovery.objects.create(
            space_plan=self.plan1, title="Test Discovery", type="general", source="general"
        )
        
        self.plan2 = SpacePlan.objects.create(
            user=self.user2, title="User 2 Plan", prompt="test"
        )
        
        self.plans_url = reverse('space_plans')

    def test_unauthenticated_access_denied(self):
        response = self.client.get(self.plans_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_can_only_see_own_plans(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.plans_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "User 1 Plan")
        self.assertEqual(response.data[0]["status"], "completed")

    def test_plan_detail_returns_correct_fields(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('space_plan_detail_view', args=[self.plan1.id])
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "User 1 Plan")
        
        # Discoveries should be nested
        discoveries = response.data["discoveries"]
        self.assertEqual(len(discoveries), 1)
        self.assertEqual(discoveries[0]["title"], "Test Discovery")
        
        # Check that V2 fields are present
        self.assertIn("status", response.data)
        self.assertIn("is_archived", response.data)
        self.assertIn("source_url", discoveries[0])
        self.assertIn("media", discoveries[0])
