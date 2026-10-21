import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PlansProvider, usePlans } from '../../context/PlansContext';
import * as plannerApi from '../../api/planner';
import type { SpacePlan, Interaction } from '../../types/planner';

import { useState } from 'react';

vi.mock('../../api/planner');

function TestPlansConsumer() {
    const {
        plans,
        isLoading,
        error,
        fetchPlans,
        getPlanById,
        getInteractionsForPlan,
        deletePlan,
        activeCreation,
        createPlan,
        clearActiveCreationError,
        activeInteractionPlanId,
        createPlanInteraction,
    } = usePlans();

    const [interactionCount, setInteractionCount] = useState<number>(0);

    const handleGetInteractions = async (planId: number) => {
        const res = await getInteractionsForPlan(planId);
        setInteractionCount(res.length);
    };

    return (
        <div>
            <div data-testid="loading">{isLoading ? 'Loading' : 'Idle'}</div>
            <div data-testid="error">{error ?? 'None'}</div>
            <div data-testid="plan-count">{plans.length}</div>
            <div data-testid="interaction-count">{interactionCount}</div>
            <div data-testid="creation-inflight">{activeCreation.inFlight ? 'InFlight' : 'Idle'}</div>
            <div data-testid="creation-prompt">{activeCreation.prompt}</div>
            <div data-testid="creation-error">{activeCreation.error ?? 'None'}</div>
            <div data-testid="creation-errorcode">{activeCreation.errorCode ?? 'None'}</div>
            <div data-testid="creation-planid">{activeCreation.createdPlanId ?? 'None'}</div>
            <div data-testid="active-interaction-planid">{activeInteractionPlanId ?? 'None'}</div>
            <ul>
                {plans.map((p) => (
                    <li key={p.id} data-testid={`plan-${p.id}`}>
                        {p.title}
                    </li>
                ))}
            </ul>
            <button type="button" onClick={() => fetchPlans()}>Fetch Plans</button>
            <button type="button" onClick={() => fetchPlans(true)}>Force Fetch Plans</button>
            <button type="button" onClick={() => getPlanById(101)}>Get Plan 101</button>
            <button type="button" onClick={() => handleGetInteractions(101)}>Get Interactions 101</button>
            <button type="button" onClick={() => deletePlan(101)}>Delete Plan 101</button>
            <button type="button" onClick={() => { createPlan('Explore Mars polar caps').catch(() => {}); }}>Create Mars Plan</button>
            <button type="button" onClick={() => clearActiveCreationError()}>Clear Creation Error</button>
            <button type="button" onClick={() => { createPlanInteraction(101, { interaction_type: 'find_more', user_prompt: 'Look for water ice' }).catch(() => {}); }}>
                Add Mars Interaction
            </button>
        </div>
    );
}

describe('PlansContext Caching & Operations', () => {
    const mockPlan: SpacePlan = {
        id: 101,
        title: 'Mission to Europa',
        prompt: 'Investigate Europa oceans',
        summary: 'Europa exploration overview',
        status: 'completed',
        is_archived: false,
        discoveries: [],
        created_at: '2026-10-10T00:00:00Z',
        updated_at: '2026-10-10T00:00:00Z',
    };

    const mockInteractions: Interaction[] = [
        {
            id: 'inter-1',
            space_plan: 101,
            user_prompt: 'Search for ice plumes',
            interaction_type: 'find_more',
            status: 'completed',
            response: {
                result_type: 'analysis',
                content: {
                    title: 'Plumes detected',
                    summary: 'Water vapor analysis',
                    sections: [{ heading: 'Evidence', content: 'Spectroscopy observations' }],
                },
                discoveries: [],
            },
            error_code: '',
            target_discoveries: [],
            added_discoveries: [],
            created_at: '2026-10-10T01:00:00Z',
            completed_at: '2026-10-10T01:01:00Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads initial plans on mount and avoids redundant network calls when cache is fresh', async () => {
        vi.mocked(plannerApi.getSpacePlans).mockResolvedValue([mockPlan]);

        render(
            <PlansProvider>
                <TestPlansConsumer />
            </PlansProvider>
        );

        // Mount trigger
        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('Idle');
            expect(screen.getByTestId('plan-count')).toHaveTextContent('1');
        });
        expect(plannerApi.getSpacePlans).toHaveBeenCalledTimes(1);

        // Explicit fetch call within TTL
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Plans' }));
        expect(plannerApi.getSpacePlans).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent in-flight plan fetch requests', async () => {
        let resolvePlans: (plans: SpacePlan[]) => void = () => {};
        vi.mocked(plannerApi.getSpacePlans).mockReturnValue(
            new Promise<SpacePlan[]>((resolve) => {
                resolvePlans = resolve;
            })
        );

        render(
            <PlansProvider>
                <TestPlansConsumer />
            </PlansProvider>
        );

        // Rapid subsequent fetch
        fireEvent.click(screen.getByRole('button', { name: 'Fetch Plans' }));

        resolvePlans([mockPlan]);

        await waitFor(() => {
            expect(screen.getByTestId('plan-count')).toHaveTextContent('1');
        });
        expect(plannerApi.getSpacePlans).toHaveBeenCalledTimes(1);
    });

    it('uses already-cached plan in getPlanById without issuing a separate API call', async () => {
        vi.mocked(plannerApi.getSpacePlans).mockResolvedValue([mockPlan]);
        vi.mocked(plannerApi.getSpacePlan).mockResolvedValue(mockPlan);

        render(
            <PlansProvider>
                <TestPlansConsumer />
            </PlansProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('plan-count')).toHaveTextContent('1');
        });

        // Request plan 101 which was returned in the plans list
        fireEvent.click(screen.getByRole('button', { name: 'Get Plan 101' }));

        // getSpacePlan (single item detail) should NOT have been called
        expect(plannerApi.getSpacePlan).not.toHaveBeenCalled();
    });

    it('caches interactions per plan and invalidates cache when plan is deleted', async () => {
        vi.mocked(plannerApi.getSpacePlans).mockResolvedValue([mockPlan]);
        vi.mocked(plannerApi.getInteractions).mockResolvedValue(mockInteractions);
        vi.mocked(plannerApi.deleteSpacePlan).mockResolvedValue(undefined);

        render(
            <PlansProvider>
                <TestPlansConsumer />
            </PlansProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('plan-count')).toHaveTextContent('1');
        });

        // First call to get interactions
        fireEvent.click(screen.getByRole('button', { name: 'Get Interactions 101' }));
        await waitFor(() => {
            expect(screen.getByTestId('interaction-count')).toHaveTextContent('1');
            expect(plannerApi.getInteractions).toHaveBeenCalledTimes(1);
        });

        // Second call should hit the interactionsCache
        fireEvent.click(screen.getByRole('button', { name: 'Get Interactions 101' }));
        expect(plannerApi.getInteractions).toHaveBeenCalledTimes(1);

        // Delete plan 101
        fireEvent.click(screen.getByRole('button', { name: 'Delete Plan 101' }));
        await waitFor(() => {
            expect(screen.getByTestId('plan-count')).toHaveTextContent('0');
        });
        expect(plannerApi.deleteSpacePlan).toHaveBeenCalledWith(101);

        // Requesting interactions again should now re-fetch because the cache was invalidated
        fireEvent.click(screen.getByRole('button', { name: 'Get Interactions 101' }));
        await waitFor(() => {
            expect(plannerApi.getInteractions).toHaveBeenCalledTimes(2);
        });
    });

    it('tracks activeCreation lifecycle across navigation and updates localStorage and plans cache on success', async () => {
        vi.mocked(plannerApi.getSpacePlans).mockResolvedValue([mockPlan]);

        const newPlan: SpacePlan = {
            id: 102,
            title: 'Explore Mars polar caps',
            prompt: 'Explore Mars polar caps',
            summary: 'Mars ice cap summary',
            status: 'completed',
            is_archived: false,
            discoveries: [],
            created_at: '2026-10-11T00:00:00Z',
            updated_at: '2026-10-11T00:00:00Z',
        };

        let resolveCreation: (plan: SpacePlan) => void = () => {};
        vi.mocked(plannerApi.createSpacePlan).mockReturnValue(
            new Promise<SpacePlan>((resolve) => {
                resolveCreation = resolve;
            })
        );

        render(
            <PlansProvider>
                <TestPlansConsumer />
            </PlansProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('plan-count')).toHaveTextContent('1');
        });

        // Trigger plan creation
        fireEvent.click(screen.getByRole('button', { name: 'Create Mars Plan' }));

        // Verify in-flight creation state is immediately active in context
        expect(screen.getByTestId('creation-inflight')).toHaveTextContent('InFlight');
        expect(screen.getByTestId('creation-prompt')).toHaveTextContent('Explore Mars polar caps');

        // Resolve backend creation
        resolveCreation(newPlan);

        await waitFor(() => {
            expect(screen.getByTestId('creation-inflight')).toHaveTextContent('Idle');
            expect(screen.getByTestId('creation-planid')).toHaveTextContent('102');
            expect(screen.getByTestId('plan-count')).toHaveTextContent('2');
        });

        expect(localStorage.getItem('active_exploration_id')).toBe('102');
    });

    it('deduplicates concurrent duplicate createPlan requests while activeCreation is in flight', async () => {
        vi.mocked(plannerApi.getSpacePlans).mockResolvedValue([mockPlan]);

        let resolveCreation: (plan: SpacePlan) => void = () => {};
        vi.mocked(plannerApi.createSpacePlan).mockReturnValue(
            new Promise<SpacePlan>((resolve) => {
                resolveCreation = resolve;
            })
        );

        render(
            <PlansProvider>
                <TestPlansConsumer />
            </PlansProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('plan-count')).toHaveTextContent('1');
        });

        // First click triggers creation
        fireEvent.click(screen.getByRole('button', { name: 'Create Mars Plan' }));
        expect(plannerApi.createSpacePlan).toHaveBeenCalledTimes(1);

        // Immediate second click while in-flight must be ignored
        fireEvent.click(screen.getByRole('button', { name: 'Create Mars Plan' }));
        expect(plannerApi.createSpacePlan).toHaveBeenCalledTimes(1);

        resolveCreation({
            ...mockPlan,
            id: 103,
            title: 'Explore Mars polar caps',
        });

        await waitFor(() => {
            expect(screen.getByTestId('creation-inflight')).toHaveTextContent('Idle');
        });
    });

    it('records error and error_code when backend returns missing_credential and allows clearing error', async () => {
        vi.mocked(plannerApi.getSpacePlans).mockResolvedValue([mockPlan]);

        const credentialError = {
            response: {
                status: 502,
                data: {
                    detail: 'OpenRouter API key is required. Please set OPENROUTER_API_KEY in your environment or configure your API key in Settings.',
                    error_code: 'missing_credential',
                },
            },
        };

        vi.mocked(plannerApi.createSpacePlan).mockRejectedValue(credentialError);

        render(
            <PlansProvider>
                <TestPlansConsumer />
            </PlansProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('plan-count')).toHaveTextContent('1');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Create Mars Plan' }));

        await waitFor(() => {
            expect(screen.getByTestId('creation-inflight')).toHaveTextContent('Idle');
            expect(screen.getByTestId('creation-errorcode')).toHaveTextContent('missing_credential');
            expect(screen.getByTestId('creation-error')).toHaveTextContent(/OpenRouter API key is required/);
        });

        // Clear error action
        fireEvent.click(screen.getByRole('button', { name: 'Clear Creation Error' }));
        expect(screen.getByTestId('creation-error')).toHaveTextContent('None');
        expect(screen.getByTestId('creation-errorcode')).toHaveTextContent('None');
    });

    it('tracks activeInteractionPlanId and deduplicates concurrent interaction requests for the same plan', async () => {
        vi.mocked(plannerApi.getSpacePlans).mockResolvedValue([mockPlan]);
        vi.mocked(plannerApi.getInteractions).mockResolvedValue(mockInteractions);

        let resolveInteraction: (interaction: Interaction) => void = () => {};
        vi.mocked(plannerApi.createInteraction).mockReturnValue(
            new Promise<Interaction>((resolve) => {
                resolveInteraction = resolve;
            })
        );
        vi.mocked(plannerApi.getSpacePlan).mockResolvedValue(mockPlan);

        render(
            <PlansProvider>
                <TestPlansConsumer />
            </PlansProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('plan-count')).toHaveTextContent('1');
        });

        // Trigger interaction
        fireEvent.click(screen.getByRole('button', { name: 'Add Mars Interaction' }));

        // Active interaction plan ID is set
        expect(screen.getByTestId('active-interaction-planid')).toHaveTextContent('101');
        expect(plannerApi.createInteraction).toHaveBeenCalledTimes(1);

        // Concurrent click on interaction for same plan is deduplicated
        fireEvent.click(screen.getByRole('button', { name: 'Add Mars Interaction' }));
        expect(plannerApi.createInteraction).toHaveBeenCalledTimes(1);

        // Resolve interaction
        resolveInteraction({
            id: 'inter-2',
            space_plan: 101,
            user_prompt: 'Look for water ice',
            interaction_type: 'find_more',
            status: 'completed',
            response: {
                result_type: 'analysis',
                content: { title: 'Ice found', summary: 'Polar ice confirmed', sections: [] },
                discoveries: [],
            },
            error_code: '',
            target_discoveries: [],
            added_discoveries: [],
            created_at: '2026-10-11T00:05:00Z',
            completed_at: '2026-10-11T00:05:30Z',
        });

        await waitFor(() => {
            expect(screen.getByTestId('active-interaction-planid')).toHaveTextContent('None');
        });
    });
});

