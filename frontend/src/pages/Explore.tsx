import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
    Compass, Layers, MessageSquare, Loader2,
    Sparkles, Orbit, CheckCircle2, AlertCircle, RefreshCw,
    ChevronUp, ChevronDown, Send
} from 'lucide-react';
import { getSpacePlan, createSpacePlan, createInteraction } from '../api/planner';
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
        addPlan,
        addInteractionToCache,
    } = usePlans();

    const navState = location.state as { initialPrompt?: string; startFresh?: boolean } | null;
    const initialPrompt = navState?.initialPrompt;
    const startFresh = navState?.startFresh;

    const [plan, setPlan] = useState<SpacePlan | null>(null);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [isLoading, setIsLoading] = useState(!startFresh);
    const [isCreatingNew, setIsCreatingNew] = useState(Boolean(initialPrompt));
    const [creationPrompt, setCreationPrompt] = useState(initialPrompt || "");
    const [creationStep, setCreationStep] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [continueExpanded, setContinueExpanded] = useState(() => {
        return localStorage.getItem('spacescout_keep_continue_open') === 'true';
    });
    const [prompt, setPrompt] = useState("");
    const [emptyPrompt, setEmptyPrompt] = useState("");
    const [isCreatingInteraction, setIsCreatingInteraction] = useState(false);

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

    // Progressive animation for creation steps
    useEffect(() => {
        if (!isCreatingNew) return;
        setCreationStep(0);
        const timer1 = setTimeout(() => setCreationStep(1), 1600);
        const timer2 = setTimeout(() => setCreationStep(2), 3400);
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [isCreatingNew]);

    // Handle explicit startFresh request from sidebar "+ New" button
    useEffect(() => {
        if (!startFresh) return;
        localStorage.removeItem('active_exploration_id');
        loadedPlanIdRef.current = null;
        setPlan(null);
        setInteractions([]);
        setIsLoading(false);
        setIsCreatingNew(false);
        setError(null);
    }, [startFresh]);

    // Creation flow when initialPrompt is provided via navigation
    useEffect(() => {
        if (!initialPrompt) return;
        if (creationStartedRef.current === initialPrompt) return;
        creationStartedRef.current = initialPrompt;

        const runCreate = async () => {
            setCreationPrompt(initialPrompt);
            setIsCreatingNew(true);
            setIsLoading(true);
            setError(null);
            try {
                const newPlan = await createSpacePlan(initialPrompt);
                if (!isMountedRef.current) return;

                localStorage.setItem('active_exploration_id', String(newPlan.id));
                addPlan(newPlan);
                loadedPlanIdRef.current = newPlan.id;
                setPlan(newPlan);
                setInteractions([]);
                setIsCreatingNew(false);
                setIsLoading(false);
                window.dispatchEvent(new CustomEvent('spacescout:plans_updated'));
                navigate(`/explore/${newPlan.id}`, { replace: true, state: {} });
            } catch (err: unknown) {
                if (!isMountedRef.current) return;
                console.error("Failed to create exploration", err);
                const errorObj = err as { response?: { data?: { detail?: string } } };
                setError(errorObj.response?.data?.detail || "Failed to create exploration. Please try again.");
                setIsCreatingNew(false);
                setIsLoading(false);
            }
        };

        runCreate();
    }, [initialPrompt, navigate, addPlan]);

    // Loading existing plan or handling resumption when no prompt is provided
    useEffect(() => {
        if (initialPrompt || startFresh) return;

        const loadOrResume = async () => {
            // If already loaded in state, keep it without refetching
            if (id && loadedPlanIdRef.current === parseInt(id, 10)) {
                setIsLoading(false);
                setIsCreatingNew(false);
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
    }, [id, initialPrompt, startFresh, navigate, plans, isPlansLoading, getPlanById, getInteractionsForPlan]);

    const handleRetryCreation = async () => {
        if (!creationPrompt.trim()) return;
        setIsCreatingNew(true);
        setIsLoading(true);
        setError(null);
        setCreationStep(0);
        try {
            const newPlan = await createSpacePlan(creationPrompt);
            localStorage.setItem('active_exploration_id', String(newPlan.id));
            addPlan(newPlan);
            loadedPlanIdRef.current = newPlan.id;
            setPlan(newPlan);
            setInteractions([]);
            setIsCreatingNew(false);
            setIsLoading(false);
            window.dispatchEvent(new CustomEvent('spacescout:plans_updated'));
            navigate(`/explore/${newPlan.id}`, { replace: true, state: {} });
        } catch (err: unknown) {
            console.error("Failed to create exploration on retry", err);
            const errorObj = err as { response?: { data?: { detail?: string } } };
            setError(errorObj.response?.data?.detail || "Failed to create exploration. Please try again.");
            setIsCreatingNew(false);
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
    if (error) {
        return (
            <div className="explore-layout">
                <div className="explore-empty-wrap">
                    <div className="explore-empty-card error">
                        <div className="explore-empty-badge error">
                            <AlertCircle size={13} />
                            <span>MISSION FAILED</span>
                        </div>
                        <div className="explore-empty-icon-wrap error">
                            <AlertCircle size={28} />
                        </div>
                        <h2 className="explore-empty-title">Exploration Failed</h2>
                        <p className="explore-empty-desc">
                            {error || "An unexpected error occurred while analyzing the cosmos."}
                        </p>
                        <div className="explore-empty-actions">
                            {creationPrompt ? (
                                <button className="btn btn-primary" onClick={handleRetryCreation}>
                                    <RefreshCw size={15} /> Try Again
                                </button>
                            ) : (
                                <button className="btn btn-primary" onClick={() => navigate('/')}>
                                    <Compass size={15} /> Start Mission on Home
                                </button>
                            )}
                            <button className="btn btn-secondary" onClick={() => navigate('/explorations')}>
                                <Layers size={15} /> Browse Archive
                            </button>
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
                                if (emptyPrompt.trim()) {
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
                                disabled={!emptyPrompt.trim()}
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
        setIsCreatingInteraction(true);
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
            const newInteraction = await createInteraction(plan.id, {
                user_prompt: submitPrompt,
                interaction_type: type
            });
            // Re-fetch the space plan to instantly load any newly created discoveries
            const updatedPlan = await getSpacePlan(plan.id);
            setPlan(updatedPlan);
            setInteractions(prev => [...prev, newInteraction]);
            addInteractionToCache(plan.id, newInteraction, updatedPlan);
            window.dispatchEvent(new CustomEvent('spacescout:plans_updated'));
            
            setPrompt("");
        } catch (err) {
            console.error("Failed to create interaction", err);
            // Ideally we'd show a toast here, but for now we just log it.
        } finally {
            setIsCreatingInteraction(false);
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
                                    <div className="interaction-item__prompt">{prompt || "Generating..."}</div>
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
                                onChange={(e) => setPrompt(e.target.value)}
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
