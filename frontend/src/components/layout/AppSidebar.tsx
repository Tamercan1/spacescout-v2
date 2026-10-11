import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Trash2, Compass, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { usePlans } from '../../context/PlansContext';
import type { SpacePlan } from '../../types/planner';

interface AppSidebarProps {
    isOpen: boolean;
    closeSidebar: () => void;
}

interface GroupedPlans {
    today: SpacePlan[];
    thisWeek: SpacePlan[];
    earlier: SpacePlan[];
}

function groupPlansByDate(plans: SpacePlan[]): GroupedPlans {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - (6 * 24 * 60 * 60 * 1000);

    const grouped: GroupedPlans = {
        today: [],
        thisWeek: [],
        earlier: []
    };

    plans.forEach(plan => {
        if (plan.is_archived) return; // Keep sidebar focused on active explorations
        const created = new Date(plan.created_at).getTime();
        if (created >= startOfToday) {
            grouped.today.push(plan);
        } else if (created >= sevenDaysAgo) {
            grouped.thisWeek.push(plan);
        } else {
            grouped.earlier.push(plan);
        }
    });

    return grouped;
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AppSidebar({ isOpen, closeSidebar }: AppSidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const { plans, isLoading, error, deletePlan, fetchPlans } = usePlans();
    const [planToDelete, setPlanToDelete] = useState<SpacePlan | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const sidebarWidthRef = useRef<number>(260);

    // Initialize sidebar width from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('spacescout_sidebar_width');
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= 200 && parsed <= 420) {
                sidebarWidthRef.current = parsed;
                document.documentElement.style.setProperty('--sidebar-w', `${parsed}px`);
            }
        }
    }, []);

    // Handle drag-to-resize on desktop
    const handleResizeStart = (e: React.MouseEvent) => {
        if (window.innerWidth <= 768) return;
        e.preventDefault();
        setIsResizing(true);
        const startX = e.clientX;
        const startW = sidebarWidthRef.current;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startX;
            const newW = Math.max(200, Math.min(420, startW + delta));
            sidebarWidthRef.current = newW;
            document.documentElement.style.setProperty('--sidebar-w', `${newW}px`);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            localStorage.setItem('spacescout_sidebar_width', `${sidebarWidthRef.current}px`);
        };

        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Item selection handler
    const handleSelectPlan = (planId: number) => {
        localStorage.setItem('active_exploration_id', String(planId));
        navigate(`/explore/${planId}`);
        if (window.innerWidth <= 768) {
            closeSidebar();
        }
    };

    // New exploration click handler
    const handleNewExploration = (e: React.MouseEvent) => {
        e.preventDefault();
        localStorage.removeItem('active_exploration_id');
        navigate('/explore', { state: { startFresh: true } });
        if (window.innerWidth <= 768) {
            closeSidebar();
        }
    };

    // Confirm deletion
    const confirmDelete = async () => {
        if (!planToDelete) return;
        setIsDeleting(true);
        try {
            await deletePlan(planToDelete.id);

            // If the deleted exploration is currently open, navigate to /explore fresh
            if (location.pathname === `/explore/${planToDelete.id}`) {
                localStorage.removeItem('active_exploration_id');
                navigate('/explore', { replace: true, state: { startFresh: true } });
            }
            setPlanToDelete(null);
        } catch (err) {
            console.error("Failed to delete exploration", err);
        } finally {
            setIsDeleting(false);
        }
    };

    const grouped = groupPlansByDate(plans);
    const hasPlans = grouped.today.length > 0 || grouped.thisWeek.length > 0 || grouped.earlier.length > 0;

    const renderItem = (plan: SpacePlan) => {
        const isActive = location.pathname === `/explore/${plan.id}`;
        const discoveryCount = plan.discoveries?.length || 0;

        return (
            <div
                key={plan.id}
                className={`sidebar__item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectPlan(plan.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectPlan(plan.id);
                    }
                }}
            >
                <div className="sidebar__item-title-row">
                    <span className="sidebar__item-title" title={plan.title}>
                        {plan.title || "Untitled Exploration"}
                    </span>
                    <button
                        className="sidebar__item-delete-btn"
                        title="Delete exploration"
                        aria-label="Delete exploration"
                        onClick={(e) => {
                            e.stopPropagation();
                            setPlanToDelete(plan);
                        }}
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
                <div className="sidebar__item-sub">
                    <span>{discoveryCount} discover{discoveryCount === 1 ? 'y' : 'ies'}</span>
                    <span>{formatRelativeTime(plan.created_at)}</span>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Mobile backdrop overlay - hidden on desktop via CSS */}
            <div 
                className={`sidebar-overlay ${isOpen ? 'visible' : ''}`} 
                onClick={closeSidebar}
                aria-hidden={!isOpen}
            />

            <div className={`sidebar-wrap ${isOpen ? 'open' : ''} ${isResizing ? 'resizing' : ''}`}>
                <aside className="sidebar" aria-label="Explorations history">
                    <div className="sidebar__inner">
                        {/* Sidebar Header */}
                        <div className="sidebar__head">
                            <span className="sidebar__head-label">Explorations</span>
                            <div className="sidebar__head-actions">
                                <Link 
                                    to="/explore" 
                                    className="sidebar__new" 
                                    onClick={handleNewExploration}
                                    title="Start new exploration"
                                >
                                    <Plus size={13} strokeWidth={2.5} /> New
                                </Link>
                                <button 
                                    className="sidebar__close-mobile" 
                                    onClick={closeSidebar} 
                                    aria-label="Close sidebar"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Loading State Skeletons */}
                        {isLoading && (
                            <div className="sidebar__skeletons">
                                <div className="sidebar__skeleton-group">
                                    <div className="sidebar__skeleton-label shimmer" />
                                    <div className="sidebar__skeleton-item shimmer" />
                                    <div className="sidebar__skeleton-item shimmer" />
                                </div>
                                <div className="sidebar__skeleton-group">
                                    <div className="sidebar__skeleton-label shimmer" />
                                    <div className="sidebar__skeleton-item shimmer" />
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {!isLoading && error && (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--red)', fontSize: '0.8rem' }}>
                                <p style={{ marginBottom: '8px' }}>{error}</p>
                                <button 
                                    className="btn btn-ghost btn-sm" 
                                    onClick={() => fetchPlans(true)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <RefreshCw size={12} /> Retry
                                </button>
                            </div>
                        )}

                        {/* Empty State */}
                        {!isLoading && !error && !hasPlans && (
                            <div className="sidebar__empty">
                                <div className="sidebar__empty-icon">
                                    <Compass size={22} />
                                </div>
                                <div className="sidebar__empty-title">No explorations yet</div>
                                <div className="sidebar__empty-desc">
                                    Your generated space plans and discoveries will appear here.
                                </div>
                                <button 
                                    className="btn btn-primary btn-sm sidebar__empty-btn"
                                    onClick={handleNewExploration}
                                >
                                    <Plus size={13} /> Start exploring
                                </button>
                            </div>
                        )}

                        {/* Grouped History List */}
                        {!isLoading && !error && hasPlans && (
                            <div style={{ padding: '6px 0 16px' }}>
                                {grouped.today.length > 0 && (
                                    <div className="sidebar__group">
                                        <div className="sidebar__group-label">Today</div>
                                        {grouped.today.map(renderItem)}
                                    </div>
                                )}

                                {grouped.thisWeek.length > 0 && (
                                    <div className="sidebar__group">
                                        <div className="sidebar__group-label">This week</div>
                                        {grouped.thisWeek.map(renderItem)}
                                    </div>
                                )}

                                {grouped.earlier.length > 0 && (
                                    <div className="sidebar__group">
                                        <div className="sidebar__group-label">Earlier</div>
                                        {grouped.earlier.map(renderItem)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </aside>

                {/* Drag-to-resize Handle (desktop only) */}
                <div 
                    className={`sidebar-resize-handle ${isResizing ? 'dragging' : ''}`}
                    onMouseDown={handleResizeStart}
                    title="Drag to resize sidebar"
                />
            </div>

            {/* Delete Confirmation Modal */}
            {planToDelete && (
                <div className="sidebar-modal-overlay" onClick={() => !isDeleting && setPlanToDelete(null)}>
                    <div className="sidebar-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="sidebar-modal__header">
                            <div className="sidebar-modal__icon-danger">
                                <AlertTriangle size={18} />
                            </div>
                            <h3 className="sidebar-modal__title">Delete exploration?</h3>
                        </div>
                        <p className="sidebar-modal__message">
                            Are you sure you want to delete <strong>"{planToDelete.title || 'Untitled Exploration'}"</strong>? This will permanently remove this mission and its discoveries.
                        </p>
                        <div className="sidebar-modal__actions">
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => setPlanToDelete(null)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn btn-danger" 
                                onClick={confirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
