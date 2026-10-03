import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Compass, Layers, MessageSquare, Loader2 } from 'lucide-react';
import { getSpacePlan, getInteractions } from '../api/planner';
import type { SpacePlan, Interaction, Discovery } from '../types/planner';
import InteractionStream from '../components/explore/InteractionStream';

export default function Explore() {
    const { id } = useParams<{ id: string }>();
    const [plan, setPlan] = useState<SpacePlan | null>(null);
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [continueExpanded, setContinueExpanded] = useState(false);

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

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '0.9rem' }}>
                    {error || "Exploration not found."}
                </div>
            </div>
        );
    }

    const discoveries = plan.discoveries || [];
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
                {discoveries.length > 0 && (
                    <>
                        <div className="feed-label">
                            <span className="feed-label__text">Discoveries</span>
                            <span className="feed-label__line"></span>
                            <span className="feed-label__count">{discoveries.length}</span>
                        </div>

                        {discoveries.map((discovery: Discovery) => (
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
                            <button className="chip chip-action">Find more like these</button>
                            <button className="chip chip-action">All hazardous objects</button>
                            <button className="chip chip-action">More on 2024 YR4</button>
                            <button className="chip chip-action">Deep dive on Bennu</button>
                        </div>
                        <div className="continue-input-row" style={{ display: 'flex', gap: '8px' }}>
                            <input type="text" className="continue-input" placeholder="What would you like to explore next?" style={{ flex: 1 }} />
                            <button className="btn-explore" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.35-4.35" />
                                </svg>
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

    const typeClass = discovery.type === 'neo' || discovery.source === 'neows'
        ? 'type-neo'
        : discovery.source === 'apod'
        ? 'type-image'
        : '';

    const typeLabel = discovery.source === 'neows'
        ? 'Near-Earth Object'
        : discovery.source === 'apod'
        ? 'Astronomy Picture'
        : discovery.source === 'donki'
        ? 'Space Weather'
        : discovery.type || 'Discovery';

    const primaryMedia = discovery.media?.find(m => m.is_primary) || discovery.media?.[0];

    return (
        <div className={`card ${typeClass} ${expanded ? 'expanded' : ''}`}>
            <div className="card__head" onClick={() => setExpanded(!expanded)}>
                <div className="card__type-row">
                    <span className={`card__type ${discovery.source === 'neows' ? 'neo' : discovery.source === 'apod' ? 'image' : ''}`}>
                        {discovery.source === 'neows' ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        ) : discovery.source === 'apod' ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                        ) : null}
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
                        <div className="card__media">
                            {primaryMedia.media_type === 'image' ? (
                                <img src={primaryMedia.url} alt={primaryMedia.caption || discovery.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <video src={primaryMedia.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                            {primaryMedia.caption && (
                                <div className="card__media-caption">{primaryMedia.caption}</div>
                            )}
                        </div>
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
