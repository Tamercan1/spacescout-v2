import os
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
import openai

from api.models import User, ProviderCredential
from api.engine.contracts import OrchestratorErrorCode
from api.engine.providers.openrouter import OpenRouterProvider, ProviderError
from api.engine.space_planner import run_space_planner, SpacePlannerError
from api.services.credentials import encrypt_credential


class HealthEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_check_success_unauthenticated(self):
        """Health endpoint must return HTTP 200 without requiring JWT authentication."""
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "healthy", "database": "connected"})

    def test_health_check_also_resolves_at_root_health(self):
        """Dual routing allows /health/ to resolve identically to /api/health/."""
        response = self.client.get("/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "healthy", "database": "connected"})

    @patch('api.views.connection.cursor')
    def test_health_check_database_failure(self, mock_cursor):
        """Database connection failure must return HTTP 503 without crashing or leaking details."""
        mock_cursor.side_effect = Exception("Simulated DB connection timeout")
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        data = response.json()
        self.assertEqual(data, {"status": "unhealthy", "database": "disconnected"})
        # Ensure no exception details or database config leaked
        self.assertNotIn("Simulated DB", str(data))
        self.assertNotIn("password", str(data))

    def test_health_check_independent_of_ai_keys(self):
        """Health endpoint remains healthy even when external AI keys are completely absent."""
        with patch.dict(os.environ, {}, clear=True):
            response = self.client.get("/api/health/")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.json()["status"], "healthy")


class AIProviderFallbackAndByokTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testpilot", password="password123")

    def test_missing_all_keys_actionable_error(self):
        """When neither user key nor shared fallback key exists, return actionable guidance."""
        with patch.dict(os.environ, {}, clear=True):
            if "OPENROUTER_API_KEY" in os.environ:
                del os.environ["OPENROUTER_API_KEY"]

            provider = OpenRouterProvider(user_id=self.user.id)
            with self.assertRaises(ProviderError) as ctx:
                provider._get_api_key()

            self.assertEqual(ctx.exception.error_code, OrchestratorErrorCode.MISSING_CREDENTIAL)
            self.assertIn("Settings", str(ctx.exception))
            self.assertIn("add your OpenRouter API key", str(ctx.exception))

    @patch('api.engine.providers.openrouter.get_provider_key')
    def test_user_byok_key_precedence(self, mock_get_key):
        """User BYOK key takes precedence over shared fallback key."""
        mock_get_key.return_value = "sk-or-v1-user-custom-key"
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-or-v1-shared-fallback-key"}):
            provider = OpenRouterProvider(user_id=self.user.id)
            self.assertEqual(provider._get_api_key(), "sk-or-v1-user-custom-key")
            self.assertTrue(provider._is_byok_key())

    def test_shared_fallback_used_when_user_has_no_byok(self):
        """Shared fallback key is used when user has not configured a custom key."""
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-or-v1-shared-fallback-key"}):
            provider = OpenRouterProvider(user_id=self.user.id)
            self.assertEqual(provider._get_api_key(), "sk-or-v1-shared-fallback-key")
            self.assertFalse(provider._is_byok_key())

    def test_shared_fallback_quota_error_messaging(self):
        """Shared fallback key quota/rate-limit error advises configuring BYOK key in Settings."""
        provider = OpenRouterProvider()
        mock_http_resp = MagicMock(status_code=429)
        err = openai.RateLimitError(message="Monthly spend limit exceeded", response=mock_http_resp, body={})

        mapped = provider._map_error(err, is_byok=False)
        self.assertEqual(mapped.error_code, OrchestratorErrorCode.PROVIDER_RATE_LIMITED)
        self.assertIn("Shared AI capacity is temporarily unavailable", str(mapped))
        self.assertIn("Settings", str(mapped))

    def test_user_byok_quota_error_messaging(self):
        """User BYOK key quota/rate-limit error advises checking their own account credits."""
        provider = OpenRouterProvider(user_id=self.user.id)
        mock_http_resp = MagicMock(status_code=429)
        err = openai.RateLimitError(message="Credit balance is too low", response=mock_http_resp, body={})

        mapped = provider._map_error(err, is_byok=True)
        self.assertEqual(mapped.error_code, OrchestratorErrorCode.PROVIDER_RATE_LIMITED)
        self.assertIn("Your OpenRouter account", str(mapped))
        self.assertNotIn("Shared AI capacity", str(mapped))

    def test_shared_fallback_auth_error_messaging(self):
        """Shared fallback key rejection advises configuring BYOK key."""
        provider = OpenRouterProvider()
        mock_http_resp = MagicMock(status_code=401)
        err = openai.AuthenticationError(message="Invalid API Key", response=mock_http_resp, body={})

        mapped = provider._map_error(err, is_byok=False)
        self.assertEqual(mapped.error_code, OrchestratorErrorCode.INVALID_CREDENTIAL)
        self.assertIn("Shared AI capacity is temporarily unavailable", str(mapped))

    def test_user_byok_auth_error_messaging(self):
        """User BYOK key rejection explicitly tells the user their key was invalid."""
        provider = OpenRouterProvider(user_id=self.user.id)
        mock_http_resp = MagicMock(status_code=401)
        err = openai.AuthenticationError(message="Invalid API Key", response=mock_http_resp, body={})

        mapped = provider._map_error(err, is_byok=True)
        self.assertEqual(mapped.error_code, OrchestratorErrorCode.INVALID_CREDENTIAL)
        self.assertIn("Your configured OpenRouter API key was rejected", str(mapped))

    def test_space_planner_missing_key_actionable_error(self):
        """Initial space planner raises clear SpacePlannerError when no key is configured."""
        with patch.dict(os.environ, {}, clear=True):
            if "OPENROUTER_API_KEY" in os.environ:
                del os.environ["OPENROUTER_API_KEY"]

            with self.assertRaises(SpacePlannerError) as ctx:
                run_space_planner("Explore Mars rovers", user=self.user)

            self.assertIn("Settings", str(ctx.exception))
            self.assertIn("No AI provider key is configured", str(ctx.exception))


class PlannerAPIErrorRedactionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="errorpilot", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = reverse('space_plan_create_view')

    @patch("api.views.run_space_planner")
    def test_internal_unhandled_planner_error_is_redacted(self, mock_planner):
        """Raw provider exception details, URLs, or traces must be redacted from API response."""
        mock_planner.side_effect = SpacePlannerError(
            "All 2 models failed. Last error: Connection reset by peer at 104.21.49.201:443",
            is_user_facing=False
        )
        response = self.client.post(self.url, {"prompt": "Explore Europa"})
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        data = response.json()
        self.assertEqual(data, {"detail": "Space exploration planner failed to execute. Please try again."})
        self.assertNotIn("104.21.49.201", str(data))
        self.assertNotIn("Connection reset", str(data))

    @patch("api.views.run_space_planner")
    def test_actionable_byok_error_is_preserved_in_api(self, mock_planner):
        """Safe actionable user guidance (e.g. check key in Settings) must be returned to client."""
        actionable_msg = "Your configured OpenRouter API key was rejected or invalid. Please check your key in Settings."
        mock_planner.side_effect = SpacePlannerError(actionable_msg, is_user_facing=True)
        response = self.client.post(self.url, {"prompt": "Explore Europa"})
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.json(), {"detail": actionable_msg})


class DeterministicOrderingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="orderpilot", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = reverse('space_plans')

    def test_plans_with_identical_timestamp_order_deterministically_by_id(self):
        """Plans sharing the exact same created_at timestamp must sort deterministically using -id."""
        from django.utils import timezone
        from api.models import SpacePlan
        now = timezone.now()

        p1 = SpacePlan.objects.create(user=self.user, title="Plan Alpha", prompt="Alpha", status="completed")
        p2 = SpacePlan.objects.create(user=self.user, title="Plan Beta", prompt="Beta", status="completed")
        p3 = SpacePlan.objects.create(user=self.user, title="Plan Gamma", prompt="Gamma", status="completed")

        # Force identical created_at timestamps across all three records
        SpacePlan.objects.filter(id__in=[p1.id, p2.id, p3.id]).update(created_at=now)

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [plan["id"] for plan in response.json()]
        # Newest ID must appear first when timestamps are tied
        self.assertEqual(returned_ids, [p3.id, p2.id, p1.id])


class SecurityRedirectAndHstsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_check_exempt_from_ssl_redirect(self):
        """Health endpoints must return HTTP 200 directly when SECURE_SSL_REDIRECT=True (not 301)."""
        with self.settings(
            SECURE_SSL_REDIRECT=True,
            SECURE_REDIRECT_EXEMPT=[r'^api/health/$', r'^health/$']
        ):
            # Plain HTTP request without X-Forwarded-Proto
            response_api = self.client.get("/api/health/")
            self.assertEqual(response_api.status_code, status.HTTP_200_OK)

            response_root = self.client.get("/health/")
            self.assertEqual(response_root.status_code, status.HTTP_200_OK)

    def test_non_health_route_redirects_when_ssl_redirect_enabled(self):
        """Non-exempt routes must be redirected to HTTPS when SECURE_SSL_REDIRECT=True."""
        with self.settings(
            SECURE_SSL_REDIRECT=True,
            SECURE_REDIRECT_EXEMPT=[r'^api/health/$', r'^health/$']
        ):
            response = self.client.get("/api/plans/")
            # Should redirect to HTTPS (301)
            self.assertEqual(response.status_code, status.HTTP_301_MOVED_PERMANENTLY)
            self.assertTrue(response.url.startswith("https://"))

