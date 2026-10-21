import httpx
import logging
import json
import openai

from api.engine.contracts import OrchestratorErrorCode

logger = logging.getLogger(__name__)

class AllModelsFailedError(Exception):
    def __init__(self, message: str, is_user_facing: bool = False, error_code: str = ""):
        super().__init__(message)
        self.is_user_facing = is_user_facing
        self.error_code = error_code

def call_llm_with_fallback(client, messages, tools, model_list, response_format=None, tool_choice=None, is_byok=False):

    last_error = None
    
    for index, model_name in enumerate(model_list):
        try:
            logger.info(f"Attempting API call using model: {model_name}")

            kwargs = {
                "model": model_name,
                "messages": messages,
                "tools": tools,
            }

            if response_format is not None:
                kwargs["response_format"] = response_format
            if tool_choice is not None:
                kwargs["tool_choice"] = tool_choice

            response = client.chat.completions.create(**kwargs)
            
            logger.info(f"Success with model: {model_name}")
            return response

        except (openai.AuthenticationError, openai.PermissionDeniedError) as exc:
            # Non-retryable key error: do not cycle through other models with broken key
            logger.warning(f"Authentication/permission error with model '{model_name}': {exc}")
            if is_byok:
                raise AllModelsFailedError(
                    "Your configured OpenRouter API key was rejected or invalid. Please check your key in Settings.",
                    is_user_facing=True,
                    error_code=OrchestratorErrorCode.INVALID_CREDENTIAL.value,
                ) from exc
            else:
                raise AllModelsFailedError(
                    "Shared AI capacity is temporarily unavailable. You can configure your own OpenRouter API key in Settings to continue exploring, or try again later.",
                    is_user_facing=True,
                    error_code=OrchestratorErrorCode.INVALID_CREDENTIAL.value,
                ) from exc

        except openai.RateLimitError as exc:
            # Quota or rate limit error
            logger.warning(f"Rate limit / quota error with model '{model_name}': {exc}")
            if is_byok:
                raise AllModelsFailedError(
                    "Your OpenRouter account rate limit or credit quota has been reached. Please check your OpenRouter account.",
                    is_user_facing=True,
                    error_code=OrchestratorErrorCode.PROVIDER_RATE_LIMITED.value,
                ) from exc
            else:
                raise AllModelsFailedError(
                    "Shared AI capacity is temporarily unavailable or exhausted. You can configure your own OpenRouter API key in Settings to continue exploring immediately, or try again later.",
                    is_user_facing=True,
                    error_code=OrchestratorErrorCode.PROVIDER_RATE_LIMITED.value,
                ) from exc

        except Exception as exc:
            last_error = exc
            logger.warning(f"Model '{model_name}' failed. Error: {exc}")
            
            # Check for HTTP 402 Payment Required in APIStatusError
            status_code = getattr(exc, "status_code", None)
            if status_code == 402:
                if is_byok:
                    raise AllModelsFailedError(
                        "Your OpenRouter account credits are exhausted. Please add credits to your OpenRouter account.",
                        is_user_facing=True,
                        error_code=OrchestratorErrorCode.PROVIDER_RATE_LIMITED.value,
                    ) from exc
                else:
                    raise AllModelsFailedError(
                        "Shared AI capacity is temporarily unavailable or exhausted. You can configure your own OpenRouter API key in Settings to continue exploring immediately, or try again later.",
                        is_user_facing=True,
                        error_code=OrchestratorErrorCode.PROVIDER_RATE_LIMITED.value,
                    ) from exc

            if index < len(model_list) - 1:
                next_model = model_list[index + 1]
                logger.warning(f"Switching to fallback model: {next_model}")
            
    logger.error("All models in the fallback chain have failed.")

    raise AllModelsFailedError(
        f"All {len(model_list)} models failed. Last error: {last_error}",
        is_user_facing=False
    ) from last_error
