import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

interface AppSidebarProps {
    isOpen: boolean;
    closeSidebar: () => void;
}

export default function AppSidebar({ isOpen, closeSidebar }: AppSidebarProps) {
    return (
        <>
            <div className={`sidebar-overlay ${isOpen ? 'visible' : ''}`} onClick={closeSidebar}></div>
            
            <div className={`sidebar-wrap ${isOpen ? 'open' : ''}`}>
                <aside className="sidebar">
                    <div className="sidebar__inner">
                        <div className="sidebar__head">
                            <div className="sidebar__head-label">
                                Explorations
                            </div>
                            <Link to="/explore" className="sidebar__new">
                                <Plus size={14} /> New
                            </Link>
                        </div>

                        <div className="sidebar__group">
                            <div className="sidebar__group-label">
                                History (Placeholder)
                            </div>
                            
                            <div className="sidebar__item">
                                <div className="sidebar__item-title">
                                    Sample Exploration
                                </div>
                                <div className="sidebar__item-sub">
                                    <span>3 discoveries</span>
                                    <span>Just now</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
                
                <div className="sidebar-resize-handle" />
            </div>
        </>
    );
}
