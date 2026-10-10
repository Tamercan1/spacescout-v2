import { useState, useEffect, useRef } from 'react';
import { Search, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSpacePlans } from '../api/planner';
import type { SpacePlan } from '../types/planner';

export default function Home() {
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [recentPlans, setRecentPlans] = useState<SpacePlan[]>([]);
    const [isLoadingRecent, setIsLoadingRecent] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

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

    const handleExplore = (text: string = prompt) => {
        const query = text.trim();
        if (!query || isSubmitting) return;
        
        setIsSubmitting(true);
        navigate('/explore', { state: { initialPrompt: query } });
    };

    const handleSelectPrompt = (suggestedText: string) => {
        setPrompt(suggestedText);
        if (inputRef.current) {
            inputRef.current.focus();
            // Place cursor at the end of the text
            const len = suggestedText.length;
            inputRef.current.setSelectionRange(len, len);
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
                        ref={inputRef}
                        type="text" 
                        className="home-start-box__input" 
                        placeholder="e.g. What asteroids are approaching Earth this year?" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button 
                        className="btn btn-primary" 
                        style={{ padding: '8px 18px', borderRadius: '99px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleExplore()}
                        disabled={!prompt.trim() || isSubmitting}
                    >
                        Explore
                    </button>
                </div>
            </div>

            <div className="home-prompts">
                <div className="home-prompt" onClick={() => handleSelectPrompt("Near-Earth asteroids")}>Near-Earth asteroids</div>
                <div className="home-prompt" onClick={() => handleSelectPrompt("Solar flares")}>Solar flares</div>
                <div className="home-prompt" onClick={() => handleSelectPrompt("Today's APOD")}>Today's APOD</div>
                <div className="home-prompt" onClick={() => handleSelectPrompt("Exoplanets")}>Exoplanets</div>
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
                                <div className="home-recent__item-content">
                                    <div className="home-recent__item-title">{plan.title || "Untitled Exploration"}</div>
                                    <div className="home-recent__item-count">{plan.discoveries?.length || 0} discoveries</div>
                                </div>
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
