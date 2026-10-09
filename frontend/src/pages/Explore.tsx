import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Compass, Layers, MessageSquare, Loader2 } from 'lucide-react';
import { getSpacePlan, getInteractions, createInteraction } from '../api/planner';
import type { SpacePlan, Interaction, Discovery, InteractionType } from '../types/planner';
import InteractionStream from '../components/explore/InteractionStream';
import MediaViewer from '../components/common/MediaViewer';

export default function Explore() {
    const { id } = useParams<{ id: string }>();
    const [plan, setPlan] = useState<SpacePlan | null>(null);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [continueExpanded, setContinueExpanded] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [isCreatingInteraction, setIsCreatingInteraction] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const loadData = async () => {
            if (!id) return;
            try {
                setIsLoading(true);
                const planId = parseInt(id, 10);
                const [planData, interactionData] = await Promise.all([
                    getSpacePlan(planId),
                    getInteractions(planId),
                ]);
                setPlan(planData);
                setInteractions(interactionData);
            } catch (err) {
                console.error("Failed to load exploration", err);
                setError("Failed to load exploration.");
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [id]);

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

    if (error || !plan) {
        return (
            <div className="explore-layout">
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--text-3)', fontSize: '0.9rem' }}>
                    <div>{error || "Exploration not found."}</div>
                    <button className="btn btn-ghost" onClick={() => navigate('/explorations')}>
                        Back to Explorations
                    </button>
                </div>
            </div>
        );
    }

    const handleCreateInteraction = async (type: InteractionType, text?: string) => {
        if (!plan) return;
        const submitPrompt = text || prompt;
        if (!submitPrompt.trim()) return;

        setIsCreatingInteraction(true);
        try {
            const newInteraction = await createInteraction(plan.id, {
                user_prompt: submitPrompt,
                interaction_type: type
            });
            setInteractions(prev => [...prev, newInteraction]);
            
            // Re-fetch the space plan to instantly load any newly created discoveries
            const updatedPlan = await getSpacePlan(plan.id);
            setPlan(updatedPlan);
            
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
    interactions.forEach(interaction => {
        if (interaction.added_discoveries) {
            interaction.added_discoveries.forEach(id => followUpDiscoveryIds.add(id));
        }
    });
    
    const initialDiscoveries = discoveries.filter(d => !followUpDiscoveryIds.has(d.id));
    const followUpDiscoveries = discoveries.filter(d => followUpDiscoveryIds.has(d.id));
    
    const sources = [...new Set(discoveries.map(d => d.source))];

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

                        {initialDiscoveries.map((discovery: Discovery) => (
                            <DiscoveryCard key={discovery.id} discovery={discovery} />
                        ))}
                    </>
                )}

                {followUpDiscoveries.length > 0 && (
                    <>
                        <div className="feed-label" style={{ marginTop: '24px' }}>
                            <span className="feed-label__text">Follow-up Discoveries</span>
                            <span className="feed-label__line"></span>
                            <span className="feed-label__count">{followUpDiscoveries.length}</span>
                        </div>

                        {followUpDiscoveries.map((discovery: Discovery) => (
                            <DiscoveryCard key={discovery.id} discovery={discovery} />
                        ))}
                    </>
                )}

                {discoveries.length === 0 && interactions.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', color: 'var(--text-3)', textAlign: 'center', marginTop: '40px', fontSize: '0.9rem' }}>
                        No discoveries yet.
                    </div>
                )}

                {/* Interaction stream */}
                <div style={{ gridColumn: '1 / -1' }}>
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
            </div>

            {/* Continue pane */}
            <div className={`continue-pane ${continueExpanded ? 'expanded' : ''}`}>
                <div className="continue-pane__bar" onClick={() => setContinueExpanded(!continueExpanded)}>
                    <span className="continue-pane__bar-label">Continue this exploration</span>
                    <svg className="continue-pane__chevron" width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: continueExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </div>
                <div className="continue-pane__body" style={{ display: continueExpanded ? 'block' : 'none' }}>
                    <div className="continue-pane__inner">
                        <div className="chips">
                            <button className="chip chip-action" onClick={() => setPrompt('Find more like these')} disabled={isCreatingInteraction}>Find more like these</button>
                            <button className="chip chip-action" onClick={() => setPrompt('All hazardous objects')} disabled={isCreatingInteraction}>All hazardous objects</button>
                            <button className="chip chip-action" onClick={() => setPrompt('More on 2024 YR4')} disabled={isCreatingInteraction}>More on 2024 YR4</button>
                            <button className="chip chip-action" onClick={() => setPrompt('Deep dive on Bennu')} disabled={isCreatingInteraction}>Deep dive on Bennu</button>
                        </div>
                        <div className="continue-input-row" style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="text" 
                                className="continue-input" 
                                placeholder="What would you like to explore next?" 
                                style={{ flex: 1 }} 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isCreatingInteraction}
                            />
                            <button 
                                className="btn-explore" 
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                onClick={() => handleCreateInteraction('other')}
                                disabled={isCreatingInteraction || !prompt.trim()}
                            >
                                {isCreatingInteraction ? <Loader2 size={15} className="spinner" /> : (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.35-4.35" />
                                    </svg>
                                )}
                                Explore
                            </button>
                        </div>
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
