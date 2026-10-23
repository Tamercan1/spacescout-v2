import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
    Compass, Layers, MessageSquare, Loader2,
    Sparkles, Orbit, CheckCircle2, AlertCircle, RefreshCw,
    ChevronUp, ChevronDown, Send, X, Key
} from 'lucide-react';
import { usePlans } from '../context/PlansContext';
import type { SpacePlan, Interaction, Discovery, InteractionType } from '../types/planner';
import InteractionStream from '../components/explore/InteractionStream';
import MediaViewer from '../components/common/MediaViewer';

export default function Explore() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const {
        plans,
        isLoading: isPlansLoading,
        getPlanById,
        getInteractionsForPlan,
        activeCreation,
        createPlan,
        clearActiveCreationError,
        activeInteractionPlanId,
        activeInteractionPrompt,
        createPlanInteraction,
    } = usePlans();

    const navState = location.state as { initialPrompt?: string; startFresh?: boolean } | null;
    const initialPrompt = navState?.initialPrompt;
    const startFresh = navState?.startFresh;

    // Safely extract, validate, and limit optional incoming query parameter (?prompt=... or ?query=...)
    const MAX_QUERY_PROMPT_LENGTH = 500;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const queryPrompt = useMemo(() => {
        const raw = searchParams.get('prompt') || searchParams.get('query');
        if (!raw) return null;
        const trimmed = raw.trim();
        if (!trimmed) return null;
        return trimmed.slice(0, MAX_QUERY_PROMPT_LENGTH);
    }, [searchParams]);

    const hasConsumedQueryPromptRef = useRef<boolean>(false);
    const hasInitialQueryPrompt = Boolean(!id && !startFresh && queryPrompt);

    const [plan, setPlan] = useState<SpacePlan | null>(null);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [isLoading, setIsLoading] = useState(!startFresh && !hasInitialQueryPrompt);
    const [localPrompt, setLocalPrompt] = useState(initialPrompt || "");
    const [error, setError] = useState<string | null>(null);
    const [continueExpanded, setContinueExpanded] = useState(() => {
        return localStorage.getItem('spacescout_keep_continue_open') === 'true';
    });
    const [prompt, setPrompt] = useState("");
    const [emptyPrompt, setEmptyPrompt] = useState(hasInitialQueryPrompt && queryPrompt ? queryPrompt : "");
    const [localIsCreatingInteraction, setLocalIsCreatingInteraction] = useState(false);
    const [followUpError, setFollowUpError] = useState<string | null>(null);

    const isCreatingNew = activeCreation.inFlight;
    const creationPrompt = activeCreation.prompt || localPrompt;
    const creationStep = activeCreation.step;
    const isCreatingInteraction = Boolean(
        (activeInteractionPlanId && plan && activeInteractionPlanId === plan.id) || localIsCreatingInteraction
    );

    const loadedPlanIdRef = useRef<number | null>(null);
    const dockRef = useRef<HTMLDivElement>(null);
    const streamEndRef = useRef<HTMLDivElement>(null);
    const justSubmittedRef = useRef<boolean>(false);
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    });

    // Auto-collapse dock on outside click or Escape key unless 'keep open' preference is enabled
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const keepOpen = localStorage.getItem('spacescout_keep_continue_open') === 'true';
            if (keepOpen) return;
            if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
                setContinueExpanded(false);
            }
        };

        const handleKeyDownEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                const keepOpen = localStorage.getItem('spacescout_keep_continue_open') === 'true';
                if (!keepOpen) {
                    setContinueExpanded(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDownEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDownEscape);
        };
    }, []);

    // Context-aware dynamic suggestion chips based on active mission findings
    const dynamicChips = useMemo(() => {
        if (!plan) return [];
        const chips: string[] = ['Find more like these'];
        const planDiscoveries = plan.discoveries || [];
        
        const hasNeo = planDiscoveries.some(d => d.type === 'neo' || d.source === 'neows');
        const hasSolar = planDiscoveries.some(d => d.source === 'donki' || d.type === 'solar_flare');
        const hasApodOrImage = planDiscoveries.some(d => d.source === 'apod' || d.source === 'nasa_images' || d.source === 'epic');

        const namedDiscovery = planDiscoveries.find(d => d.title && d.title.length < 32 && !d.title.toLowerCase().includes('untitled'));
        if (namedDiscovery) {
            chips.push(`Deep dive on ${namedDiscovery.title}`);
        }

        if (hasNeo) {
            chips.push('All hazardous objects', 'Closest approach data');
        } else if (hasSolar) {
            chips.push('Solar flare radiation risks', 'CME arrival timeline');
        } else if (hasApodOrImage) {
            chips.push('High-resolution imagery details', 'Telescope instruments used');
        } else {
            chips.push('Scientific background', 'Key discoveries summary');
        }

        return Array.from(new Set(chips)).slice(0, 4);
    }, [plan]);

    // Smoothly scroll to the bottom when a follow-up interaction request is launched or completed
    useEffect(() => {
        if (isCreatingInteraction || justSubmittedRef.current) {
            const timer = setTimeout(() => {
                streamEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                if (!isCreatingInteraction) {
                    justSubmittedRef.current = false;
                }
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [isCreatingInteraction, interactions.length]);

    const creationStartedRef = useRef<string | null>(null);

    // Handle explicit startFresh request from sidebar "+ New" button
    const [prevLocationKey, setPrevLocationKey] = useState(location.key);
    if (startFresh && location.key !== prevLocationKey) {
        setPrevLocationKey(location.key);
        setPlan(null);
        setInteractions([]);
        setIsLoading(false);
        setError(null);
        clearActiveCreationError();
    }

    useEffect(() => {
        if (!startFresh) return;
        localStorage.removeItem('active_exploration_id');
        loadedPlanIdRef.current = null;
    }, [startFresh]);

    // Creation flow when initialPrompt is provided via navigation
    useEffect(() => {
        if (!initialPrompt) return;
        if (creationStartedRef.current === initialPrompt) return;
        creationStartedRef.current = initialPrompt;
        setLocalPrompt(initialPrompt);

        const runCreate = async () => {
            setError(null);
            try {
                const newPlan = await createPlan(initialPrompt);
                if (!isMountedRef.current) return;

                loadedPlanIdRef.current = newPlan.id;
                setPlan(newPlan);
                setInteractions([]);
                setIsLoading(false);
                navigate(`/explore/${newPlan.id}`, { replace: true, state: {} });
            } catch (err: unknown) {
                if (!isMountedRef.current) return;
                console.error("Failed to create exploration", err);
                setIsLoading(false);
            }
        };

        runCreate();
    }, [initialPrompt, navigate, createPlan]);

    // Consume incoming query prompt (from URL parameter) safely without auto-submitting
    useEffect(() => {
        if (!queryPrompt || hasConsumedQueryPromptRef.current) return;
        hasConsumedQueryPromptRef.current = true;

        if (!id) {
            setEmptyPrompt(queryPrompt);
            setPlan(null);
            setIsLoading(false);
        } else {
            setPrompt(queryPrompt);
            setContinueExpanded(true);
        }
    }, [queryPrompt, id]);

    // Loading existing plan or handling resumption when no prompt is provided
    useEffect(() => {
        if (initialPrompt || startFresh || (!id && queryPrompt)) return;

        const loadOrResume = async () => {
            // If active creation is in flight, let the mission planner loading UI render
            if (activeCreation.inFlight) {
                setIsLoading(false);
                return;
            }

            // If active creation failed and no id in URL, let the error card render
            if (activeCreation.error && !id) {
                setIsLoading(false);
                return;
            }

            // If active creation completed while user was on another route, navigate to it
            if (activeCreation.createdPlanId && !id) {
                navigate(`/explore/${activeCreation.createdPlanId}`, { replace: true });
                return;
            }

            // If already loaded in state, keep it without refetching
            if (id && loadedPlanIdRef.current === parseInt(id, 10)) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            // Case A: ID is explicitly in URL (/explore/:id)
            if (id) {
                const planId = parseInt(id, 10);
                if (!isNaN(planId)) {
                    try {
                        const [planData, interactionData] = await Promise.all([
                            getPlanById(planId),
                            getInteractionsForPlan(planId),
                        ]);
                        if (!isMountedRef.current) return;
                        loadedPlanIdRef.current = planId;
                        setPlan(planData);
                        setInteractions(interactionData);
                        localStorage.setItem('active_exploration_id', String(planId));
                        setIsLoading(false);
                        return;
                    } catch (err) {
                        if (!isMountedRef.current) return;
                        console.warn(`Exploration ${planId} not found, attempting auto-fallback:`, err);
                        localStorage.removeItem('active_exploration_id');
                    }
                }
            }

            // Case B: Saved ID in localStorage (if different from failed id)
            const savedId = localStorage.getItem('active_exploration_id');
            if (savedId && savedId !== id) {
                const planId = parseInt(savedId, 10);
                if (!isNaN(planId)) {
                    try {
                        const [planData, interactionData] = await Promise.all([
                            getPlanById(planId),
                            getInteractionsForPlan(planId),
                        ]);
                        if (!isMountedRef.current) return;
                        loadedPlanIdRef.current = planId;
                        setPlan(planData);
                        setInteractions(interactionData);
                        setIsLoading(false);
                        navigate(`/explore/${planId}`, { replace: true });
                        return;
                    } catch (err) {
                        console.warn("Saved exploration failed to load, removing:", err);
                        localStorage.removeItem('active_exploration_id');
                    }
                } else {
                    localStorage.removeItem('active_exploration_id');
                }
            }

            // Case C: Auto-fallback to user's latest exploration from cached plans
            try {
                const fallback = id ? plans.find(p => String(p.id) !== id) : plans[0];
                if (fallback) {
                    localStorage.setItem('active_exploration_id', String(fallback.id));
                    navigate(`/explore/${fallback.id}`, { replace: true });
                    return;
                } else if (!isPlansLoading) {
                    // User has 0 explorations in total: stay on /explore and show empty state
                    loadedPlanIdRef.current = null;
                    setPlan(null);
                    setInteractions([]);
                    setError(null);
                }
            } catch (err) {
                if (!isMountedRef.current) return;
                console.error("Failed to load explorations fallback:", err);
                setPlan(null);
                setInteractions([]);
                setError(null);
            } finally {
                if (isMountedRef.current && !isPlansLoading) {
                    setIsLoading(false);
                }
            }
        };

        loadOrResume();
    }, [id, initialPrompt, startFresh, navigate, plans, isPlansLoading, getPlanById, getInteractionsForPlan, activeCreation]);

    const handleRetryCreation = async () => {
        const promptToRetry = activeCreation.prompt || creationPrompt;
        if (!promptToRetry.trim()) return;
        clearActiveCreationError();
        setError(null);
        setIsLoading(true);
        try {
            const newPlan = await createPlan(promptToRetry);
            if (!isMountedRef.current) return;
            loadedPlanIdRef.current = newPlan.id;
            setPlan(newPlan);
            setInteractions([]);
            setIsLoading(false);
            navigate(`/explore/${newPlan.id}`, { replace: true, state: {} });
        } catch (err: unknown) {
            if (!isMountedRef.current) return;
            console.error("Failed to create exploration on retry", err);
            setIsLoading(false);
        }
    };

    // Render multi-stage mission planner during creation
    if (isCreatingNew) {
        const steps = [
            {
                title: "Analyzing mission query & parameters",
                desc: "Parsing astronomical targets, time windows, and celestial coordinates",
                icon: Sparkles
            },
            {
                title: "Querying NASA data archives",
                desc: "Fetching NeoWs, APOD, DONKI telemetry and scientific mission data",
                icon: Orbit
            },
            {
                title: "Synthesizing discoveries & planetary intel",
                desc: "Formulating exploration findings and interactive discovery stream",
                icon: Layers
            }
        ];

        return (
            <div className="explore-layout">
                <div className="mission-loading-wrap">
                    <div className="mission-planner-card">
                        <div className="mission-planner-badge">
                            <span className="mission-badge-dot" />
                            AI MISSION PLANNER
                        </div>

                        <div className="mission-query-box">
                            <span className="mission-query-label">EXPLORING</span>
                            <h2 className="mission-query-text">"{creationPrompt}"</h2>
                        </div>

                        <div className="mission-steps">
                            {steps.map((s, idx) => {
                                const isDone = creationStep > idx;
                                const isCurrent = creationStep === idx;
                                const Icon = s.icon;

                                return (
                                    <div 
                                        key={idx} 
                                        className={`mission-step ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}
                                    >
                                        <div className="mission-step-icon">
                                            {isDone ? (
                                                <CheckCircle2 size={18} color="var(--green)" />
                                            ) : isCurrent ? (
                                                <Loader2 size={18} className="spinner" color="var(--blue)" />
                                            ) : (
                                                <Icon size={16} color="var(--text-3)" />
                                            )}
                                        </div>
                                        <div className="mission-step-text">
                                            <div className="mission-step-title">{s.title}</div>
                                            <div className="mission-step-desc">{s.desc}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Skeletons preview */}
                    <div className="mission-skeletons">
                        <div className="skeleton-card">
                            <div className="skeleton-line skeleton-title" />
                            <div className="skeleton-box skeleton-media" />
                            <div className="skeleton-line skeleton-body" />
                            <div className="skeleton-line skeleton-body short" />
                        </div>
                        <div className="skeleton-card hide-on-mobile">
                            <div className="skeleton-line skeleton-title" />
                            <div className="skeleton-box skeleton-media" />
                            <div className="skeleton-line skeleton-body" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render loading spinner for existing plan fetching
    if (isLoading) {
        return (
            <div className="explore-layout">
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--text-3)' }}>
                    <Loader2 size={20} className="spinner" />
                    <span>Loading exploration...</span>
                </div>
            </div>
        );
    }

    // Render creation error or general failure
    const displayError = activeCreation.error || error;
    const isMissingCred = activeCreation.errorCode === 'missing_credential' ||
        Boolean(displayError && (
            displayError.toLowerCase().includes("openrouter api key in settings") ||
            displayError.toLowerCase().includes("no ai provider key")
        ));

    if (displayError) {
        return (
            <div className="explore-layout">
                <div className="explore-error-wrap">
                    <div className="explore-error-view">
                        <div className={`explore-error-icon-glow ${isMissingCred ? 'warning' : 'error'}`}>
                            {isMissingCred ? <Key size={32} /> : <AlertCircle size={32} />}
                        </div>
                        <h2 className="explore-error-title">
                            {isMissingCred ? 'Connect AI Provider' : 'Exploration Failed'}
                        </h2>
                        <p className="explore-error-desc">
                            {displayError}
                        </p>
                        <div className="explore-error-actions">
                            {isMissingCred ? (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => navigate('/settings?tab=credentials')}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Key size={15} /> Set up API keys
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => {
                                            clearActiveCreationError();
                                            setError(null);
                                            navigate('/');
                                        }}
                                    >
                                        Back to Home
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleRetryCreation}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <RefreshCw size={15} /> Try Again
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => {
                                            clearActiveCreationError();
                                            setError(null);
                                            setLocalPrompt('');
                                        }}
                                    >
                                        New Prompt
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render empty state when user has no active plan
    if (!plan) {
        return (
            <div className="explore-layout">
                <div className="explore-empty-wrap">
                    <div className="explore-empty-card">
                        <div className="explore-empty-badge">
                            <span className="mission-badge-dot" />
                            <span>MISSION HUB</span>
                        </div>
                        <div className="explore-empty-icon-wrap">
                            <Compass size={32} />
                        </div>
                        <h2 className="explore-empty-title">Start a New Exploration</h2>
                        <p className="explore-empty-desc">
                            Explore near-Earth asteroids, recent solar flares, deep-space imaging, and NASA archives.
                        </p>
                        
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (emptyPrompt.trim() && !activeCreation.inFlight) {
                                    navigate('/explore', { state: { initialPrompt: emptyPrompt.trim() } });
                                }
                            }}
                            style={{ width: '100%', maxWidth: '520px', display: 'flex', gap: '8px', margin: '16px 0 8px' }}
                        >
                            <input
                                type="text"
                                placeholder="e.g. Near-Earth asteroids approaching this week..."
                                value={emptyPrompt}
                                onChange={(e) => setEmptyPrompt(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '10px 14px',
                                    borderRadius: 'var(--radius)',
                                    background: 'var(--surface-2)',
                                    border: '1px solid var(--border-2)',
                                    color: 'var(--text-1)',
                                    fontSize: '0.88rem',
                                    outline: 'none'
                                }}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!emptyPrompt.trim() || activeCreation.inFlight}
                                style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Sparkles size={14} /> Explore
                            </button>
                        </form>

                        <div className="explore-empty-actions" style={{ marginTop: '10px' }}>
                            <button className="btn btn-ghost" onClick={() => navigate('/explorations')}>
                                <Layers size={14} /> Browse All Explorations
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleCreateInteraction = async (type: InteractionType, text?: string) => {
        if (!plan) return;
        const submitPrompt = text || prompt;
        if (!submitPrompt.trim()) return;

        justSubmittedRef.current = true;
        setLocalIsCreatingInteraction(true);
        setFollowUpError(null);
        if (!prompt) {
            setPrompt(submitPrompt);
        }

        // Collapse dock upon submission unless the user chose to keep it open in Settings
        const keepOpen = localStorage.getItem('spacescout_keep_continue_open') === 'true';
        if (!keepOpen) {
            setContinueExpanded(false);
        }

        // Immediately scroll to bottom so the user sees the active mission stream
        setTimeout(() => {
            streamEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 50);

        try {
            const newInteraction = await createPlanInteraction(plan.id, {
                user_prompt: submitPrompt,
                interaction_type: type
            });
            if (!isMountedRef.current) return;

            let updatedPlan = await getPlanById(plan.id);
            // Defensively ensure that if the in-memory plan is missing newly added discoveries, force a fresh fetch
            const newDiscoveryIds = newInteraction.added_discoveries || [];
            const hasMissingDiscoveries = newDiscoveryIds.some(
                addId => !updatedPlan.discoveries?.some(d => d.id === addId)
            );
            if (hasMissingDiscoveries) {
                updatedPlan = await getPlanById(plan.id, true);
            }

            if (!isMountedRef.current) return;
            setPlan(updatedPlan);
            setInteractions(prev => {
                const exists = prev.some(i => i.id === newInteraction.id);
                return exists ? prev : [...prev, newInteraction];
            });
            setPrompt("");
            setFollowUpError(null);
        } catch (err: unknown) {
            if (!isMountedRef.current) return;
            console.error("Failed to create interaction", err);
            const errorObj = err as {
                response?: { status?: number };
                message?: string;
                code?: string;
            };

            let userMessage = "Unable to process follow-up exploration. Please try again.";

            if (errorObj.code === 'ERR_NETWORK' || errorObj.message?.includes('Network Error')) {
                userMessage = "Network error: unable to reach the space intelligence service. Please check your connection and try again.";
            } else if (errorObj.code === 'ECONNABORTED' || errorObj.message?.toLowerCase().includes('timeout')) {
                userMessage = "Request timed out while analyzing mission parameters. Please try again.";
            } else if (errorObj.response?.status === 400) {
                userMessage = "Invalid exploration request. Please refine your question and try again.";
            } else if (errorObj.response?.status === 401) {
                userMessage = "Your session has expired. Please sign in again.";
            } else if (errorObj.response?.status === 404) {
                userMessage = "The active exploration could not be found.";
            } else if (errorObj.response?.status === 429) {
                userMessage = "Too many exploration requests. Please wait a moment before trying again.";
            } else if (errorObj.response?.status && errorObj.response.status >= 500) {
                userMessage = "Space intelligence service is temporarily unavailable. Please try again later.";
            }

            setFollowUpError(userMessage);
        } finally {
            if (isMountedRef.current) {
                setLocalIsCreatingInteraction(false);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCreateInteraction('other');
        }
    };

    const discoveries = plan.discoveries || [];

    const followUpDiscoveryIds = new Set<number>();
    if (Array.isArray(interactions)) {
        interactions.forEach(interaction => {
            if (Array.isArray(interaction?.added_discoveries)) {
                interaction.added_discoveries.forEach(id => followUpDiscoveryIds.add(id));
            }
        });
    }
    
    const initialDiscoveries = discoveries.filter(d => d && !followUpDiscoveryIds.has(d.id));
    const followUpDiscoveries = discoveries.filter(d => d && followUpDiscoveryIds.has(d.id));
    
    const sources = [...new Set(discoveries.map(d => d?.source).filter(Boolean))];

    return (
        <div className="explore-layout">
            {/* Exploration Header */}
            <div className="exp-header">
                <div className="exp-header__row1">
                    <h1 className="exp-header__title">{plan.title || "Untitled Exploration"}</h1>
                </div>

                {plan.summary && (
                    <div className="exp-header__summary">{plan.summary}</div>
                )}

                <div className="exp-header__prompt-used">
                    <Compass size={14} />
                    <span>"{plan.prompt}"</span>
                </div>

                <div className="exp-header__row2">
                    <div className="exp-stat">
                        <Layers size={14} />
                        <strong>{discoveries.length}</strong> discoveries
                    </div>
                    {sources.length > 0 && (
                        <div className="exp-stat">
                            <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                    {interactions.length > 0 && (
                        <div className="exp-stat">
                            <MessageSquare size={14} />
                            <strong>{interactions.length}</strong> interaction{interactions.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>

            {/* Scroll area: discoveries + interactions */}
            <div className="scroll-area">
                {initialDiscoveries.length > 0 && (
                    <>
                        <div className="feed-label">
                            <span className="feed-label__text">Initial Discoveries</span>
                            <span className="feed-label__line"></span>
                            <span className="feed-label__count">{initialDiscoveries.length}</span>
                        </div>

                        <div className="discovery-grid">
                            {initialDiscoveries.map((discovery: Discovery) => (
                                <DiscoveryCard key={discovery.id} discovery={discovery} />
                            ))}
                        </div>
                    </>
                )}

                {followUpDiscoveries.length > 0 && (
                    <div id="follow-up-discoveries-section">
                        <div className="feed-label" style={{ marginTop: '24px' }}>
                            <span className="feed-label__text">Follow-up Discoveries</span>
                            <span className="feed-label__line"></span>
                            <span className="feed-label__count">{followUpDiscoveries.length}</span>
                        </div>

                        <div className="discovery-grid">
                            {followUpDiscoveries.map((discovery: Discovery) => (
                                <DiscoveryCard key={discovery.id} discovery={discovery} />
                            ))}
                        </div>
                        <div id="follow-up-discoveries-bottom" style={{ height: '1px', width: '100%' }} />
                    </div>
                )}

                {discoveries.length === 0 && interactions.length === 0 && (
                    <div style={{ color: 'var(--text-3)', textAlign: 'center', marginTop: '40px', fontSize: '0.9rem' }}>
                        No discoveries yet.
                    </div>
                )}

                {/* Interaction stream */}
                <div style={{ width: '100%' }}>
                    <InteractionStream interactions={interactions} />
                    
                    {isCreatingInteraction && (
                        <div className="interaction-stream" style={{ marginTop: interactions.length > 0 ? '12px' : '8px' }}>
                            {interactions.length === 0 && (
                                <div className="feed-label">
                                    <span className="feed-label__text">Follow-up interactions</span>
                                    <span className="feed-label__line"></span>
                                    <span className="feed-label__count">1</span>
                                </div>
                            )}
                            <div className="interaction-item">
                                <div className="interaction-item__context">
                                    <div className="interaction-item__label">
                                        <MessageSquare size={14} />
                                        <span className="interaction-item__type">Follow-up</span>
                                    </div>
                                    <div className="interaction-item__prompt">{activeInteractionPrompt || prompt || "Generating..."}</div>
                                </div>
                                <div className="result-card">
                                    <div className="result-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-2)' }}>
                                        <Loader2 size={16} className="spinner" /> Analyzing context...
                                    </div>
                                    <div style={{ marginTop: '16px' }}>
                                        <div style={{ width: '100%', height: '14px', background: 'var(--surface-3)', borderRadius: '4px', marginBottom: '8px', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
                                        <div style={{ width: '85%', height: '14px', background: 'var(--surface-3)', borderRadius: '4px', marginBottom: '8px', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
                                        <div style={{ width: '90%', height: '14px', background: 'var(--surface-3)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {followUpError && (
                        <div className="interaction-stream" style={{ marginTop: '12px' }}>
                            <div className="interaction-item">
                                <div className="interaction-item__context">
                                    <div className="interaction-item__label">
                                        <MessageSquare size={14} />
                                        <span className="interaction-item__type">Follow-up</span>
                                    </div>
                                    <div className="interaction-item__prompt">{prompt || "Follow-up query"}</div>
                                </div>
                                <div className="result-card" style={{ borderColor: 'var(--red)', background: 'var(--red-dim)' }}>
                                    <div className="result-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)' }}>
                                        <AlertCircle size={16} /> Exploration follow-up failed
                                    </div>
                                    <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: 'var(--text-2)', lineHeight: '1.5' }}>
                                        {followUpError}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom anchor for scrolling */}
                <div ref={streamEndRef} style={{ height: '1px', width: '100%' }} />
            </div>

            {/* Sticky Floating Continue Dock */}
            <div className="continue-dock-wrapper" ref={dockRef}>
                <div className={`continue-dock ${continueExpanded ? 'expanded' : ''}`}>
                    {/* Upper Drawer: Suggestion Chips (Visible when expanded) */}
                    <div className="continue-dock__drawer">
                        <div className="continue-dock__drawer-header">
                            <span className="continue-dock__drawer-title">
                                <Sparkles size={13} color="var(--blue)" />
                                Suggested follow-ups
                            </span>
                            <button
                                type="button"
                                className="continue-dock__close-btn"
                                onClick={() => setContinueExpanded(false)}
                                title="Collapse (Esc)"
                            >
                                <ChevronDown size={14} />
                            </button>
                        </div>
                        <div className="chips continue-dock__chips">
                            {dynamicChips.map((chipText, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    className="chip chip-action"
                                    onClick={() => setPrompt(chipText)}
                                    disabled={isCreatingInteraction}
                                >
                                    {chipText}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Follow-up Error Banner */}
                    {followUpError && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px',
                                padding: '8px 16px',
                                background: 'var(--red-dim, rgba(239, 68, 68, 0.12))',
                                color: 'var(--red, #ef4444)',
                                borderBottom: '1px solid var(--border-2)',
                                fontSize: '0.82rem',
                                fontWeight: 500
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{followUpError}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <button
                                    type="button"
                                    onClick={() => handleCreateInteraction('other')}
                                    disabled={isCreatingInteraction || !prompt.trim()}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--red, #ef4444)',
                                        color: 'var(--red, #ef4444)',
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-sm, 4px)',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontWeight: 600
                                    }}
                                >
                                    <RefreshCw size={11} />
                                    <span>Retry</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFollowUpError(null)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'inherit',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        opacity: 0.8
                                    }}
                                    title="Dismiss"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Lower Dock Bar: Input + Actions */}
                    <div className="continue-dock__bar">
                        <button
                            type="button"
                            className="continue-dock__toggle-btn"
                            onClick={() => setContinueExpanded(prev => !prev)}
                            title={continueExpanded ? "Collapse suggestions" : "Show suggestions"}
                        >
                            <Sparkles size={14} className="continue-dock__toggle-icon" />
                            <ChevronUp 
                                size={14} 
                                className={`continue-dock__chevron ${continueExpanded ? 'rotated' : ''}`} 
                            />
                        </button>

                        <div className="continue-dock__input-wrap">
                            <input
                                type="text"
                                className="continue-dock__input"
                                placeholder="Continue mission: ask a follow-up or explore next..."
                                value={prompt}
                                onChange={(e) => {
                                    setPrompt(e.target.value);
                                    if (followUpError) setFollowUpError(null);
                                }}
                                onFocus={() => setContinueExpanded(true)}
                                onKeyDown={handleKeyDown}
                                disabled={isCreatingInteraction}
                            />
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary continue-dock__submit-btn"
                            onClick={() => handleCreateInteraction('other')}
                            disabled={isCreatingInteraction || !prompt.trim()}
                        >
                            {isCreatingInteraction ? (
                                <Loader2 size={15} className="spinner" />
                            ) : (
                                <>
                                    <span>Explore</span>
                                    <Send size={13} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


/**
 * Discovery card following the mockup's card structure.
 * Full implementation: Expandable, displays facts, full summary, media, etc.
 */
function DiscoveryCard({ discovery }: { discovery: Discovery }) {
    const [expanded, setExpanded] = useState(false);

    const isNeo = discovery.type === 'neo' || discovery.source === 'neows';
    const isApod = discovery.source === 'apod' || discovery.type === 'apod';
    const isDonki = discovery.source === 'donki' || discovery.type === 'solar_flare';
    const isNasaImages = discovery.source === 'nasa_images';
    const isEpic = discovery.source === 'epic';

    const typeClass = isNeo
        ? 'type-neo'
        : isApod
        ? 'type-apod'
        : isDonki
        ? 'type-donki'
        : isNasaImages
        ? 'type-nasa-images'
        : isEpic
        ? 'type-epic'
        : 'type-general';

    const typeModifier = isNeo
        ? 'neo'
        : isApod
        ? 'apod'
        : isDonki
        ? 'donki'
        : isNasaImages
        ? 'nasa-images'
        : isEpic
        ? 'epic'
        : 'general';

    const typeLabel = isNeo
        ? 'Near-Earth Object'
        : isApod
        ? 'Astronomy Picture'
        : isDonki
        ? 'Space Weather'
        : isNasaImages
        ? 'NASA Media Archive'
        : isEpic
        ? 'Earth from DSCOVR'
        : discovery.type || 'Discovery';

    const renderTypeIcon = () => {
        if (isNeo) {
            return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
        }
        if (isApod) {
            return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
        }
        if (isDonki) {
            return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>;
        }
        if (isNasaImages) {
            return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
        }
        if (isEpic) {
            return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>;
        }
        return null;
    };

    const primaryMedia = discovery.media?.find(m => m.is_primary) || discovery.media?.[0];

    return (
        <div className={`card ${typeClass} ${expanded ? 'expanded' : ''}`}>
            <div className="card__head" onClick={() => setExpanded(!expanded)}>
                <div className="card__type-row">
                    <span className={`card__type ${typeModifier}`}>
                        {renderTypeIcon()}
                        {typeLabel}
                    </span>
                    {discovery.date && (
                        <span className="card__date">{discovery.date}</span>
                    )}
                </div>
                <div className="card__title">{discovery.title}</div>
                {discovery.summary && !expanded && (
                    <div className="card__summary-short">{discovery.summary}</div>
                )}
                <div className="card__view-action">
                    {expanded ? 'Collapse' : 'View details'}
                </div>
            </div>

            <div className="card__body">
                <div className="card__body-inner">
                    {primaryMedia && (
                        <MediaViewer
                            url={primaryMedia.url}
                            mediaType={primaryMedia.media_type}
                            title={discovery.title}
                            caption={primaryMedia.caption || discovery.title}
                            sourceUrl={discovery.source_url}
                        />
                    )}

                    {discovery.facts && typeof discovery.facts === 'object' && Object.keys(discovery.facts).length > 0 && (
                        <div className="card__facts">
                            {Object.entries(discovery.facts).map(([key, value]) => (
                                <div className="card__fact" key={key}>
                                    <span className="card__fact-label">{key}</span>
                                    <span className="card__fact-value">{String(value)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {discovery.summary && (
                        <div className="card__full-summary">{discovery.summary}</div>
                    )}

                    {discovery.why_interesting && (
                        <div className="card__why">
                            <div className="card__why-label">Why it's interesting</div>
                            <div className="card__why-text">{discovery.why_interesting}</div>
                        </div>
                    )}

                    <div className="card__footer-actions" style={{ marginTop: '16px' }}>
                        <a href={discovery.source_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: 0 }}>
                            View Original Source
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
