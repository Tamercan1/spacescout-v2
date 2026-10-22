/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { SpacePlan, Interaction, InteractionCreateRequest } from '../types/planner';
import {
    getSpacePlans,
    getSpacePlan,
    createSpacePlan as apiCreateSpacePlan,
    deleteSpacePlan as apiDeleteSpacePlan,
    updateSpacePlan as apiUpdateSpacePlan,
    getInteractions as apiGetInteractions,
    createInteraction as apiCreateInteraction,
} from '../api/planner';

export interface ActiveCreationState {
    inFlight: boolean;
    prompt: string;
    step: number;
    error: string | null;
    errorCode?: string | null;
    createdPlanId?: number | null;
}

interface PlansContextType {
    plans: SpacePlan[];
    isLoading: boolean;
    error: string | null;
    fetchPlans: (force?: boolean) => Promise<SpacePlan[]>;
    getPlanById: (id: number, force?: boolean) => Promise<SpacePlan>;
    getInteractionsForPlan: (planId: number, force?: boolean) => Promise<Interaction[]>;
    addPlan: (newPlan: SpacePlan) => void;
    updatePlanInCache: (updatedPlan: SpacePlan) => void;
    updatePlan: (id: number, partial: Partial<SpacePlan>) => Promise<SpacePlan>;
    deletePlan: (id: number) => Promise<void>;
    addInteractionToCache: (planId: number, interaction: Interaction, updatedPlan?: SpacePlan) => void;

    // Navigation-safe Active Creation & Interaction tracking
    activeCreation: ActiveCreationState;
    createPlan: (prompt: string) => Promise<SpacePlan>;
    clearActiveCreationError: () => void;

    activeInteractionPlanId: number | null;
    activeInteractionPrompt: string;
    createPlanInteraction: (planId: number, data: InteractionCreateRequest) => Promise<Interaction>;
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

    const getPlanById = useCallback(async (id: number, force = false): Promise<SpacePlan> => {
        // Check in-memory plans first if not forced
        if (!force) {
            const found = plansRef.current.find(p => p.id === id);
            if (found) {
                return found;
            }
        }

        // Fetch detail if not found in current plans list or forced
        const planData = await getSpacePlan(id);
        const exists = plansRef.current.some(p => p.id === planData.id);
        plansRef.current = exists
            ? plansRef.current.map(p => p.id === planData.id ? planData : p)
            : [planData, ...plansRef.current];

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
                interactionsCacheRef.current[planId] = data;
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
        const filtered = plansRef.current.filter(p => p.id !== newPlan.id);
        plansRef.current = [newPlan, ...filtered];
        setPlans(prev => {
            const filtered = prev.filter(p => p.id !== newPlan.id);
            return [newPlan, ...filtered];
        });
    }, []);

    const updatePlanInCache = useCallback((updatedPlan: SpacePlan) => {
        plansRef.current = plansRef.current.map(p => p.id === updatedPlan.id ? updatedPlan : p);
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
        plansRef.current = plansRef.current.filter(p => p.id !== id);
        setPlans(prev => prev.filter(p => p.id !== id));
        setInteractionsCache(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    const addInteractionToCache = useCallback((planId: number, interaction: Interaction, updatedPlan?: SpacePlan) => {
        const existing = interactionsCacheRef.current[planId] || [];
        const filtered = existing.filter(i => i.id !== interaction.id);
        const updatedList = [...filtered, interaction];
        interactionsCacheRef.current[planId] = updatedList;

        setInteractionsCache(prev => ({
            ...prev,
            [planId]: updatedList
        }));
        if (updatedPlan) {
            updatePlanInCache(updatedPlan);
        }
    }, [updatePlanInCache]);

    // ============================================================
    // NAVIGATION-SAFE ACTIVE CREATION & INTERACTION STATE
    // ============================================================
    const [activeCreation, setActiveCreation] = useState<ActiveCreationState>({
        inFlight: false,
        prompt: '',
        step: 0,
        error: null,
        errorCode: null,
        createdPlanId: null,
    });

    const inFlightCreationPromiseRef = useRef<Promise<SpacePlan> | null>(null);
    const inFlightCreationPromptRef = useRef<string>('');
    const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const clearStepTimers = useCallback(() => {
        stepTimersRef.current.forEach(t => clearTimeout(t));
        stepTimersRef.current = [];
    }, []);

    useEffect(() => {
        return () => {
            stepTimersRef.current.forEach(t => clearTimeout(t));
        };
    }, []);

    const clearActiveCreationError = useCallback(() => {
        setActiveCreation(prev => ({
            ...prev,
            error: null,
            errorCode: null,
        }));
    }, []);

    const createPlan = useCallback(async (promptText: string): Promise<SpacePlan> => {
        const cleanPrompt = promptText.trim();
        if (!cleanPrompt) {
            throw new Error("Prompt cannot be empty");
        }

        // Deduplication: if an active creation is already running, return the shared promise
        if (inFlightCreationPromiseRef.current) {
            return inFlightCreationPromiseRef.current;
        }

        clearStepTimers();
        inFlightCreationPromptRef.current = cleanPrompt;
        setActiveCreation({
            inFlight: true,
            prompt: cleanPrompt,
            step: 0,
            error: null,
            errorCode: null,
            createdPlanId: null,
        });

        // Set up progressive step timers for mission planner animation
        const timer1 = setTimeout(() => {
            setActiveCreation(prev => prev.inFlight ? { ...prev, step: 1 } : prev);
        }, 1600);
        const timer2 = setTimeout(() => {
            setActiveCreation(prev => prev.inFlight ? { ...prev, step: 2 } : prev);
        }, 3400);
        stepTimersRef.current = [timer1, timer2];

        const creationPromise = (async () => {
            try {
                const newPlan = await apiCreateSpacePlan(cleanPrompt);
                clearStepTimers();

                // Add to plans cache
                setPlans(prev => {
                    const filtered = prev.filter(p => p.id !== newPlan.id);
                    return [newPlan, ...filtered];
                });

                localStorage.setItem('active_exploration_id', String(newPlan.id));
                window.dispatchEvent(new CustomEvent('spacescout:plans_updated'));

                setActiveCreation({
                    inFlight: false,
                    prompt: '',
                    step: 0,
                    error: null,
                    errorCode: null,
                    createdPlanId: newPlan.id,
                });

                return newPlan;
            } catch (err: unknown) {
                clearStepTimers();
                const errorObj = err as {
                    response?: { data?: { detail?: string; error_code?: string } };
                    message?: string;
                };
                const detail = errorObj.response?.data?.detail || errorObj.message || "Failed to create exploration. Please try again.";
                let errorCode = errorObj.response?.data?.error_code || null;

                if (!errorCode && (detail.toLowerCase().includes("openrouter api key in settings") || detail.toLowerCase().includes("no ai provider key"))) {
                    errorCode = "missing_credential";
                }

                setActiveCreation({
                    inFlight: false,
                    prompt: cleanPrompt,
                    step: 0,
                    error: detail,
                    errorCode: errorCode,
                    createdPlanId: null,
                });

                throw err;
            } finally {
                inFlightCreationPromiseRef.current = null;
                inFlightCreationPromptRef.current = '';
            }
        })();

        inFlightCreationPromiseRef.current = creationPromise;
        return creationPromise;
    }, [clearStepTimers]);

    const [activeInteractionPlanId, setActiveInteractionPlanId] = useState<number | null>(null);
    const [activeInteractionPrompt, setActiveInteractionPrompt] = useState<string>('');
    const inFlightInteractionExecRef = useRef<Record<number, Promise<Interaction>>>({});

    const createPlanInteraction = useCallback(async (planId: number, data: InteractionCreateRequest): Promise<Interaction> => {
        const existing = inFlightInteractionExecRef.current[planId];
        if (existing) {
            return existing;
        }

        setActiveInteractionPlanId(planId);
        setActiveInteractionPrompt(data.user_prompt);

        const execPromise = (async () => {
            try {
                const newInteraction = await apiCreateInteraction(planId, data);
                let updatedPlan: SpacePlan | undefined;
                try {
                    updatedPlan = await getSpacePlan(planId);
                } catch (err) {
                    // Non-fatal if detail refetch encounters transient issue
                    console.warn(`Failed to refetch plan detail for ${planId}:`, err);
                }

                if (updatedPlan) {
                    const exists = plansRef.current.some(p => p.id === planId);
                    plansRef.current = exists
                        ? plansRef.current.map(p => p.id === planId ? updatedPlan! : p)
                        : [updatedPlan, ...plansRef.current];

                    setPlans(prev => {
                        const exists = prev.some(p => p.id === planId);
                        return exists ? prev.map(p => p.id === planId ? updatedPlan! : p) : [updatedPlan, ...prev];
                    });
                }

                const existingList = interactionsCacheRef.current[planId] || [];
                const filtered = existingList.filter(i => i.id !== newInteraction.id);
                const updatedInteractions = [...filtered, newInteraction];
                interactionsCacheRef.current[planId] = updatedInteractions;

                setInteractionsCache(prev => ({
                    ...prev,
                    [planId]: updatedInteractions
                }));

                window.dispatchEvent(new CustomEvent('spacescout:plans_updated'));
                return newInteraction;
            } finally {
                delete inFlightInteractionExecRef.current[planId];
                setActiveInteractionPlanId(prev => prev === planId ? null : prev);
                setActiveInteractionPrompt('');
            }
        })();

        inFlightInteractionExecRef.current[planId] = execPromise;
        return execPromise;
    }, []);

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
        activeCreation,
        createPlan,
        clearActiveCreationError,
        activeInteractionPlanId,
        activeInteractionPrompt,
        createPlanInteraction,
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
