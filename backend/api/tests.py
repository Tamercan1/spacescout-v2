from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import User, UserProfile, SpacePlan, Discovery, Interaction


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

    def test_plan_update_title_and_archive(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('space_plan_detail_view', args=[self.plan1.id])
        
        # Test archive
        response = self.client.patch(url, {"is_archived": True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.plan1.refresh_from_db()
        self.assertTrue(self.plan1.is_archived)

        # Test title update
        response = self.client.patch(url, {"title": "Updated Title"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.plan1.refresh_from_db()
        self.assertEqual(self.plan1.title, "Updated Title")

    def test_plan_update_cannot_modify_server_fields(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('space_plan_detail_view', args=[self.plan1.id])
        
        # Attempt to modify read-only fields
        response = self.client.patch(url, {
            "prompt": "new prompt",
            "status": "failed",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.plan1.refresh_from_db()
        
        # Values should remain unchanged
        self.assertEqual(self.plan1.prompt, "test")
        self.assertEqual(self.plan1.status, "completed")

    def test_cannot_update_other_users_plan(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('space_plan_detail_view', args=[self.plan2.id])
        
        response = self.client.patch(url, {"title": "Stolen Plan"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        self.plan2.refresh_from_db()
        self.assertNotEqual(self.plan2.title, "Stolen Plan")


class InteractionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username="user1", password="testpassword123")
        self.user2 = User.objects.create_user(username="user2", password="testpassword123")

        self.plan1 = SpacePlan.objects.create(
            user=self.user1, title="Plan 1", prompt="test", status="completed"
        )
        self.discovery1 = Discovery.objects.create(
            space_plan=self.plan1, title="Discovery A", type="neo", source="neows", summary="A"
        )
        self.discovery2 = Discovery.objects.create(
            space_plan=self.plan1, title="Discovery B", type="neo", source="neows", summary="B"
        )

        self.plan2 = SpacePlan.objects.create(
            user=self.user2, title="Plan 2", prompt="test2", status="completed"
        )
        self.discovery_other = Discovery.objects.create(
            space_plan=self.plan2, title="Other Discovery", type="apod", source="apod", summary="C"
        )

        self.interactions_url = reverse('interaction_list_create', args=[self.plan1.id])
        self.interactions_url2 = reverse('interaction_list_create', args=[self.plan2.id])

    def test_create_interaction(self):
        self.client.force_authenticate(user=self.user1)
        data = {
            "user_prompt": "Find more asteroids like this",
            "interaction_type": "find_more",
        }
        response = self.client.post(self.interactions_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user_prompt"], "Find more asteroids like this")
        self.assertEqual(response.data["interaction_type"], "find_more")
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["space_plan"], self.plan1.id)

    def test_create_interaction_with_targets(self):
        self.client.force_authenticate(user=self.user1)
        data = {
            "user_prompt": "Compare these two",
            "interaction_type": "compare",
            "target_discoveries": [self.discovery1.id, self.discovery2.id],
        }
        response = self.client.post(self.interactions_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["target_discoveries"]), 2)

    def test_create_interaction_rejects_invalid_targets(self):
        """Target discoveries from another SpacePlan should be rejected."""
        self.client.force_authenticate(user=self.user1)
        data = {
            "user_prompt": "Compare these",
            "interaction_type": "compare",
            "target_discoveries": [self.discovery_other.id],
        }
        response = self.client.post(self.interactions_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_interactions(self):
        self.client.force_authenticate(user=self.user1)
        # Create two interactions
        Interaction.objects.create(
            space_plan=self.plan1, user_prompt="First", interaction_type="find_more"
        )
        Interaction.objects.create(
            space_plan=self.plan1, user_prompt="Second", interaction_type="enrich"
        )
        response = self.client.get(self.interactions_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        # Chronological order
        self.assertEqual(response.data[0]["user_prompt"], "First")
        self.assertEqual(response.data[1]["user_prompt"], "Second")

    def test_cannot_list_other_users_interactions(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.interactions_url2)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_create_interaction_on_other_users_plan(self):
        self.client.force_authenticate(user=self.user1)
        data = {
            "user_prompt": "Hack",
            "interaction_type": "other",
        }
        response = self.client.post(self.interactions_url2, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_set_server_controlled_fields(self):
        """Client should not be able to override status, completed_at, etc."""
        self.client.force_authenticate(user=self.user1)
        data = {
            "user_prompt": "Test",
            "interaction_type": "other",
        }
        response = self.client.post(self.interactions_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Status is always set to pending by the server
        self.assertEqual(response.data["status"], "pending")
        self.assertIsNone(response.data["completed_at"])

