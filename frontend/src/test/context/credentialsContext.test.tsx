import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CredentialsProvider, useCredentials } from '../../context/CredentialsContext';
import * as credsApi from '../../api/credentials';
import type { ProviderCredential } from '../../types/credentials';

vi.mock('../../api/credentials');

function TestCredentialsConsumer() {
    const {
        credentials,
        isLoading,
        error,
        fetchCredentials,
        saveCredential,
        deleteCredential,
    } = useCredentials();

    return (
        <div>
            <div data-testid="loading">{isLoading ? 'Loading' : 'Idle'}</div>
            <div data-testid="error">{error ?? 'None'}</div>
            <div data-testid="count">{credentials.length}</div>
            <ul>
                {credentials.map((c) => (
                    <li key={c.provider} data-testid={`cred-${c.provider}`}>
                        {c.provider}: {c.key_hint}
                    </li>
                ))}
            </ul>
            <button type="button" onClick={() => { fetchCredentials().catch(() => {}); }}>Fetch Default</button>
            <button type="button" onClick={() => { fetchCredentials(true).catch(() => {}); }}>Fetch Forced</button>
            <button type="button" onClick={() => { saveCredential('nasa', 'DEMO_KEY').catch(() => {}); }}>Save NASA</button>
            <button type="button" onClick={() => { deleteCredential('nasa').catch(() => {}); }}>Delete NASA</button>
        </div>
    );
}

describe('CredentialsContext Caching & Operations', () => {
    const mockCredentials: ProviderCredential[] = [
        {
            provider: 'openrouter',
            key_hint: '...abcd',
            is_valid: true,
            last_validated_at: '2026-10-01T00:00:00Z',
            created_at: '2026-10-01T00:00:00Z',
            updated_at: '2026-10-01T00:00:00Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('prevents redundant API requests when cache is fresh', async () => {
        vi.mocked(credsApi.getCredentials).mockResolvedValue(mockCredentials);

        render(
            <CredentialsProvider>
                <TestCredentialsConsumer />
            </CredentialsProvider>
        );

        // First fetch
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Default' }));
        await waitFor(() => {
            expect(screen.getByTestId('count')).toHaveTextContent('1');
        });
        expect(credsApi.getCredentials).toHaveBeenCalledTimes(1);

        // Second fetch within TTL (5 minutes)
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Default' }));
        expect(credsApi.getCredentials).toHaveBeenCalledTimes(1);
    });

    it('bypasses memory cache when forced fetch is requested', async () => {
        vi.mocked(credsApi.getCredentials).mockResolvedValue(mockCredentials);

        render(
            <CredentialsProvider>
                <TestCredentialsConsumer />
            </CredentialsProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Fetch Default' }));
        await waitFor(() => {
            expect(screen.getByTestId('count')).toHaveTextContent('1');
        });
        expect(credsApi.getCredentials).toHaveBeenCalledTimes(1);

        // Forced fetch should invoke api again
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Forced' }));
        await waitFor(() => {
            expect(credsApi.getCredentials).toHaveBeenCalledTimes(2);
        });
    });

    it('deduplicates concurrent in-flight requests into a single API call', async () => {
        let resolvePromise: (data: ProviderCredential[]) => void = () => {};
        vi.mocked(credsApi.getCredentials).mockReturnValue(
            new Promise<ProviderCredential[]>((resolve) => {
                resolvePromise = resolve;
            })
        );

        render(
            <CredentialsProvider>
                <TestCredentialsConsumer />
            </CredentialsProvider>
        );

        // Click twice rapidly while promise is pending
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Default' }));
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Default' }));

        resolvePromise(mockCredentials);

        await waitFor(() => {
            expect(screen.getByTestId('count')).toHaveTextContent('1');
        });
        expect(credsApi.getCredentials).toHaveBeenCalledTimes(1);
    });

    it('updates local cache on save and delete operations', async () => {
        vi.mocked(credsApi.getCredentials).mockResolvedValue(mockCredentials);
        vi.mocked(credsApi.saveCredential).mockResolvedValue({
            provider: 'nasa',
            key_hint: '...1234',
            is_valid: null,
            last_validated_at: null,
            created_at: '2026-10-01T00:00:00Z',
            updated_at: '2026-10-01T00:00:00Z',
        });
        vi.mocked(credsApi.deleteCredential).mockResolvedValue(undefined);

        render(
            <CredentialsProvider>
                <TestCredentialsConsumer />
            </CredentialsProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Fetch Default' }));
        await waitFor(() => {
            expect(screen.getByTestId('count')).toHaveTextContent('1');
        });

        // Save NASA
        fireEvent.click(screen.getByRole('button', { name: 'Save NASA' }));
        await waitFor(() => {
            expect(screen.getByTestId('count')).toHaveTextContent('2');
            expect(screen.getByTestId('cred-nasa')).toHaveTextContent('nasa: ...1234');
        });

        // Delete NASA
        fireEvent.click(screen.getByRole('button', { name: 'Delete NASA' }));
        await waitFor(() => {
            expect(screen.getByTestId('count')).toHaveTextContent('1');
            expect(screen.queryByTestId('cred-nasa')).not.toBeInTheDocument();
        });
    });

    it('leaves context in a recoverable state when an API request fails', async () => {
        vi.mocked(credsApi.getCredentials).mockRejectedValueOnce(new Error('Network failure'));

        render(
            <CredentialsProvider>
                <TestCredentialsConsumer />
            </CredentialsProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Fetch Default' }));

        await waitFor(() => {
            expect(screen.getByTestId('error')).toHaveTextContent('Failed to load credentials');
            expect(screen.getByTestId('loading')).toHaveTextContent('Idle');
        });

        // Recover on subsequent request
        vi.mocked(credsApi.getCredentials).mockResolvedValueOnce(mockCredentials);
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Forced' }));

        await waitFor(() => {
            expect(screen.getByTestId('error')).toHaveTextContent('None');
            expect(screen.getByTestId('count')).toHaveTextContent('1');
        });
    });
});

