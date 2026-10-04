import os
import json
from typing import Any
import openai

from api.engine.contracts import (
    BaseLLMProvider,
    LLMMessage,
    LLMResponse,
    ToolCall,
    OrchestratorErrorCode,
)
from api.models import User
from api.services.credentials import get_provider_key


class ProviderError(Exception):
    def __init__(self, message: str, error_code: str):
        super().__init__(message)
        self.error_code = error_code


class OpenRouterProvider(BaseLLMProvider):
    def __init__(self, user_id: int | None = None):
        self.user_id = user_id

    def _get_api_key(self) -> str:
        """
        Securely retrieves the API key without storing it in instance state longer than necessary.
        Fallback order:
        1. User's decrypted BYOK credential
        2. Application default OPENROUTER_API_KEY
        """
        if self.user_id:
            try:
                user = User.objects.get(id=self.user_id)
                key = get_provider_key(user, "openrouter")
                if key:
                    return key
            except User.DoesNotExist:
                pass

        app_key = os.getenv("OPENROUTER_API_KEY")
        if app_key:
            return app_key

        raise ProviderError(
            "No OpenRouter credential available.",
            OrchestratorErrorCode.MISSING_CREDENTIAL
        )

    def _get_model(self, requested_model: str | None = None) -> str:
        """
        Model fallback logic.
        1. requested_model override
        2. UserProfile.preferred_model
        3. LLM_MODEL environment variable
        4. "openrouter/free"
        """
        if requested_model:
            return requested_model

        if self.user_id:
            try:
                user = User.objects.get(id=self.user_id)
                if hasattr(user, 'profile') and user.profile.preferred_model:
                    return user.profile.preferred_model
            except User.DoesNotExist:
                pass

        env_model = os.getenv("LLM_MODEL")
        if env_model:
            return env_model

        return "openrouter/free"

    def _map_error(self, exc: Exception) -> ProviderError:
        """Map provider exceptions to generic OrchestratorErrorCode."""
        if isinstance(exc, (openai.AuthenticationError, openai.PermissionDeniedError)):
            return ProviderError("Invalid OpenRouter credentials or permission denied.", OrchestratorErrorCode.INVALID_CREDENTIAL)
        elif isinstance(exc, openai.RateLimitError):
            return ProviderError("OpenRouter rate limit exceeded.", OrchestratorErrorCode.PROVIDER_RATE_LIMITED)
        elif isinstance(exc, openai.APITimeoutError):
            return ProviderError("OpenRouter API request timed out.", OrchestratorErrorCode.PROVIDER_UNAVAILABLE)
        elif isinstance(exc, openai.APIConnectionError):
            return ProviderError("Network error connecting to OpenRouter.", OrchestratorErrorCode.PROVIDER_UNAVAILABLE)
        elif isinstance(exc, openai.APIStatusError):
            if exc.status_code >= 500:
                return ProviderError("OpenRouter service is unavailable.", OrchestratorErrorCode.PROVIDER_UNAVAILABLE)
            elif exc.status_code == 400:
                error_msg = str(exc).lower()
                if "context" in error_msg or "length" in error_msg:
                    return ProviderError("Context too large.", OrchestratorErrorCode.CONTEXT_TOO_LARGE)
                return ProviderError("Bad request to OpenRouter.", OrchestratorErrorCode.UNEXPECTED_ERROR)
            return ProviderError(f"OpenRouter API error (status {exc.status_code}).", OrchestratorErrorCode.UNEXPECTED_ERROR)

        return ProviderError("An unexpected error occurred.", OrchestratorErrorCode.UNEXPECTED_ERROR)

    def _convert_messages(self, messages: list[LLMMessage]) -> list[dict[str, Any]]:
        converted = []
        for msg in messages:
            msg_dict: dict[str, Any] = {"role": msg.role}
            if msg.content is not None:
                msg_dict["content"] = msg.content
            if msg.tool_call_id is not None:
                msg_dict["tool_call_id"] = msg.tool_call_id
            if msg.tool_calls is not None:
                msg_dict["tool_calls"] = msg.tool_calls
            converted.append(msg_dict)
        return converted

    def generate(
        self,
        messages: list[LLMMessage],
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
        tool_choice: str | None = None,
        model: str | None = None,
    ) -> LLMResponse:
        api_key = self._get_api_key()
        resolved_model = self._get_model(model)

        client = openai.OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1"
        )

        kwargs: dict[str, Any] = {
            "model": resolved_model,
            "messages": self._convert_messages(messages)
        }
        if tools:
            kwargs["tools"] = tools
        if response_format:
            kwargs["response_format"] = response_format
        if tool_choice:
            kwargs["tool_choice"] = tool_choice

        try:
            response = client.chat.completions.create(**kwargs)
        except Exception as e:
            raise self._map_error(e) from e

        if not response.choices:
            raise ProviderError("OpenRouter returned empty choices.", OrchestratorErrorCode.MODEL_ERROR)

        choice = response.choices[0]
        msg = choice.message

        tool_calls = []
        if msg.tool_calls:
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError as e:
                    raise ProviderError("Malformed JSON in tool arguments.", OrchestratorErrorCode.MODEL_ERROR) from e

                tool_calls.append(ToolCall(
                    tool_name=tc.function.name,
                    arguments=args
                ))

        usage = {}
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }

        return LLMResponse(
            content=msg.content,
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason or "stop",
            model=response.model or resolved_model,
            usage=usage
        )
