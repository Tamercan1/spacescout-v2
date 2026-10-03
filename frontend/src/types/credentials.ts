export interface ProviderCredential {
    provider: string;
    key_hint: string;
    is_valid: boolean | null;
    last_validated_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ValidationResponse {
    provider: string;
    is_valid: boolean;
    validated_at: string | null;
    detail?: string;
}
