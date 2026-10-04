import os
from unittest.mock import patch, MagicMock
from django.test import TestCase
import openai

from api.models import User, UserProfile
from api.engine.contracts import LLMMessage, OrchestratorErrorCode, ToolCall
from api.engine.providers.openrouter import OpenRouterProvider, ProviderError

class OpenRouterProviderTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        # Ensure profile exists and has a preference
        profile = UserProfile.objects.get(user=self.user)
        profile.preferred_model = "custom/model"
        profile.save()
        
    @patch('api.engine.providers.openrouter.get_provider_key')
    def test_missing_credential(self, mock_get_key):
        mock_get_key.return_value = None
        
        with patch.dict(os.environ, clear=True):
            if "OPENROUTER_API_KEY" in os.environ:
                del os.environ["OPENROUTER_API_KEY"]
                
            provider = OpenRouterProvider(user_id=self.user.id)
            with self.assertRaises(ProviderError) as context:
                provider._get_api_key()
            self.assertEqual(context.exception.error_code, OrchestratorErrorCode.MISSING_CREDENTIAL)
            # Security: Ensure error message does not contain any key
            self.assertNotIn("sk-", str(context.exception))
            
    @patch('api.engine.providers.openrouter.get_provider_key')
    def test_valid_credential_user(self, mock_get_key):
        mock_get_key.return_value = "sk-test-user-key"
        provider = OpenRouterProvider(user_id=self.user.id)
        self.assertEqual(provider._get_api_key(), "sk-test-user-key")
        
    def test_valid_credential_env(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-test-env-key"}):
            provider = OpenRouterProvider() # no user
            self.assertEqual(provider._get_api_key(), "sk-test-env-key")

    def test_model_selection_user_preference(self):
        provider = OpenRouterProvider(user_id=self.user.id)
        self.assertEqual(provider._get_model(), "custom/model")
        
    def test_model_selection_env_fallback(self):
        # User has no preference
        UserProfile.objects.filter(user=self.user).update(preferred_model="")
        provider = OpenRouterProvider(user_id=self.user.id)
        with patch.dict(os.environ, {"LLM_MODEL": "env/model"}):
            self.assertEqual(provider._get_model(), "env/model")
            
    def test_model_selection_default_fallback(self):
        UserProfile.objects.filter(user=self.user).update(preferred_model="")
        provider = OpenRouterProvider(user_id=self.user.id)
        
        with patch.dict(os.environ, clear=True):
            if "LLM_MODEL" in os.environ:
                del os.environ["LLM_MODEL"]
            self.assertEqual(provider._get_model(), "openrouter/free")

    def test_model_selection_requested_override(self):
        provider = OpenRouterProvider(user_id=self.user.id)
        self.assertEqual(provider._get_model("requested/model"), "requested/model")
        
    def test_message_translation(self):
        provider = OpenRouterProvider()
        messages = [
            LLMMessage(role="system", content="You are AI"),
            LLMMessage(role="user", content="Hello"),
            LLMMessage(role="assistant", tool_calls=[{"id": "call_1", "type": "function", "function": {"name": "test", "arguments": "{}"}}]),
            LLMMessage(role="tool", content="Result", tool_call_id="call_1"),
        ]
        translated = provider._convert_messages(messages)
        self.assertEqual(len(translated), 4)
        self.assertEqual(translated[0]["role"], "system")
        self.assertEqual(translated[0]["content"], "You are AI")
        self.assertNotIn("tool_calls", translated[0])
        
        self.assertEqual(translated[2]["role"], "assistant")
        self.assertIn("tool_calls", translated[2])
        
        self.assertEqual(translated[3]["role"], "tool")
        self.assertEqual(translated[3]["content"], "Result")
        self.assertEqual(translated[3]["tool_call_id"], "call_1")

    @patch('api.engine.providers.openrouter.openai.OpenAI')
    @patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-test-env-key"})
    def test_generate_normal_response(self, mock_openai):
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "I am an AI"
        mock_choice.message.tool_calls = None
        mock_choice.finish_reason = "stop"
        mock_response.choices = [mock_choice]
        mock_response.model = "openrouter/free"
        mock_response.usage.prompt_tokens = 10
        mock_response.usage.completion_tokens = 20
        mock_response.usage.total_tokens = 30
        
        mock_client.chat.completions.create.return_value = mock_response
        
        provider = OpenRouterProvider()
        messages = [LLMMessage(role="user", content="Hi")]
        
        resp = provider.generate(messages=messages)
        
        self.assertEqual(resp.content, "I am an AI")
        self.assertEqual(resp.finish_reason, "stop")
        self.assertEqual(resp.model, "openrouter/free")
        self.assertEqual(resp.usage["total_tokens"], 30)
        self.assertEqual(len(resp.tool_calls), 0)
        
        # Security: ensure credential is not leaked
        self.assertNotIn("sk-test-env-key", str(resp))

    @patch('api.engine.providers.openrouter.openai.OpenAI')
    @patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-test-env-key"})
    def test_generate_tool_call(self, mock_openai):
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = None
        
        mock_tc = MagicMock()
        mock_tc.function.name = "search_apod"
        mock_tc.function.arguments = '{"date": "2026-10-04"}'
        mock_choice.message.tool_calls = [mock_tc]
        mock_choice.finish_reason = "tool_calls"
        mock_response.choices = [mock_choice]
        
        mock_client.chat.completions.create.return_value = mock_response
        
        provider = OpenRouterProvider()
        messages = [LLMMessage(role="user", content="Show apod")]
        
        resp = provider.generate(messages=messages)
        self.assertEqual(len(resp.tool_calls), 1)
        self.assertEqual(resp.tool_calls[0].tool_name, "search_apod")
        self.assertEqual(resp.tool_calls[0].arguments, {"date": "2026-10-04"})

    @patch('api.engine.providers.openrouter.openai.OpenAI')
    @patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-test-env-key"})
    def test_generate_malformed_tool_call(self, mock_openai):
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        mock_response = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = None
        
        mock_tc = MagicMock()
        mock_tc.function.name = "search_apod"
        mock_tc.function.arguments = 'not json'
        mock_choice.message.tool_calls = [mock_tc]
        mock_response.choices = [mock_choice]
        
        mock_client.chat.completions.create.return_value = mock_response
        
        provider = OpenRouterProvider()
        with self.assertRaises(ProviderError) as context:
            provider.generate(messages=[LLMMessage(role="user", content="Hi")])
            
        self.assertEqual(context.exception.error_code, OrchestratorErrorCode.MODEL_ERROR)

    @patch('api.engine.providers.openrouter.openai.OpenAI')
    @patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-test-env-key"})
    def test_error_mapping_401(self, mock_openai):
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        mock_http_response = MagicMock()
        mock_http_response.status_code = 401
        
        mock_client.chat.completions.create.side_effect = openai.AuthenticationError(
            message="Invalid token", 
            response=mock_http_response,
            body={}
        )
        
        provider = OpenRouterProvider()
        with self.assertRaises(ProviderError) as context:
            provider.generate(messages=[LLMMessage(role="user", content="Hi")])
            
        self.assertEqual(context.exception.error_code, OrchestratorErrorCode.INVALID_CREDENTIAL)
        # Security: ensure key is not in error
        self.assertNotIn("sk-test-env-key", str(context.exception))

    @patch('api.engine.providers.openrouter.openai.OpenAI')
    @patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-test-env-key"})
    def test_error_mapping_403(self, mock_openai):
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        mock_http_response = MagicMock()
        mock_http_response.status_code = 403
        
        mock_client.chat.completions.create.side_effect = openai.PermissionDeniedError(
            message="Permission denied", 
            response=mock_http_response,
            body={}
        )
        
        provider = OpenRouterProvider()
        with self.assertRaises(ProviderError) as context:
            provider.generate(messages=[LLMMessage(role="user", content="Hi")])
            
        self.assertEqual(context.exception.error_code, OrchestratorErrorCode.INVALID_CREDENTIAL)
        self.assertNotIn("sk-test-env-key", str(context.exception))

    @patch('api.engine.providers.openrouter.openai.OpenAI')
    @patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-test-env-key"})
    def test_error_mapping_429(self, mock_openai):
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        mock_http_response = MagicMock()
        mock_http_response.status_code = 429
        mock_client.chat.completions.create.side_effect = openai.RateLimitError(
            message="Too many requests",
            response=mock_http_response,
            body={}
        )
        
        provider = OpenRouterProvider()
        with self.assertRaises(ProviderError) as context:
            provider.generate(messages=[LLMMessage(role="user", content="Hi")])
            
        self.assertEqual(context.exception.error_code, OrchestratorErrorCode.PROVIDER_RATE_LIMITED)

    @patch('api.engine.providers.openrouter.openai.OpenAI')
    @patch.dict(os.environ, {"OPENROUTER_API_KEY": "sk-test-env-key"})
    def test_error_mapping_network(self, mock_openai):
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        
        mock_client.chat.completions.create.side_effect = openai.APIConnectionError(
            message="Network down",
            request=MagicMock()
        )
        
        provider = OpenRouterProvider()
        with self.assertRaises(ProviderError) as context:
            provider.generate(messages=[LLMMessage(role="user", content="Hi")])
            
        self.assertEqual(context.exception.error_code, OrchestratorErrorCode.PROVIDER_UNAVAILABLE)
