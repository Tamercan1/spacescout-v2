import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Settings from '../../pages/Settings';
import * as AuthContextModule from '../../context/AuthContext';
import * as userApi from '../../api/user';
import type { User } from '../../api/user';

vi.mock('../../api/user');
vi.mock('../../context/CredentialsContext', () => ({
    useCredentials: () => ({
        credentials: [],
        isLoading: false,
        fetchCredentials: vi.fn(),
        saveCredential: vi.fn(),
        deleteCredential: vi.fn(),
        validateCredential: vi.fn(),
    }),
}));

describe('Settings Theme Persistence', () => {
    const mockUpdateUser = vi.fn();

    const createMockUser = (theme: string | null = 'light'): User => ({
        id: 1,
        username: 'cosmic_explorer',
        email: 'explorer@spacescout.org',
        profile: {
            preferred_model: 'openrouter/free',
            theme: theme as string,
            onboarding_completed_at: '2026-10-16T12:00:00Z',
        },
    });

    const renderSettingsPreferences = () => {
        const utils = render(<Settings />);
        const prefTabs = screen.getAllByText('Preferences');
        fireEvent.click(prefTabs[0]);
        return utils;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        document.documentElement.className = '';
    });

    it('applies a valid server-provided theme during initialization and overrides stale localStorage', async () => {
        // Stale localStorage had 'light', but server preference is 'dark'
        localStorage.setItem('spacescout_theme', 'light');

        const darkUser = createMockUser('dark');
        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: darkUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });
        expect(toggle).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
        expect(localStorage.getItem('spacescout_theme')).toBe('dark');
    });

    it('falls back safely when the server theme is missing or invalid', async () => {
        // User has 'dark' in localStorage, but server theme is 'system' (no valid server theme)
        localStorage.setItem('spacescout_theme', 'dark');

        const systemUser = createMockUser('system');
        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: systemUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });
        expect(toggle).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    });

    it('falls back to default light theme when neither server nor local preference exists', async () => {
        const nullUser = createMockUser(null);
        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: nullUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });
        expect(toggle).toHaveAttribute('aria-checked', 'false');
        expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    });

    it('successfully persists a theme change and updates user profile in context', async () => {
        const lightUser = createMockUser('light');
        const darkUser = createMockUser('dark');

        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: lightUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        vi.mocked(userApi.updateUserProfile).mockResolvedValue(darkUser);

        renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });
        expect(toggle).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(toggle);

        // Immediate optimistic UI update
        expect(toggle).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
        expect(localStorage.getItem('spacescout_theme')).toBe('dark');

        await waitFor(() => {
            expect(userApi.updateUserProfile).toHaveBeenCalledWith({ theme: 'dark' });
            expect(mockUpdateUser).toHaveBeenCalledWith(darkUser);
        });
    });

    it('handles a failed persistence request with sensible recovery and error messaging', async () => {
        const lightUser = createMockUser('light');

        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: lightUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        vi.mocked(userApi.updateUserProfile).mockRejectedValue(new Error('Network error 500'));

        renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });
        expect(toggle).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(toggle);

        // Optimistically set to dark while in flight
        expect(toggle).toHaveAttribute('aria-checked', 'true');

        // Once the network request fails, it should revert to the last persisted theme ('light')
        await waitFor(() => {
            expect(toggle).toHaveAttribute('aria-checked', 'false');
            expect(document.documentElement.classList.contains('theme-light')).toBe(true);
            expect(localStorage.getItem('spacescout_theme')).toBe('light');
            expect(screen.getByText(/unable to save theme preference/i)).toBeInTheDocument();
        });

        // Ensure raw backend error message is not leaked to user
        expect(screen.queryByText(/network error 500/i)).not.toBeInTheDocument();
    });

    it('prevents profile-loading or rerender behavior from overriding the selected theme unexpectedly', async () => {
        const lightUser = createMockUser('light');
        const darkUser = createMockUser('dark');

        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: lightUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        vi.mocked(userApi.updateUserProfile).mockResolvedValue(darkUser);

        const { rerender } = renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });
        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-checked', 'true');

        // Simulate a parent rerender where the context still provides the un-updated lightUser
        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: { ...lightUser }, // new object reference with theme: 'light'
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        rerender(<Settings />);

        // The user's active choice must NOT be reset back to light
        expect(toggle).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    });

    it('updates local cache immediately and avoids API calls when rapidly toggling back and forth', async () => {
        const lightUser = createMockUser('light');

        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: lightUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });
        expect(toggle).toHaveAttribute('aria-checked', 'false');

        // 1st click: light -> dark
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'true');
        expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
        expect(localStorage.getItem('spacescout_theme')).toBe('dark');

        // 2nd rapid click: dark -> light (back to original persisted state)
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'false');
        expect(document.documentElement.classList.contains('theme-light')).toBe(true);
        expect(localStorage.getItem('spacescout_theme')).toBe('light');

        // Wait past the debounce interval (400ms)
        await new Promise((res) => setTimeout(res, 500));

        // 0 API calls should have been made!
        expect(userApi.updateUserProfile).not.toHaveBeenCalled();
    });

    it('debounces rapid multiple toggles and makes only 1 final API call', async () => {
        const lightUser = createMockUser('light');
        const darkUser = createMockUser('dark');

        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: lightUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        vi.mocked(userApi.updateUserProfile).mockResolvedValue(darkUser);

        renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });

        // Toggle 3 times quickly: light -> dark -> light -> dark
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'true');

        // During the debounce window, no API call has fired yet
        expect(userApi.updateUserProfile).not.toHaveBeenCalled();

        // After debounce interval expires, exactly 1 call with the final intended theme
        await waitFor(() => {
            expect(userApi.updateUserProfile).toHaveBeenCalledTimes(1);
            expect(userApi.updateUserProfile).toHaveBeenCalledWith({ theme: 'dark' });
            expect(mockUpdateUser).toHaveBeenCalledWith(darkUser);
        }, { timeout: 2000 });
    });

    it('flushes pending debounced preference immediately on unmount', async () => {
        const lightUser = createMockUser('light');
        const darkUser = createMockUser('dark');

        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: lightUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        vi.mocked(userApi.updateUserProfile).mockResolvedValue(darkUser);

        const { unmount } = renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });
        fireEvent.click(toggle);

        // API has not fired yet because of debounce
        expect(userApi.updateUserProfile).not.toHaveBeenCalled();

        // Unmount before debounce expires
        unmount();

        // Unmount cleanup flushes immediately
        expect(userApi.updateUserProfile).toHaveBeenCalledTimes(1);
        expect(userApi.updateUserProfile).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('guarantees serialized backend persistence when user toggles while a request is in flight', async () => {
        const lightUser = createMockUser('light');
        const darkUser = createMockUser('dark');

        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: lightUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        let resolveCall1!: (val: User) => void;
        const promise1 = new Promise<User>((res) => {
            resolveCall1 = res;
        });

        let resolveCall2!: (val: User) => void;
        const promise2 = new Promise<User>((res) => {
            resolveCall2 = res;
        });

        vi.mocked(userApi.updateUserProfile)
            .mockImplementationOnce(() => promise1)
            .mockImplementationOnce(() => promise2);

        renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });

        // First click: light -> dark
        fireEvent.click(toggle);

        // Wait for Call 1 to start after debounce
        await waitFor(() => {
            expect(userApi.updateUserProfile).toHaveBeenCalledTimes(1);
            expect(userApi.updateUserProfile).toHaveBeenNthCalledWith(1, { theme: 'dark' });
        });

        // Toggle back while Call 1 is in-flight: dark -> light
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'false');

        // Crucial check: Call 2 is NOT dispatched in parallel! No race on backend!
        expect(userApi.updateUserProfile).toHaveBeenCalledTimes(1);

        // Resolve Call 1
        resolveCall1(darkUser);

        // Wait for debounce + serialized queue to dispatch Call 2
        await waitFor(() => {
            expect(userApi.updateUserProfile).toHaveBeenCalledTimes(2);
            expect(userApi.updateUserProfile).toHaveBeenNthCalledWith(2, { theme: 'light' });
        }, { timeout: 2000 });

        // Resolve Call 2
        resolveCall2(lightUser);

        // Final state matches the user's latest intended theme
        await waitFor(() => {
            expect(toggle).toHaveAttribute('aria-checked', 'false');
            expect(document.documentElement.classList.contains('theme-light')).toBe(true);
            expect(localStorage.getItem('spacescout_theme')).toBe('light');
            expect(mockUpdateUser).toHaveBeenLastCalledWith(lightUser);
        });
    });

    it('reverts to the last persisted theme when an earlier request succeeds but the latest request fails', async () => {
        const lightUser = createMockUser('light');
        const darkUser = createMockUser('dark');

        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: lightUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        let resolveCall1!: (val: User) => void;
        const promise1 = new Promise<User>((res) => {
            resolveCall1 = res;
        });

        let rejectCall2!: (err: Error) => void;
        const promise2 = new Promise<User>((_, rej) => {
            rejectCall2 = rej;
        });

        vi.mocked(userApi.updateUserProfile)
            .mockImplementationOnce(() => promise1)
            .mockImplementationOnce(() => promise2);

        renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });

        // First click: light -> dark
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'true');

        // Wait for Call 1 to start
        await waitFor(() => {
            expect(userApi.updateUserProfile).toHaveBeenCalledTimes(1);
        });

        // Second click: dark -> light while Call 1 is in-flight
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'false');

        // Call 1 succeeds on backend (backend now has 'dark')
        resolveCall1(darkUser);

        // Wait for serialized Call 2 to be initiated
        await waitFor(() => {
            expect(userApi.updateUserProfile).toHaveBeenCalledTimes(2);
        });

        // Call 2 fails
        rejectCall2(new Error('Network failure on second toggle'));

        // Recovery: since Call 1 succeeded and wrote 'dark' to backend,
        // recovery MUST revert to 'dark' to match the actual backend state!
        await waitFor(() => {
            expect(toggle).toHaveAttribute('aria-checked', 'true');
            expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
            expect(localStorage.getItem('spacescout_theme')).toBe('dark');
            expect(screen.getByText(/unable to save theme preference/i)).toBeInTheDocument();
        });
    });

    it('handles earlier request failure cleanly when a subsequent toggle restores original state', async () => {
        const lightUser = createMockUser('light');

        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: lightUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        let rejectCall1!: (err: Error) => void;
        const promise1 = new Promise<User>((_, rej) => {
            rejectCall1 = rej;
        });

        vi.mocked(userApi.updateUserProfile).mockImplementationOnce(() => promise1);

        renderSettingsPreferences();

        const toggle = screen.getByRole('switch', { name: /toggle dark theme/i });

        // Click 1: light -> dark
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'true');

        // Wait for Call 1 to be dispatched after debounce
        await waitFor(() => {
            expect(userApi.updateUserProfile).toHaveBeenCalledTimes(1);
        });

        // Click 2: dark -> light (pending)
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'false');

        // Call 1 fails
        rejectCall1(new Error('Network error on call 1'));

        // Desired state is 'light' and backend already has 'light'.
        // State remains 'light' and no extraneous error is raised.
        await waitFor(() => {
            expect(toggle).toHaveAttribute('aria-checked', 'false');
            expect(document.documentElement.classList.contains('theme-light')).toBe(true);
            expect(localStorage.getItem('spacescout_theme')).toBe('light');
        });
    });
});
