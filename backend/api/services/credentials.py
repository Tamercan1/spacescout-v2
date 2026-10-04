import os
from cryptography.fernet import Fernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from api.models import ProviderCredential

def get_fernet() -> Fernet:
    """Initialize and return a Fernet instance using the configured secret key."""
    key = getattr(settings, 'CREDENTIAL_ENCRYPTION_KEY', None)
    if not key:
        raise ImproperlyConfigured("CREDENTIAL_ENCRYPTION_KEY must be set in settings.")
    try:
        return Fernet(key.encode('utf-8'))
    except ValueError:
        raise ImproperlyConfigured("CREDENTIAL_ENCRYPTION_KEY must be a valid 32-url-safe base64-encoded bytes string.")

def encrypt_credential(raw_key: str) -> str:
    """Encrypt a plaintext provider key."""
    fernet = get_fernet()
    return fernet.encrypt(raw_key.encode('utf-8')).decode('utf-8')

def decrypt_credential(encrypted_key: str) -> str:
    """Decrypt a provider key ciphertext."""
    fernet = get_fernet()
    try:
        return fernet.decrypt(encrypted_key.encode('utf-8')).decode('utf-8')
    except Exception as e:
        # Prevent exposing crypto internals; return empty or re-raise generic error
        raise ValueError("Failed to decrypt credential.") from e

def generate_key_hint(raw_key: str) -> str:
    """Generate a hint for the key (e.g. ••••1234)"""
    if len(raw_key) <= 4:
        return "••••"
    return "••••" + raw_key[-4:]

def get_provider_key(user, provider: str) -> str | None:
    """Retrieve and decrypt a user's credential for a specific provider."""
    user_id = user.id if hasattr(user, 'id') else user
    credential = ProviderCredential.objects.filter(user_id=user_id, provider=provider).first()
    if not credential:
        return None
    return decrypt_credential(credential.encrypted_key)
