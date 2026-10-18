/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { SpacePlan, Interaction } from '../types/planner';
import {
    getSpacePlans,
    getSpacePlan,
    deleteSpacePlan as apiDeleteSpacePlan,
    updateSpacePlan as apiUpdateSpacePlan,
    getInteractions as apiGetInteractions,
} from '../api/planner';

interface PlansContextType {
    plans: SpacePlan[];
    isLoading: boolean;
    error: string | null;
    fetchPlans: (force?: boolean) => Promise<SpacePlan[]>;
    getPlanById: (id: number) => Promise<SpacePlan>;
    getInteractionsForPlan: (planId: number, force?: boolean) => Promise<Interaction[]>;
    addPlan: (newPlan: SpacePlan) => void;
    updatePlanInCache: (updatedPlan: SpacePlan) => void;
    updatePlan: (id: number, partial: Partial<SpacePlan>) => Promise<SpacePlan>;
    deletePlan: (id: number) => Promise<void>;
    addInteractionToCache: (planId: number, interaction: Interaction, updatedPlan?: SpacePlan) => void;
}

const PlansContext = createContext<PlansContextType | undefined>(undefined);

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function PlansProvider({ children }: { children: React.ReactNode }) {
    const [plans, setPlans] = useState<SpacePlan[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [interactionsCache, setInteractionsCache] = useState<Record<number, Interaction[]>>({});

    const plansRef = useRef<SpacePlan[]>([]);
    const interactionsCacheRef = useRef<Record<number, Interaction[]>>({});

    useEffect(() => {
        plansRef.current = plans;
        interactionsCacheRef.current = interactionsCache;
    }, [plans, interactionsCache]);

    const lastFetchedRef = useRef<number | null>(null);
    const inFlightPlansPromiseRef = useRef<Promise<SpacePlan[]> | null>(null);
    const inFlightInteractionsRef = useRef<Record<number, Promise<Interaction[]> | undefined>>({});

    const fetchPlans = useCallback(async (force = false): Promise<SpacePlan[]> => {
        // If cached and fresh, return existing plans without network call
        if (!force && lastFetchedRef.current && (Date.now() - lastFetchedRef.current < CACHE_TTL_MS)) {
            setIsLoading(false);
            return plansRef.current;
        }

        // If a request is already in-flight, return the shared promise (deduplication)
        if (inFlightPlansPromiseRef.current) {
            return inFlightPlansPromiseRef.current;
        }

        if (plansRef.current.length === 0) {
            setIsLoading(true);
        }

        const fetchPromise = (async () => {
            try {
                setError(null);
                const data = await getSpacePlans();
                setPlans(data);
                lastFetchedRef.current = Date.now();
                return data;
            } catch (err: unknown) {
                console.error("Failed to fetch space plans", err);
                setError("Failed to load explorations");
                throw err;
            } finally {
                setIsLoading(false);
                inFlightPlansPromiseRef.current = null;
            }
        })();

        inFlightPlansPromiseRef.current = fetchPromise;
        return fetchPromise;
    }, []);

    // Initial mount fetch
    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    const getPlanById = useCallback(async (id: number): Promise<SpacePlan> => {
        // Check in-memory plans first
        const found = plansRef.current.find(p => p.id === id);
        if (found) {
            return found;
        }

        // Fetch detail if not found in current plans list
        const planData = await getSpacePlan(id);
        setPlans(prev => {
            const exists = prev.some(p => p.id === planData.id);
            if (exists) {
                return prev.map(p => p.id === planData.id ? planData : p);
            }
            return [planData, ...prev];
        });
        return planData;
    }, []);

    const getInteractionsForPlan = useCallback(async (planId: number, force = false): Promise<Interaction[]> => {
        // Return from cache if present and not forced
        const cached = interactionsCacheRef.current[planId];
        if (!force && cached) {
            return cached;
        }

        // Deduplicate in-flight interaction requests
        const inFlight = inFlightInteractionsRef.current[planId];
        if (inFlight) {
            return inFlight;
        }

        const promise = (async () => {
            try {
                const data = await apiGetInteractions(planId);
                setInteractionsCache(prev => ({
                    ...prev,
                    [planId]: data
                }));
                return data;
            } finally {
                delete inFlightInteractionsRef.current[planId];
            }
        })();

        inFlightInteractionsRef.current[planId] = promise;
        return promise;
    }, []);

    const addPlan = useCallback((newPlan: SpacePlan) => {
        setPlans(prev => {
            const filtered = prev.filter(p => p.id !== newPlan.id);
            return [newPlan, ...filtered];
        });
    }, []);

    const updatePlanInCache = useCallback((updatedPlan: SpacePlan) => {
        setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    }, []);

    const updatePlan = useCallback(async (id: number, partial: Partial<SpacePlan>): Promise<SpacePlan> => {
        const updated = await apiUpdateSpacePlan(id, partial);
        updatePlanInCache(updated);
        return updated;
    }, [updatePlanInCache]);

    const deletePlan = useCallback(async (id: number): Promise<void> => {
        await apiDeleteSpacePlan(id);
        delete interactionsCacheRef.current[id];
        setPlans(prev => prev.filter(p => p.id !== id));
        setInteractionsCache(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    const addInteractionToCache = useCallback((planId: number, interaction: Interaction, updatedPlan?: SpacePlan) => {
        setInteractionsCache(prev => {
            const existing = prev[planId] || [];
            const filtered = existing.filter(i => i.id !== interaction.id);
            return {
                ...prev,
                [planId]: [...filtered, interaction]
            };
        });
        if (updatedPlan) {
            updatePlanInCache(updatedPlan);
        }
    }, [updatePlanInCache]);

    const value: PlansContextType = {
        plans,
        isLoading,
        error,
        fetchPlans,
        getPlanById,
        getInteractionsForPlan,
        addPlan,
        updatePlanInCache,
        updatePlan,
        deletePlan,
        addInteractionToCache,
    };

    return (
        <PlansContext.Provider value={value}>
            {children}
        </PlansContext.Provider>
    );
}

export function usePlans(): PlansContextType {
    const context = useContext(PlansContext);
    if (!context) {
        throw new Error('usePlans must be used within a PlansProvider');
    }
    return context;
}
