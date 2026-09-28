import { useState, useEffect } from 'react';
import { Search, Compass, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createSpacePlan, getSpacePlans } from '../api/planner';
import type { SpacePlan } from '../types/planner';

export default function Home() {
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentPlans, setRecentPlans] = useState<SpacePlan[]>([]);
    const [isLoadingRecent, setIsLoadingRecent] = useState(true);

    useEffect(() => {
        const fetchRecent = async () => {
            try {
                const plans = await getSpacePlans();
                setRecentPlans(plans.slice(0, 3));
            } catch (err) {
                console.error("Failed to load recent plans", err);
            } finally {
                setIsLoadingRecent(false);
            }
        };
        fetchRecent();
    }, []);

    const handleExplore = async (text: string = prompt) => {
        if (!text.trim() || isCreating) return;
        
        setIsCreating(true);
        setError(null);
        
        try {
            const plan = await createSpacePlan(text);
            navigate(`/explore/${plan.id}`);
        } catch (err: unknown) {
            console.error("Exploration failed", err);
            const errorObj = err as { response?: { data?: { detail?: string } } };
            setError(errorObj.response?.data?.detail || "Failed to create exploration. Please try again.");
            setIsCreating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleExplore();
        }
    };

    return (
        <div className="home-page">
            <div className="home-page__eyebrow">NASA-BACKED SPACE EXPLORATION</div>
            <h1 className="home-page__title">What are you curious about today?</h1>
            
            <div className="home-start-box">
                <div className="home-start-box__row">
                    <Search size={20} color="var(--text-3)" />
                    <input 
                        type="text" 
                        className="home-start-box__input" 
                        placeholder="e.g. What asteroids are approaching Earth this year?" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isCreating}
                    />
                    <button 
                        className="btn btn-primary" 
                        style={{ padding: '8px 18px', borderRadius: '99px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleExplore()}
                        disabled={isCreating || !prompt.trim()}
                    >
                        {isCreating ? <Loader2 size={16} className="spinner" /> : null}
                        {isCreating ? "Exploring..." : "Explore"}
                    </button>
                </div>
                {error && <div style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '8px', textAlign: 'left' }}>{error}</div>}
            </div>

            <div className="home-prompts">
                <div className="home-prompt" onClick={() => handleExplore("Near-Earth asteroids")}>Near-Earth asteroids</div>
                <div className="home-prompt" onClick={() => handleExplore("Solar flares")}>Solar flares</div>
                <div className="home-prompt" onClick={() => handleExplore("Today's APOD")}>Today's APOD</div>
                <div className="home-prompt" onClick={() => handleExplore("Exoplanets")}>Exoplanets</div>
            </div>

            <div className="home-recent">
                <div className="home-recent__label">RECENT EXPLORATIONS</div>
                {isLoadingRecent ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', textAlign: 'left', marginTop: '10px' }}>Loading recent...</div>
                ) : recentPlans.length > 0 ? (
                    <div className="home-recent__items">
                        {recentPlans.map(plan => (
                            <div key={plan.id} className="home-recent__item" onClick={() => navigate(`/explore/${plan.id}`)}>
                                <div className="home-recent__item-icon">
                                    <Compass size={16} />
                                </div>
                                <div className="home-recent__item-title">{plan.title || "Untitled Exploration"}</div>
                                <div className="home-recent__item-count">{plan.discoveries?.length || 0} discoveries</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', textAlign: 'left', marginTop: '10px' }}>No recent explorations.</div>
                )}
            </div>
        </div>
    );
}
