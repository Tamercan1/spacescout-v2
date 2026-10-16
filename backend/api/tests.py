import json
from unittest.mock import patch, MagicMock
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

    def test_patch_current_user_unauthenticated(self):
        response = self.client.patch(self.me_url, {"preferred_model": "openrouter/free"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_current_user_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(self.me_url, {"preferred_model": "openrouter/free"})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["profile"]["preferred_model"], "openrouter/free")
        
        # Verify it persisted
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.preferred_model, "openrouter/free")

    def test_patch_current_user_clear_preference(self):
        self.client.force_authenticate(user=self.user)
        self.user.profile.preferred_model = "openrouter/free"
        self.user.profile.save()
        
        response = self.client.patch(self.me_url, {"preferred_model": ""})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["profile"]["preferred_model"], "")

    def test_patch_cannot_modify_other_fields(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(self.me_url, {
            "preferred_model": "openrouter/free",
            "username": "hackeduser"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "testuser")

    def test_complete_onboarding_unauthenticated(self):
        onboarding_url = reverse('complete_onboarding')
        response = self.client.post(onboarding_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_complete_onboarding_authenticated(self):
        self.client.force_authenticate(user=self.user)
        self.assertIsNone(self.user.profile.onboarding_completed_at)
        
        onboarding_url = reverse('complete_onboarding')
        response = self.client.post(onboarding_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data["profile"]["onboarding_completed_at"])
        
        self.user.profile.refresh_from_db()
        self.assertIsNotNone(self.user.profile.onboarding_completed_at)


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

    @patch("api.views.run_space_planner")
    def test_plan_creation_with_user_context_and_external_id_persistence(self, mock_planner):
        from api.engine.schema import SpacePlan as PydanticSpacePlan, Discovery as PydanticDiscovery
        mock_planner.return_value = PydanticSpacePlan(
            title="Cosmos Plan",
            summary="Cosmos exploration summary",
            discoveries=[
                PydanticDiscovery(
                    type="apod",
                    title="APOD Cosmic View",
                    date="2023-10-01",
                    media=None,
                    summary="A view of the cosmos",
                    why_interesting="Very interesting",
                    facts={"Feature Date": "2023-10-01"},
                    source="http://nasa.gov/apod"
                ),
                PydanticDiscovery(
                    type="nasa_images",
                    title="JWST Discovery",
                    date="2022-07-12",
                    media=None,
                    summary="Deep field",
                    why_interesting="Deep space",
                    facts={"NASA ID": "PIA25000"},
                    source="http://images.nasa.gov"
                )
            ]
        )

        self.client.force_authenticate(user=self.user1)
        url = reverse('space_plan_create_view')
        response = self.client.post(url, {"prompt": "Explore the cosmos"})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mock_planner.assert_called_once_with("Explore the cosmos", user=self.user1)

        saved_plan = SpacePlan.objects.get(id=response.data["id"])
        self.assertEqual(saved_plan.user, self.user1)
        
        apod_disc = saved_plan.discoveries.filter(source="apod").first()
        self.assertIsNotNone(apod_disc)
        self.assertEqual(apod_disc.external_id, "2023-10-01")

        nasa_disc = saved_plan.discoveries.filter(source="nasa_images").first()
        self.assertIsNotNone(nasa_disc)
        self.assertEqual(nasa_disc.external_id, "PIA25000")

    @patch("api.engine.space_planner.call_llm_with_fallback")
    def test_run_space_planner_uses_user_preferred_model(self, mock_llm_call):
        from api.engine.space_planner import run_space_planner
        self.user1.profile.preferred_model = "anthropic/claude-3.5-sonnet"
        self.user1.profile.save()

        # Mock LLM return message
        mock_message = MagicMock()
        mock_message.tool_calls = None
        mock_message.content = json.dumps({
            "title": "Mock Plan",
            "summary": "Mock Summary",
            "discoveries": []
        })
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_llm_call.return_value = mock_response

        plan = run_space_planner("Investigate Mars", user=self.user1)
        self.assertEqual(plan.title, "Mock Plan")

        # Verify preferred model was passed as the first model in model_list
        mock_llm_call.assert_called()
        first_call_kwargs = mock_llm_call.call_args_list[0][1]
        self.assertEqual(first_call_kwargs["model_list"][0], "anthropic/claude-3.5-sonnet")

    @patch("api.engine.space_planner.call_llm_with_fallback")
    @patch("api.services.credentials.get_provider_key")
    def test_run_space_planner_preserves_overrides_during_retry(self, mock_get_key, mock_llm_call):
        from api.engine.space_planner import run_space_planner, RESPONSE_FORMAT

        self.user1.profile.preferred_model = "anthropic/claude-3.5-sonnet"
        self.user1.profile.save()
        mock_get_key.return_value = "sk-or-v1-custom-user-key"

        # First call fails schema validation (invalid JSON)
        mock_message_invalid = MagicMock()
        mock_message_invalid.tool_calls = None
        mock_message_invalid.content = "INVALID NON-JSON OUTPUT {broken"
        mock_choice_invalid = MagicMock()
        mock_choice_invalid.message = mock_message_invalid
        mock_resp_invalid = MagicMock()
        mock_resp_invalid.choices = [mock_choice_invalid]

        # Second call (retry) returns valid SpacePlan schema
        mock_message_valid = MagicMock()
        mock_message_valid.tool_calls = None
        mock_message_valid.content = json.dumps({
            "title": "Retry Plan",
            "summary": "Retry Plan Summary",
            "discoveries": []
        })
        mock_choice_valid = MagicMock()
        mock_choice_valid.message = mock_message_valid
        mock_resp_valid = MagicMock()
        mock_resp_valid.choices = [mock_choice_valid]

        mock_llm_call.side_effect = [mock_resp_invalid, mock_resp_valid]

        plan = run_space_planner("Investigate Europa", user=self.user1)

        self.assertEqual(plan.title, "Retry Plan")
        self.assertEqual(mock_llm_call.call_count, 2)

        # First call kwargs
        first_kwargs = mock_llm_call.call_args_list[0][1]
        self.assertEqual(first_kwargs["client"].api_key, "sk-or-v1-custom-user-key")
        self.assertEqual(first_kwargs["model_list"][0], "anthropic/claude-3.5-sonnet")

        # Second call (retry) kwargs - MUST preserve both overrides
        retry_kwargs = mock_llm_call.call_args_list[1][1]
        self.assertEqual(retry_kwargs["client"].api_key, "sk-or-v1-custom-user-key")
        self.assertEqual(retry_kwargs["model_list"][0], "anthropic/claude-3.5-sonnet")
        self.assertEqual(retry_kwargs["response_format"], RESPONSE_FORMAT)
        self.assertEqual(retry_kwargs["tool_choice"], "none")

    @patch("api.views.run_space_planner")
    def test_plan_creation_planner_failure_returns_502(self, mock_planner):
        from api.engine.space_planner import SpacePlannerError
        mock_planner.side_effect = SpacePlannerError("All AI models are currently unavailable.")

        self.client.force_authenticate(user=self.user1)
        url = reverse('space_plan_create_view')
        response = self.client.post(url, {"prompt": "Explore the cosmos"})

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(
            response.data,
            {"detail": "Space exploration planner failed to execute. Please try again."}
        )
        self.assertNotIn("All AI models are currently unavailable.", str(response.data))
        self.assertFalse(SpacePlan.objects.filter(prompt="Explore the cosmos").exists())

    def test_plan_creation_validation_failure_returns_400(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse('space_plan_create_view')
        response = self.client.post(url, {"prompt": ""})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("prompt", response.data)

    def test_plan_list_default_returns_all_ordered_with_prefetch(self):
        from .models import DiscoveryMedia
        DiscoveryMedia.objects.create(
            discovery=self.discovery1,
            media_type="image",
            url="https://example.com/img1.jpg",
            is_primary=True,
        )

        plan_newer = SpacePlan.objects.create(
            user=self.user1, title="Newer Plan", prompt="test", status="completed"
        )
        disc_newer = Discovery.objects.create(
            space_plan=plan_newer, title="Newer Disc", type="general", source="general"
        )
        DiscoveryMedia.objects.create(
            discovery=disc_newer,
            media_type="image",
            url="https://example.com/img_newer.jpg",
            is_primary=True,
        )

        self.client.force_authenticate(user=self.user1)

        # Query count verification: 3 queries (plans, discoveries, discovery_media)
        with self.assertNumQueries(3):
            response = self.client.get(self.plans_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["id"], plan_newer.id)
        self.assertEqual(response.data[1]["id"], self.plan1.id)
        self.assertEqual(response.data[0]["discoveries"][0]["media"][0]["url"], "https://example.com/img_newer.jpg")

    def test_plan_list_filtering_archived(self):
        archived_plan = SpacePlan.objects.create(
            user=self.user1, title="Archived Plan", prompt="test", is_archived=True
        )

        self.client.force_authenticate(user=self.user1)

        # Filter ?archived=true
        resp_archived = self.client.get(self.plans_url, {"archived": "true"})
        self.assertEqual(resp_archived.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_archived.data), 1)
        self.assertEqual(resp_archived.data[0]["id"], archived_plan.id)

        # Filter ?is_archived=1
        resp_is_archived = self.client.get(self.plans_url, {"is_archived": "1"})
        self.assertEqual(resp_is_archived.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_is_archived.data), 1)
        self.assertEqual(resp_is_archived.data[0]["id"], archived_plan.id)

        # Filter ?archived=false
        resp_active = self.client.get(self.plans_url, {"archived": "false"})
        self.assertEqual(resp_active.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_active.data), 1)
        self.assertEqual(resp_active.data[0]["id"], self.plan1.id)

    def test_plan_list_filtering_status(self):
        pending_plan = SpacePlan.objects.create(
            user=self.user1, title="Pending Plan", prompt="test", status="pending"
        )

        self.client.force_authenticate(user=self.user1)

        resp_completed = self.client.get(self.plans_url, {"status": "completed"})
        self.assertEqual(resp_completed.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_completed.data), 1)
        self.assertEqual(resp_completed.data[0]["id"], self.plan1.id)

        resp_pending = self.client.get(self.plans_url, {"status": "pending"})
        self.assertEqual(resp_pending.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_pending.data), 1)
        self.assertEqual(resp_pending.data[0]["id"], pending_plan.id)

    def test_plan_list_filtering_search_and_ordering(self):
        plan_jupiter = SpacePlan.objects.create(
            user=self.user1, title="Jupiter Moons", prompt="test", summary="Europa exploration"
        )
        plan_mars = SpacePlan.objects.create(
            user=self.user1, title="Mars Rover", prompt="test", summary="Jezero exploration"
        )

        self.client.force_authenticate(user=self.user1)

        # Search by title
        resp_title = self.client.get(self.plans_url, {"search": "jupiter"})
        self.assertEqual(len(resp_title.data), 1)
        self.assertEqual(resp_title.data[0]["id"], plan_jupiter.id)

        # Search by summary
        resp_summary = self.client.get(self.plans_url, {"search": "jezero"})
        self.assertEqual(len(resp_summary.data), 1)
        self.assertEqual(resp_summary.data[0]["id"], plan_mars.id)

        # Ordering by title ascending
        resp_ordered = self.client.get(self.plans_url, {"ordering": "title"})
        titles = [p["title"] for p in resp_ordered.data]
        self.assertEqual(titles, sorted(titles))


from unittest.mock import patch

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
        
        # Prevent API tests from actually running the orchestration pipeline
        self.patcher = patch('api.services.interaction_execution.execute_interaction')
        self.mock_execute = self.patcher.start()

    def tearDown(self):
        self.patcher.stop()

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

class CredentialEncryptionTests(TestCase):
    def setUp(self):
        from cryptography.fernet import Fernet
        self.test_key = Fernet.generate_key().decode('utf-8')

    def test_encrypt_decrypt_round_trip(self):
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            from api.services.credentials import encrypt_credential, decrypt_credential
            plaintext = "sk-or-test-key-12345"
            ciphertext = encrypt_credential(plaintext)
            
            # Ciphertext differs from plaintext
            self.assertNotEqual(ciphertext, plaintext)
            self.assertNotIn(plaintext, ciphertext)
            
            # Round trip returns original
            decrypted = decrypt_credential(ciphertext)
            self.assertEqual(decrypted, plaintext)

    def test_randomized_encryption(self):
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            from api.services.credentials import encrypt_credential
            plaintext = "sk-test"
            cipher1 = encrypt_credential(plaintext)
            cipher2 = encrypt_credential(plaintext)
            # Fernet includes a timestamp/IV, so identical plaintexts produce different ciphertexts
            self.assertNotEqual(cipher1, cipher2)

    def test_missing_key_fails_securely(self):
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=None):
            from api.services.credentials import encrypt_credential
            from django.core.exceptions import ImproperlyConfigured
            with self.assertRaises(ImproperlyConfigured):
                encrypt_credential("test")

    def test_invalid_key_fails_securely(self):
        with self.settings(CREDENTIAL_ENCRYPTION_KEY="invalid-key"):
            from api.services.credentials import encrypt_credential
            from django.core.exceptions import ImproperlyConfigured
            with self.assertRaises(ImproperlyConfigured):
                encrypt_credential("test")

    def test_decryption_with_wrong_key_fails(self):
        from cryptography.fernet import Fernet
        wrong_key = Fernet.generate_key().decode('utf-8')
        
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            from api.services.credentials import encrypt_credential, decrypt_credential
            ciphertext = encrypt_credential("secret")
            
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=wrong_key):
            # Using the wrong key should raise ValueError without leaking internals
            with self.assertRaises(ValueError):
                decrypt_credential(ciphertext)

    def test_decryption_with_corrupted_ciphertext_fails(self):
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            from api.services.credentials import decrypt_credential
            with self.assertRaises(ValueError):
                decrypt_credential("not-a-valid-fernet-token")

class CredentialAPITests(TestCase):
    def setUp(self):
        from cryptography.fernet import Fernet
        self.test_key = Fernet.generate_key().decode('utf-8')
        
        self.client_a = APIClient()
        self.user_a = User.objects.create_user(username="usera", password="password123")
        self.client_a.force_authenticate(user=self.user_a)
        
        self.client_b = APIClient()
        self.user_b = User.objects.create_user(username="userb", password="password123")
        self.client_b.force_authenticate(user=self.user_b)
        
        self.unauth_client = APIClient()
        self.url = reverse('credential_list_create')

    def test_unauthenticated_requests_rejected(self):
        self.assertEqual(self.unauth_client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.unauth_client.post(self.url, {}).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.unauth_client.delete(reverse('credential_destroy', args=['openrouter'])).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_creation_and_leakage_audit(self):
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            plaintext = "sk-or-secret-key-1234"
            response = self.client_a.post(self.url, {"provider": "openrouter", "raw_key": plaintext})
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            
            # Response does not contain plaintext or ciphertext
            resp_str = str(response.data)
            self.assertNotIn(plaintext, resp_str)
            self.assertNotIn("encrypted_key", resp_str)
            self.assertNotIn("raw_key", resp_str)
            
            # Key hint generated safely
            self.assertEqual(response.data["key_hint"], "••••1234")
            
            # DB encrypted value != plaintext
            from api.models import ProviderCredential
            cred = ProviderCredential.objects.get(user=self.user_a, provider="openrouter")
            self.assertNotEqual(cred.encrypted_key, plaintext)

    def test_ownership(self):
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            self.client_a.post(self.url, {"provider": "openrouter", "raw_key": "sk-or-a"})
            self.client_b.post(self.url, {"provider": "nasa", "raw_key": "nasa-b"})
            
            # A sees A, B sees B
            resp_a = self.client_a.get(self.url)
            self.assertEqual(len(resp_a.data), 1)
            self.assertEqual(resp_a.data[0]["provider"], "openrouter")
            
            resp_b = self.client_b.get(self.url)
            self.assertEqual(len(resp_b.data), 1)
            self.assertEqual(resp_b.data[0]["provider"], "nasa")
            
            # A cannot delete B's
            del_resp = self.client_a.delete(reverse('credential_destroy', args=['nasa']))
            self.assertEqual(del_resp.status_code, status.HTTP_404_NOT_FOUND)
            
            # Credential still exists for B
            self.assertEqual(len(self.client_b.get(self.url).data), 1)

    def test_replacement(self):
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            from api.models import ProviderCredential
            self.client_a.post(self.url, {"provider": "openrouter", "raw_key": "sk-or-1111"})
            cred1 = ProviderCredential.objects.get(user=self.user_a, provider="openrouter")
            
            # Simulate it was validated
            cred1.is_valid = True
            cred1.save()
            
            # POST another key
            resp = self.client_a.post(self.url, {"provider": "openrouter", "raw_key": "sk-or-2222"})
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            self.assertEqual(resp.data["key_hint"], "••••2222")
            self.assertIsNone(resp.data["is_valid"])
            
            # Only one exists
            self.assertEqual(ProviderCredential.objects.count(), 1)
            cred2 = ProviderCredential.objects.get(user=self.user_a, provider="openrouter")
            self.assertNotEqual(cred1.encrypted_key, cred2.encrypted_key)

    def test_validation_errors(self):
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            # Invalid provider
            resp = self.client_a.post(self.url, {"provider": "invalid", "raw_key": "sk-or-1234"})
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertNotIn("sk-or-1234", str(resp.data))
            
            # Missing raw_key
            self.assertEqual(self.client_a.post(self.url, {"provider": "openrouter"}).status_code, status.HTTP_400_BAD_REQUEST)
            
            # Empty raw_key
            self.assertEqual(self.client_a.post(self.url, {"provider": "openrouter", "raw_key": "  "}).status_code, status.HTTP_400_BAD_REQUEST)
            
            # Client cannot provide fields
            resp2 = self.client_a.post(self.url, {
                "provider": "openrouter", 
                "raw_key": "sk-or-1234",
                "is_valid": True,
                "key_hint": "hack",
                "user": self.user_b.id
            })
            self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)
            self.assertIsNone(resp2.data["is_valid"])
            self.assertEqual(resp2.data["key_hint"], "••••1234")
            
            from api.models import ProviderCredential
            cred = ProviderCredential.objects.get(provider="openrouter")
            self.assertEqual(cred.user, self.user_a)

    def test_deletion(self):
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            self.client_a.post(self.url, {"provider": "openrouter", "raw_key": "sk-or-a"})
            self.assertEqual(self.client_a.delete(reverse('credential_destroy', args=['openrouter'])).status_code, status.HTTP_204_NO_CONTENT)
            
            # Non-existent behaves RESTfully
            self.assertEqual(self.client_a.delete(reverse('credential_destroy', args=['openrouter'])).status_code, status.HTTP_404_NOT_FOUND)

from unittest.mock import patch
import requests

class ProviderValidationTests(TestCase):
    def setUp(self):
        from cryptography.fernet import Fernet
        self.test_key = Fernet.generate_key().decode('utf-8')
        
        self.user_a = User.objects.create_user(username="usera", password="password123")
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)
        
        self.user_b = User.objects.create_user(username="userb", password="password123")
        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)
        
        # Give user A an openrouter and nasa key
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            from api.services.credentials import encrypt_credential
            from api.models import ProviderCredential
            ProviderCredential.objects.create(
                user=self.user_a,
                provider="openrouter",
                encrypted_key=encrypt_credential("sk-or-valid"),
                key_hint="valid",
            )
            ProviderCredential.objects.create(
                user=self.user_a,
                provider="nasa",
                encrypted_key=encrypt_credential("nasa-valid"),
                key_hint="valid",
            )
            
    def test_unauth_validation_rejected(self):
        client = APIClient()
        url = reverse('credential_validate', args=['openrouter'])
        self.assertEqual(client.post(url).status_code, status.HTTP_401_UNAUTHORIZED)
        
    def test_validate_other_user_credential_404(self):
        url = reverse('credential_validate', args=['openrouter'])
        # User B trying to validate, but B has no openrouter key
        self.assertEqual(self.client_b.post(url).status_code, status.HTTP_404_NOT_FOUND)
        
    def test_unsupported_provider(self):
        url = reverse('credential_validate', args=['aws'])
        self.assertEqual(self.client_a.post(url).status_code, status.HTTP_400_BAD_REQUEST)
        
    @patch('api.services.provider_validation.requests.get')
    def test_openrouter_valid(self, mock_get):
        mock_resp = requests.Response()
        mock_resp.status_code = 200
        mock_get.return_value = mock_resp
        
        url = reverse('credential_validate', args=['openrouter'])
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            resp = self.client_a.post(url)
            
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["is_valid"])
        self.assertIsNotNone(resp.data["validated_at"])
        
        # Check HTTP mock was called with correct decrypted key
        mock_get.assert_called_once()
        self.assertEqual(mock_get.call_args[1]["headers"]["Authorization"], "Bearer sk-or-valid")
        
        # Plaintext is not exposed
        self.assertNotIn("sk-or-valid", str(resp.data))
        
    @patch('api.services.provider_validation.requests.get')
    def test_openrouter_invalid(self, mock_get):
        mock_resp = requests.Response()
        mock_resp.status_code = 401
        mock_get.return_value = mock_resp
        
        url = reverse('credential_validate', args=['openrouter'])
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            resp = self.client_a.post(url)
            
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["is_valid"])
        self.assertIsNotNone(resp.data["validated_at"])
        
        # Verify db was updated
        from api.models import ProviderCredential
        cred = ProviderCredential.objects.get(user=self.user_a, provider="openrouter")
        self.assertFalse(cred.is_valid)
        
    @patch('api.services.provider_validation.requests.get')
    def test_openrouter_transient_error(self, mock_get):
        mock_get.side_effect = requests.RequestException("Timeout")
        
        url = reverse('credential_validate', args=['openrouter'])
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            resp = self.client_a.post(url)
            
        self.assertEqual(resp.status_code, status.HTTP_502_BAD_GATEWAY)
        
        # Existing state should remain None (since it started as None)
        from api.models import ProviderCredential
        cred = ProviderCredential.objects.get(user=self.user_a, provider="openrouter")
        self.assertIsNone(cred.is_valid)

    @patch('api.services.provider_validation.requests.get')
    def test_nasa_valid(self, mock_get):
        mock_resp = requests.Response()
        mock_resp.status_code = 200
        mock_get.return_value = mock_resp
        
        url = reverse('credential_validate', args=['nasa'])
        with self.settings(CREDENTIAL_ENCRYPTION_KEY=self.test_key):
            resp = self.client_a.post(url)
            
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["is_valid"])
        
        mock_get.assert_called_once()
        self.assertEqual(mock_get.call_args[0][0], "https://science.nasa.gov/wp-json/wp/v2/apod-basic")
        self.assertEqual(mock_get.call_args[1]["params"]["api_key"], "nasa-valid")
        self.assertNotIn("nasa-valid", str(resp.data))
