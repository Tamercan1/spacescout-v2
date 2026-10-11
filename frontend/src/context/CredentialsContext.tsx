import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ProviderCredential, ValidationResponse } from '../types/credentials';
import {
    getCredentials as apiGetCredentials,
    saveCredential as apiSaveCredential,
    deleteCredential as apiDeleteCredential,
    validateCredential as apiValidateCredential,
} from '../api/credentials';

interface CredentialsContextType {
    credentials: ProviderCredential[];
    isLoading: boolean;
    error: string | null;
    fetchCredentials: (force?: boolean) => Promise<ProviderCredential[]>;
    saveCredential: (provider: string, rawKey: string) => Promise<ProviderCredential>;
    deleteCredential: (provider: string) => Promise<void>;
    validateCredential: (provider: string) => Promise<ValidationResponse>;
}

const CredentialsContext = createContext<CredentialsContextType | undefined>(undefined);

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function CredentialsProvider({ children }: { children: React.ReactNode }) {
    const [credentials, setCredentials] = useState<ProviderCredential[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const credentialsRef = useRef<ProviderCredential[]>([]);
    credentialsRef.current = credentials;

    const lastFetchedRef = useRef<number | null>(null);
    const inFlightPromiseRef = useRef<Promise<ProviderCredential[]> | null>(null);

    const fetchCredentials = useCallback(async (force = false): Promise<ProviderCredential[]> => {
        // If cached and fresh, return memory cache without network call
        if (!force && lastFetchedRef.current && (Date.now() - lastFetchedRef.current < CACHE_TTL_MS)) {
            setIsLoading(false);
            return credentialsRef.current;
        }

        // Deduplicate in-flight requests
        if (inFlightPromiseRef.current) {
            return inFlightPromiseRef.current;
        }

        if (credentialsRef.current.length === 0) {
            setIsLoading(true);
        }

        const promise = (async () => {
            try {
                setError(null);
                const data = await apiGetCredentials();
                setCredentials(data);
                lastFetchedRef.current = Date.now();
                return data;
            } catch (err: unknown) {
                console.error("Failed to fetch credentials", err);
                setError("Failed to load credentials");
                throw err;
            } finally {
                setIsLoading(false);
                inFlightPromiseRef.current = null;
            }
        })();

        inFlightPromiseRef.current = promise;
        return promise;
    }, []);

    const saveCredential = useCallback(async (provider: string, rawKey: string): Promise<ProviderCredential> => {
        const saved = await apiSaveCredential(provider, rawKey);
        setCredentials(prev => {
            const exists = prev.some(c => c.provider === provider);
            if (exists) {
                return prev.map(c => c.provider === provider ? saved : c);
            }
            return [...prev, saved];
        });
        lastFetchedRef.current = Date.now();
        return saved;
    }, []);

    const deleteCredential = useCallback(async (provider: string): Promise<void> => {
        await apiDeleteCredential(provider);
        setCredentials(prev => prev.filter(c => c.provider !== provider));
        lastFetchedRef.current = Date.now();
    }, []);

    const validateCredential = useCallback(async (provider: string): Promise<ValidationResponse> => {
        const res = await apiValidateCredential(provider);
        setCredentials(prev => prev.map(c => {
            if (c.provider === provider) {
                return {
                    ...c,
                    is_valid: res.is_valid,
                    last_validated_at: res.validated_at || new Date().toISOString(),
                };
            }
            return c;
        }));
        return res;
    }, []);

    const value: CredentialsContextType = {
        credentials,
        isLoading,
        error,
        fetchCredentials,
        saveCredential,
        deleteCredential,
        validateCredential,
    };

    return (
        <CredentialsContext.Provider value={value}>
            {children}
        </CredentialsContext.Provider>
    );
}

export function useCredentials(): CredentialsContextType {
    const context = useContext(CredentialsContext);
    if (!context) {
        throw new Error('useCredentials must be used within a CredentialsProvider');
    }
    return context;
}
