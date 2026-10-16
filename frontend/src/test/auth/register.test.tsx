import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from '../../pages/Register';
import * as AuthContextModule from '../../context/AuthContext';
import * as authApi from '../../api/auth';

const mockNavigate = vi.fn();

vi.mock('../../api/auth');
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Register Page', () => {
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

    it('prevents API call and displays error when passwords do not match', async () => {
        render(
            <MemoryRouter>
                <Register />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText(/^username/i), { target: { value: 'newuser' } });
        fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different123' } });
        fireEvent.click(screen.getByRole('button', { name: /create account/i }));

        expect(screen.getByText('Password must match')).toBeInTheDocument();
        expect(authApi.register).not.toHaveBeenCalled();
        expect(mockLoginUser).not.toHaveBeenCalled();
    });

    it('awaits automatic login and navigates to root upon successful registration', async () => {
        vi.mocked(authApi.register).mockResolvedValueOnce({
            id: 2,
            username: 'stargazer',
        });
        mockLoginUser.mockResolvedValueOnce(undefined);

        render(
            <MemoryRouter>
                <Register />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText(/^username/i), { target: { value: 'stargazer' } });
        fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'securePass123' } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'securePass123' } });
        fireEvent.click(screen.getByRole('button', { name: /create account/i }));

        await waitFor(() => {
            expect(authApi.register).toHaveBeenCalledWith('stargazer', 'securePass123');
            expect(mockLoginUser).toHaveBeenCalledWith('stargazer', 'securePass123');
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
    });

    it('displays backend 400 validation errors under the appropriate input fields', async () => {
        vi.mocked(authApi.register).mockRejectedValueOnce({
            response: {
                status: 400,
                data: {
                    username: ['A user with that username already exists.'],
                    password: ['This password is too short.'],
                },
            },
        });

        render(
            <MemoryRouter>
                <Register />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText(/^username/i), { target: { value: 'existinguser' } });
        fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: '123' } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: '123' } });
        fireEvent.click(screen.getByRole('button', { name: /create account/i }));

        await waitFor(() => {
            expect(screen.getByText('A user with that username already exists.')).toBeInTheDocument();
            expect(screen.getByText('This password is too short.')).toBeInTheDocument();
        });
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});

