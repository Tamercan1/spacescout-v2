import os
import json
from datetime import date
from openai import OpenAI
from dotenv import load_dotenv
from pydantic import ValidationError
from api.engine.tool_registry import tool_registry, tools
from api.engine.system_prompt import SYSTEM_PROMPT
from api.engine.schema import SpacePlan
from api.engine.model_switch import call_llm_with_fallback, AllModelsFailedError

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

LLM_MODEL = os.getenv("LLM_MODEL")

client = None
if OPENROUTER_API_KEY:
    client = OpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL,
        timeout=60.0,
        max_retries=1,
    )

MODELS_LIST = []

if LLM_MODEL:
    MODELS_LIST.append(LLM_MODEL)

MODELS_LIST.append("openrouter/free")

MAX_TOOL_ROUNDS = 5
MAX_DISCOVERIES = 10

RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "space_plan",
        "schema": SpacePlan.model_json_schema(),
        "strict": True
    }
}

# For every invalid outputs, we raise this error class
class SpacePlannerError(Exception):
    def __init__(self, message: str, is_user_facing: bool = False):
        super().__init__(message)
        self.is_user_facing = is_user_facing


def handle_tool_call(tool_call, user=None):

    function_name = tool_call.function.name
    arguments = json.loads(tool_call.function.arguments)

    handler = tool_registry[function_name]["handler"]

    if user and "api_key" not in arguments:
        from api.services.credentials import get_provider_key
        user_nasa_key = get_provider_key(user, "nasa")
        if user_nasa_key:
            import inspect
            sig = inspect.signature(handler)
            if "api_key" in sig.parameters:
                arguments["api_key"] = user_nasa_key

    try:
        return handler(**arguments)
    except TypeError:
        return {"error": f"Invalid arguments for '{function_name}'"}
    except Exception:
        return {"error": f"'{function_name}' failed unexpectedly"}


def parse_and_validate(content):
    data = json.loads(content or "")
    plan = SpacePlan.model_validate(data)

    if len(plan.discoveries) > MAX_DISCOVERIES:
        plan.discoveries = plan.discoveries[:MAX_DISCOVERIES]
 
    return plan


def llm_call(messages, client_override=None, model_list_override=None, response_format=None, tool_choice=None, is_byok=False):

    target_client = client_override or client
    if target_client is None:
        raise SpacePlannerError(
            "No AI provider key is configured. Please add your OpenRouter API key in Settings to start exploring.",
            is_user_facing=True
        )

    kwargs = {
        "client": target_client,
        "messages": messages,
        "tools": tools,
        "model_list": model_list_override or MODELS_LIST,
        "is_byok": is_byok,
    }

    if response_format is not None:
        kwargs["response_format"] = response_format
    if tool_choice is not None:
        kwargs["tool_choice"] = tool_choice
    
    try:
        return call_llm_with_fallback(**kwargs)
    except AllModelsFailedError as exc:
        is_user_facing = getattr(exc, "is_user_facing", False)
        raise SpacePlannerError(str(exc), is_user_facing=is_user_facing) from exc


def run_space_planner(user_request, user=None) -> SpacePlan:

    active_client = None
    is_byok = False
    active_models = list(MODELS_LIST)

    if user:
        from api.services.credentials import get_provider_key
        user_openrouter_key = get_provider_key(user, "openrouter")
        if user_openrouter_key:
            active_client = OpenAI(
                api_key=user_openrouter_key,
                base_url=OPENROUTER_BASE_URL,
                timeout=60.0,
                max_retries=1,
            )
            is_byok = True
        if hasattr(user, 'profile') and user.profile.preferred_model:
            preferred = user.profile.preferred_model.strip()
            if preferred:
                if preferred in active_models:
                    active_models.remove(preferred)
                active_models.insert(0, preferred)

    if not active_client:
        env_key = os.getenv("OPENROUTER_API_KEY")
        if env_key:
            active_client = OpenAI(
                api_key=env_key,
                base_url=OPENROUTER_BASE_URL,
                timeout=60.0,
                max_retries=1,
            )
        else:
            raise SpacePlannerError(
                "No AI provider key is configured. Please add your OpenRouter API key in Settings to start exploring.",
                is_user_facing=True
            )

    messages = [
        {
            "role": "system",
            "content": f"{SYSTEM_PROMPT}\n\nCurrent date: {date.today().isoformat()}"
        },
        {
            "role": "user",
            "content": user_request
        }
    ]

    response = llm_call(messages, client_override=active_client, model_list_override=active_models, is_byok=is_byok)
    assistant_message = response.choices[0].message

    rounds = 0
    while assistant_message.tool_calls and rounds < MAX_TOOL_ROUNDS:
        rounds += 1
 
        messages.append(assistant_message.model_dump(exclude_none=True))

        for tool_call in assistant_message.tool_calls:

            result = handle_tool_call(tool_call, user=user)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result)
            })

        response = llm_call(messages, client_override=active_client, model_list_override=active_models, is_byok=is_byok)
        
        assistant_message = response.choices[0].message

    # FINAL MESSAGE 
    messages.append({
        "role": "system",
        "content": (
            "Investigation complete. Respond now with the final SpacePlan "
            "JSON only — no further tool calls."
        ),
    })

    final_response = llm_call(
        messages,
        client_override=active_client,
        model_list_override=active_models,
        response_format=RESPONSE_FORMAT,
        tool_choice="none",
        is_byok=is_byok,
    )

    final_data = final_response.choices[0].message.content

    try:
        validated_data = parse_and_validate(final_data)
        return validated_data # This is a pydantic object of SpacePlan

    # If invalid json format, RETRY
    except (json.JSONDecodeError, ValidationError) as exc:
        messages.append({"role": "assistant", "content": final_data})
        messages.append({
            "role": "user",
            "content": (
                f"That response was not valid JSON matching the required schema. "
                f"Error: {exc}. Return ONLY the corrected JSON object, nothing else."
            ),
        })

        retry_response = llm_call(
            messages,
            client_override=active_client,
            model_list_override=active_models,
            response_format=RESPONSE_FORMAT,
            tool_choice="none",
            is_byok=is_byok,
        )

        try:
            retried_data = retry_response.choices[0].message.content
            return parse_and_validate(retried_data)
        except (json.JSONDecodeError, ValidationError) as exc2:
            raise SpacePlannerError(
                f"Model could not produce a valid SpacePlan after retry: {exc2}"
            ) from exc2


# PROTOTYPES
def main():
    prompt = "Plan me me something. Whats interesting thing in space this week?"
    try:
        result = run_space_planner(prompt)
        print(result.model_dump_json(indent=4))
    # display the error
    except SpacePlannerError as exc:
        print(f"SpacePlanner failed: {exc}")


if __name__ == "__main__":
    main()