import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Onboarding from '../../pages/Onboarding';
import ProtectedRoute from '../../components/ProtectedRoutes';
import * as AuthContextModule from '../../context/AuthContext';
import * as userApi from '../../api/user';
import type { User } from '../../api/user';

const mockNavigate = vi.fn();

vi.mock('../../api/user');
vi.mock('../../api/credentials');
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Onboarding Page & Routing Protection', () => {
    const mockUpdateUser = vi.fn();

    const mockUnonboardedUser: User = {
        id: 1,
        username: 'new_explorer',
        email: 'explorer@spacescout.org',
        profile: {
            preferred_model: null,
            theme: 'system',
            onboarding_completed_at: null,
        },
    };

    const mockOnboardedUser: User = {
        ...mockUnonboardedUser,
        profile: {
            ...mockUnonboardedUser.profile!,
            onboarding_completed_at: '2026-10-16T12:00:00Z',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders welcome screen and completes onboarding on skip', async () => {
        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: mockUnonboardedUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        vi.mocked(userApi.completeOnboarding).mockResolvedValue(mockOnboardedUser);

        render(
            <MemoryRouter>
                <Onboarding />
            </MemoryRouter>
        );

        expect(screen.getByText('Welcome to SpaceScout')).toBeInTheDocument();
        const skipBtn = screen.getByRole('button', { name: /skip setup for now/i });
        fireEvent.click(skipBtn);

        await waitFor(() => {
            expect(userApi.completeOnboarding).toHaveBeenCalledTimes(1);
            expect(mockUpdateUser).toHaveBeenCalledWith(mockOnboardedUser);
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
    });

    it('navigates through step 1 and step 2 to completion', async () => {
        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: mockUnonboardedUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        vi.mocked(userApi.completeOnboarding).mockResolvedValue(mockOnboardedUser);

        render(
            <MemoryRouter>
                <Onboarding />
            </MemoryRouter>
        );

        // Click Start Quick Setup
        fireEvent.click(screen.getByRole('button', { name: /start quick setup/i }));
        expect(screen.getByText('Connect AI Engine')).toBeInTheDocument();

        // Skip AI step
        fireEvent.click(screen.getByRole('button', { name: /skip this step/i }));
        expect(screen.getByText('Connect NASA Data')).toBeInTheDocument();

        // Skip NASA step
        fireEvent.click(screen.getByRole('button', { name: /skip this step/i }));
        expect(screen.getByText(/you're ready to explore/i)).toBeInTheDocument();

        // Finish onboarding
        fireEvent.click(screen.getByRole('button', { name: /start exploring/i }));

        await waitFor(() => {
            expect(userApi.completeOnboarding).toHaveBeenCalledTimes(1);
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
    });

    it('redirects unonboarded user from protected root to /onboarding', () => {
        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: mockUnonboardedUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route element={<ProtectedRoute />}>
                        <Route path="/" element={<div>Home Page</div>} />
                        <Route path="/onboarding" element={<div>Onboarding Page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
        expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
    });

    it('redirects onboarded user from /onboarding to root', () => {
        vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
            isAuthenticated: true,
            user: mockOnboardedUser,
            isLoading: false,
            loginUser: vi.fn(),
            logoutUser: vi.fn(),
            updateUser: mockUpdateUser,
        });

        render(
            <MemoryRouter initialEntries={['/onboarding']}>
                <Routes>
                    <Route element={<ProtectedRoute />}>
                        <Route path="/" element={<div>Home Page</div>} />
                        <Route path="/onboarding" element={<div>Onboarding Page</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        expect(screen.queryByText('Onboarding Page')).not.toBeInTheDocument();
        expect(screen.getByText('Home Page')).toBeInTheDocument();
    });
});
