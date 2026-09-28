import { useState, useEffect } from 'react';
import { Clock, RotateCcw, Plus, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSpacePlans, updateSpacePlan } from '../api/planner';
import type { SpacePlan } from '../types/planner';

export default function Explorations() {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<SpacePlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPlans = async () => {
        try {
            setIsLoading(true);
            const data = await getSpacePlans();
            setPlans(data);
        } catch (err) {
            console.error(err);
            setError("Failed to load explorations.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchPlans();
    }, []);

    const toggleArchive = async (e: React.MouseEvent, plan: SpacePlan) => {
        e.stopPropagation();
        try {
            const updated = await updateSpacePlan(plan.id, { is_archived: !plan.is_archived });
            setPlans(prev => prev.map(p => p.id === plan.id ? updated : p));
        } catch (err) {
            console.error("Failed to update archive status", err);
        }
    };

    return (
        <div className="exps-page">
            <div className="exps-page__header">
                <div>
                    <h1 className="exps-page__title">Your Explorations</h1>
                    <div className="exps-page__sub">
                        {isLoading ? "Loading explorations..." : `${plans.length} exploration${plans.length === 1 ? '' : 's'} - pick one to continue or start something new`}
                    </div>
                </div>
                <button 
                    className="btn btn-primary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
                    onClick={() => navigate('/home')}
                >
                    <Plus size={16} /> New exploration
                </button>
            </div>
            
            <div className="exps-scroll">
                {error && <div style={{ color: 'var(--red)', padding: '10px 0' }}>{error}</div>}
                
                {!isLoading && plans.length === 0 && !error && (
                    <div style={{ color: 'var(--text-3)', padding: '20px 0', textAlign: 'center', fontSize: '0.9rem' }}>
                        You don't have any explorations yet. Start exploring to see them here!
                    </div>
                )}

                {plans.map((plan, index) => {
                    const discoveryCount = plan.discoveries?.length || 0;
                    
                    return (
                        <div key={plan.id} className="exp-row" onClick={() => navigate(`/explore/${plan.id}`)}>
                            <div className="exp-row__icon">
                                {plan.is_archived ? <Archive size={16} /> : <Clock size={16} />}
                            </div>
                            <div className="exp-row__body">
                                <div className="exp-row__title" style={{ color: plan.is_archived ? 'var(--text-3)' : 'var(--text-1)' }}>
                                    {plan.title || "Untitled Exploration"}
                                </div>
                                <div className="exp-row__meta">
                                    <span>{discoveryCount} discoveries</span>
                                    <span>{plan.created_at ? new Date(plan.created_at).toLocaleDateString() : 'Unknown date'}</span>
                                </div>
                            </div>
                            <div className="exp-row__right">
                                {!plan.is_archived && index === 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></div>
                                        Active
                                    </div>
                                )}
                                {plan.is_archived && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', color: 'var(--text-3)', padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500 }}>
                                        Archived
                                    </div>
                                )}
                                <div className="exp-row__actions">
                                    <button 
                                        className="btn btn-ghost" 
                                        style={{ padding: '6px', color: 'var(--text-2)' }} 
                                        title={plan.is_archived ? "Resume exploration" : "Archive exploration"}
                                        onClick={(e) => toggleArchive(e, plan)}
                                    >
                                        {plan.is_archived ? <RotateCcw size={16} /> : <Archive size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
