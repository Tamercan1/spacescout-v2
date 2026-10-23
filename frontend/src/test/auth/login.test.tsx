import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../../pages/Login';
import * as AuthContextModule from '../../context/AuthContext';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Login Page', () => {
    const mockLoginUser = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            loginUser: mockLoginUser,
            logoutUser: vi.fn(),
            updateUser: vi.fn(),
        });
    });

    it('submits credentials and navigates to root on success', async () => {
        mockLoginUser.mockResolvedValueOnce(undefined);

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'cosmonaut' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(mockLoginUser).toHaveBeenCalledWith('cosmonaut', 'secret123');
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
        expect(screen.queryByText(/invalid username or password/i)).not.toBeInTheDocument();
    });

    it('displays error feedback and does not navigate when login fails', async () => {
        mockLoginUser.mockRejectedValueOnce(new Error('Invalid credentials'));

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'wronguser' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
        });
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('shows loading indicator text while sign-in request is in flight', async () => {
        let resolveLogin: () => void = () => {};
        mockLoginUser.mockReturnValueOnce(new Promise<void>((resolve) => {
            resolveLogin = resolve;
        }));

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'cosmonaut' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        expect(screen.getByRole('button', { name: /signing in\.\.\./i })).toBeInTheDocument();

        resolveLogin();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
    });

    it('redirects to the intended destination path and query when location.state.from is provided', async () => {
        mockLoginUser.mockResolvedValueOnce(undefined);

        render(
            <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/explore', search: '?prompt=Tell%20me%20about%20APOD' } } }]}>
                <Login />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'cosmonaut' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(mockLoginUser).toHaveBeenCalledWith('cosmonaut', 'secret123');
            expect(mockNavigate).toHaveBeenCalledWith('/explore?prompt=Tell%20me%20about%20APOD', { replace: true });
        });
    });
});

