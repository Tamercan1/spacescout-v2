import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import * as authApi from '../../api/auth';
import * as userApi from '../../api/user';
import type { User } from '../../api/user';

vi.mock('../../api/auth');
vi.mock('../../api/user');

function TestConsumer() {
    const { isAuthenticated, user, isLoading, loginUser, logoutUser } = useAuth();

    return (
        <div>
            <div data-testid="loading">{isLoading ? 'Loading' : 'Idle'}</div>
            <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Unauthenticated'}</div>
            <div data-testid="username">{user?.username ?? 'None'}</div>
            <button type="button" onClick={() => loginUser('testpilot', 'password123')}>Log In</button>
            <button type="button" onClick={() => logoutUser()}>Log Out</button>
        </div>
    );
}

describe('AuthContext', () => {
    const mockUser: User = {
        id: 1,
        username: 'testpilot',
        email: 'test@spacescout.org',
        profile: {
            preferred_model: 'openrouter/free',
            theme: 'dark',
            onboarding_completed_at: null,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('restores user profile when access token exists in localStorage', async () => {
        localStorage.setItem('access_token', 'mock-valid-token');
        vi.mocked(userApi.getCurrentUser).mockResolvedValue(mockUser);

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );

        expect(screen.getByTestId('loading')).toHaveTextContent('Loading');

        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('Idle');
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
            expect(screen.getByTestId('username')).toHaveTextContent('testpilot');
        });

        expect(userApi.getCurrentUser).toHaveBeenCalledTimes(1);
    });

    it('clears session and tokens when profile retrieval fails on mount', async () => {
        localStorage.setItem('access_token', 'mock-stale-token');
        localStorage.setItem('refresh_token', 'mock-refresh-token');
        vi.mocked(userApi.getCurrentUser).mockRejectedValue(new Error('Unauthorized'));

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('Idle');
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Unauthenticated');
            expect(screen.getByTestId('username')).toHaveTextContent('None');
        });

        expect(localStorage.getItem('access_token')).toBeNull();
        expect(localStorage.getItem('refresh_token')).toBeNull();
    });

    it('resets authentication state on spacescout:session_expired event', async () => {
        localStorage.setItem('access_token', 'mock-token');
        vi.mocked(userApi.getCurrentUser).mockResolvedValue(mockUser);

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
        });

        window.dispatchEvent(new CustomEvent('spacescout:session_expired'));

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Unauthenticated');
            expect(screen.getByTestId('username')).toHaveTextContent('None');
        });
    });

    it('stores tokens and sets authenticated state on successful loginUser', async () => {
        vi.mocked(authApi.login).mockResolvedValue({
            access: 'new-access-token',
            refresh: 'new-refresh-token',
        });
        vi.mocked(userApi.getCurrentUser).mockResolvedValue(mockUser);

        const user = userEvent.setup();

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );

        expect(screen.getByTestId('auth-status')).toHaveTextContent('Unauthenticated');

        await user.click(screen.getByRole('button', { name: 'Log In' }));

        await waitFor(() => {
            expect(localStorage.getItem('access_token')).toBe('new-access-token');
            expect(localStorage.getItem('refresh_token')).toBe('new-refresh-token');
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
        });
    });

    it('purges tokens and clears user on logoutUser', async () => {
        localStorage.setItem('access_token', 'active-token');
        localStorage.setItem('refresh_token', 'active-refresh');
        vi.mocked(userApi.getCurrentUser).mockResolvedValue(mockUser);

        const user = userEvent.setup();

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
        });

        await user.click(screen.getByRole('button', { name: 'Log Out' }));

        expect(localStorage.getItem('access_token')).toBeNull();
        expect(localStorage.getItem('refresh_token')).toBeNull();
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Unauthenticated');
        expect(screen.getByTestId('username')).toHaveTextContent('None');
    });
});
