import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Explore from '../../pages/Explore';
import * as PlansContextModule from '../../context/PlansContext';
import * as AuthContextModule from '../../context/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoutes';
import Login from '../../pages/Login';

const mockCreatePlan = vi.fn();
const mockGetPlanById = vi.fn();
const mockGetInteractionsForPlan = vi.fn();
const mockClearActiveCreationError = vi.fn();

describe('Explore Prompt Handoff & Prefill Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: {
        id: 1,
        username: 'explorer',
        profile: { theme: 'dark', onboarding_completed_at: '2026-01-01T00:00:00Z', preferred_model: '' },
      },
      isLoading: false,
      loginUser: vi.fn(),
      logoutUser: vi.fn(),
      updateUser: vi.fn(),
    });

    vi.spyOn(PlansContextModule, 'usePlans').mockReturnValue({
      plans: [],
      isLoading: false,
      error: null,
      fetchPlans: vi.fn(),
      getPlanById: mockGetPlanById,
      getInteractionsForPlan: mockGetInteractionsForPlan,
      deletePlan: vi.fn(),
      activeCreation: { inFlight: false, prompt: null, error: null, errorCode: null, step: 'idle', createdPlanId: null },
      createPlan: mockCreatePlan,
      clearActiveCreationError: mockClearActiveCreationError,
      activeInteractionPlanId: null,
      activeInteractionPrompt: null,
      createPlanInteraction: vi.fn(),
    });
  });

  it('safely reads and prefills prompt without auto-submitting or creating plan', async () => {
    render(
      <MemoryRouter initialEntries={['/explore?prompt=Tell%20me%20about%20Carina%20Nebula']}>
        <Routes>
          <Route path="/explore" element={<Explore />} />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/e\.g\. Near-Earth asteroids approaching this week\.\.\./i) as HTMLInputElement;
    expect(input.value).toBe('Tell me about Carina Nebula');

    // Crucial requirement: must NOT automatically call createPlan before user confirms
    expect(mockCreatePlan).not.toHaveBeenCalled();
  });

  it('supports ?query= parameter as documented fallback alias', async () => {
    render(
      <MemoryRouter initialEntries={['/explore?query=Asteroids%20approaching%20Earth']}>
        <Routes>
          <Route path="/explore" element={<Explore />} />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/e\.g\. Near-Earth asteroids approaching this week\.\.\./i) as HTMLInputElement;
    expect(input.value).toBe('Asteroids approaching Earth');
    expect(mockCreatePlan).not.toHaveBeenCalled();
  });

  it('handles invalid or empty query values without breaking or populating text', async () => {
    render(
      <MemoryRouter initialEntries={['/explore?prompt=%20%20%20']}>
        <Routes>
          <Route path="/explore" element={<Explore />} />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/e\.g\. Near-Earth asteroids approaching this week\.\.\./i) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(mockCreatePlan).not.toHaveBeenCalled();
  });

  it('reasonably limits and truncates oversized incoming query text', async () => {
    const longPrompt = 'A'.repeat(800);
    render(
      <MemoryRouter initialEntries={[`/explore?prompt=${longPrompt}`]}>
        <Routes>
          <Route path="/explore" element={<Explore />} />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/e\.g\. Near-Earth asteroids approaching this week\.\.\./i) as HTMLInputElement;
    expect(input.value.length).toBe(500);
    expect(input.value).toBe('A'.repeat(500));
  });

  it('allows user to edit prefilled prompt and submit explicitly', async () => {
    mockCreatePlan.mockResolvedValueOnce({ id: 101, title: 'Custom Solar Query', discoveries: [] });

    render(
      <MemoryRouter initialEntries={['/explore?prompt=Solar%20flares']}>
        <Routes>
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/:id" element={<div>Loaded Plan 101</div>} />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/e\.g\. Near-Earth asteroids approaching this week\.\.\./i) as HTMLInputElement;
    expect(input.value).toBe('Solar flares');

    fireEvent.change(input, { target: { value: 'Solar flares today in X-class' } });
    expect(input.value).toBe('Solar flares today in X-class');

    const submitBtn = screen.getByRole('button', { name: /explore/i });
    fireEvent.click(submitBtn);

    // Submitting through form triggers creation
    await waitFor(() => {
      expect(mockCreatePlan).toHaveBeenCalledWith('Solar flares today in X-class');
    });
  });

  it('leaves unrelated query parameters alone and does not affect exploration', async () => {
    render(
      <MemoryRouter initialEntries={['/explore?theme=dark&session=xyz']}>
        <Routes>
          <Route path="/explore" element={<Explore />} />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/e\.g\. Near-Earth asteroids approaching this week\.\.\./i) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(mockCreatePlan).not.toHaveBeenCalled();
  });

  it('preserves query prompt through unauthenticated redirect to login and restores upon login', async () => {
    const mockLoginUser = vi.fn().mockResolvedValue(undefined);

    // Initial state: Unauthenticated
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      loginUser: mockLoginUser,
      logoutUser: vi.fn(),
      updateUser: vi.fn(),
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/explore?prompt=Deep%20Space%20Observation']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/explore" element={<Explore />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Verify redirected to login screen
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();

    // Now user logs in
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'astro' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secretpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLoginUser).toHaveBeenCalledWith('astro', 'secretpass');
    });

    // Update auth state to authenticated
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      user: {
        id: 1,
        username: 'astro',
        profile: { theme: 'dark', onboarding_completed_at: '2026-01-01T00:00:00Z', preferred_model: '' },
      },
      isLoading: false,
      loginUser: mockLoginUser,
      logoutUser: vi.fn(),
      updateUser: vi.fn(),
    });

    // Rerender at restored destination
    rerender(
      <MemoryRouter initialEntries={['/explore?prompt=Deep%20Space%20Observation']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/explore" element={<Explore />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/e\.g\. Near-Earth asteroids approaching this week\.\.\./i) as HTMLInputElement;
    expect(input.value).toBe('Deep Space Observation');
    expect(mockCreatePlan).not.toHaveBeenCalled();
  });
});
