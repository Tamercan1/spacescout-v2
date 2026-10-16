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
});

