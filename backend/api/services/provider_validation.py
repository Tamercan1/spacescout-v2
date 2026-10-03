import requests
import logging

logger = logging.getLogger(__name__)

class ValidationStatus:
    VALID = "valid"
    INVALID = "invalid"
    TRANSIENT_ERROR = "error"

def validate_provider_credential(provider: str, raw_key: str) -> dict:
    """
    Validates the plaintext key against the external provider.
    Returns:
        {
            "status": ValidationStatus.VALID | INVALID | TRANSIENT_ERROR,
            "detail": "safe error message if any"
        }
    """
    if provider == "openrouter":
        return _validate_openrouter(raw_key)
    elif provider == "nasa":
        return _validate_nasa(raw_key)
    else:
        return {"status": ValidationStatus.TRANSIENT_ERROR, "detail": "Unsupported provider."}

def _validate_openrouter(raw_key: str) -> dict:
    # OpenRouter auth endpoint
    url = "https://openrouter.ai/api/v1/auth/key"
    headers = {
        "Authorization": f"Bearer {raw_key}"
    }
    try:
        # 10s timeout, verify=True prevents following arbitrary redirects securely
        response = requests.get(url, headers=headers, timeout=10, allow_redirects=False)
        if response.status_code == 200:
            return {"status": ValidationStatus.VALID, "detail": None}
        elif response.status_code in [401, 403]:
            return {"status": ValidationStatus.INVALID, "detail": "Authentication failed. The key is invalid."}
        else:
            # 5xx or unexpected 4xx
            logger.warning(f"OpenRouter validation returned unexpected status: {response.status_code}")
            return {"status": ValidationStatus.TRANSIENT_ERROR, "detail": "Provider validation service is currently unavailable."}
    except requests.RequestException as e:
        logger.warning(f"OpenRouter validation network error: {type(e).__name__}")
        return {"status": ValidationStatus.TRANSIENT_ERROR, "detail": "Network timeout or error connecting to provider."}

def _validate_nasa(raw_key: str) -> dict:
    # NASA APOD is a lightweight endpoint that requires authentication
    url = "https://science.nasa.gov/wp-json/wp/v2/apod-basic"
    params = {
        "api_key": raw_key
    }
    try:
        response = requests.get(url, params=params, timeout=10, allow_redirects=False)
        if response.status_code == 200:
            return {"status": ValidationStatus.VALID, "detail": None}
        elif response.status_code in [401, 403]:
            return {"status": ValidationStatus.INVALID, "detail": "Authentication failed. The key is invalid or rate limited."}
        elif response.status_code == 429:
            # 429 means valid key but rate limited - technically the key is valid, but let's consider it invalid for use if rate limited?
            # NASA docs say 429 means over rate limit. If it's a DEMO_KEY, they might be rate limited.
            # We'll treat 429 as a definitive failure or transient?
            # Actually, rate limit could be transient. Let's treat it as transient so we don't wipe it out.
            return {"status": ValidationStatus.TRANSIENT_ERROR, "detail": "NASA API rate limit exceeded."}
        else:
            logger.warning(f"NASA validation returned unexpected status: {response.status_code}")
            return {"status": ValidationStatus.TRANSIENT_ERROR, "detail": "Provider validation service is currently unavailable."}
    except requests.RequestException as e:
        logger.warning(f"NASA validation network error: {type(e).__name__}")
        return {"status": ValidationStatus.TRANSIENT_ERROR, "detail": "Network timeout or error connecting to provider."}
