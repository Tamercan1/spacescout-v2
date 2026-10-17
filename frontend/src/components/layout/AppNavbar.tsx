import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
    Menu as MenuIcon, 
    LogOut as LogOutIcon, 
    Settings as SettingsIcon,
} from 'lucide-react';

interface AppNavbarProps {
    toggleSidebar: () => void;
}

export default function AppNavbar({ toggleSidebar }: AppNavbarProps) {
    const { user, logoutUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        logoutUser();
        navigate('/login');
    };

    return (
        <nav className="nav">
            <button className="nav__icon-btn" onClick={toggleSidebar}>
                <MenuIcon size={18} />
            </button>
            <div className="nav__divider"></div>
            
            <Link to="/" className="nav__brand">
                <img src="/spacescout-logo.png" alt="SpaceScout logo" className="nav__brand-logo nav__brand-logo--dark" />
                <img src="/spacescout-logo-light.png" alt="SpaceScout logo" className="nav__brand-logo nav__brand-logo--light" />
                SpaceScout
                <span className="nav__brand-v2">V2</span>
            </Link>

            <div className="nav__links hide-on-mobile" style={{ display: 'flex', marginLeft: '24px', gap: '8px' }}>
                <Link to="/" className={`nav__link ${location.pathname === '/' ? 'active' : ''}`}>
                    Home
                </Link>
                <Link to="/explore" className={`nav__link ${location.pathname.startsWith('/explore') && location.pathname !== '/explorations' ? 'active' : ''}`}>
                    Explore
                </Link>
                <Link to="/explorations" className={`nav__link ${location.pathname.startsWith('/explorations') ? 'active' : ''}`}>
                    Explorations
                </Link>
                <Link to="/settings" className={`nav__link ${location.pathname.startsWith('/settings') ? 'active' : ''}`}>
                    Settings
                </Link>
            </div>

            <div className="nav__right">
                <div style={{ position: 'relative' }} ref={menuRef}>
                    <button 
                        className={`nav__account-btn ${menuOpen ? 'open' : ''}`}
                        onClick={() => setMenuOpen(!menuOpen)}
                    >
                        <div className="nav__avatar">
                            {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="hide-on-mobile" style={{ fontSize: '0.85rem' }}>{user?.username || 'User'}</span>
                    </button>

                    <div className={`account-menu ${menuOpen ? 'open' : ''}`} style={{
                        position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                        background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                        borderRadius: 'var(--radius-lg)', minWidth: '180px',
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)', zIndex: 500,
                        overflow: 'hidden', opacity: menuOpen ? 1 : 0,
                        pointerEvents: menuOpen ? 'auto' : 'none',
                        transform: menuOpen ? 'translateY(0)' : 'translateY(-6px)',
                        transition: 'opacity 0.15s ease, transform 0.15s ease'
                    }}>
                        <div className="account-menu__header" style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
                            <div className="account-menu__name" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>{user?.username}</div>
                            <div className="account-menu__email" style={{ fontSize: '0.74rem', color: 'var(--text-3)' }}>{user?.email || 'SpaceScout Explorer'}</div>
                        </div>
                        <Link to="/settings" onClick={() => setMenuOpen(false)} className="account-menu__item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', fontSize: '0.82rem', color: 'var(--text-2)', cursor: 'pointer' }}>
                            <SettingsIcon size={14} /> Settings
                        </Link>
                        <div className="account-menu__divider" style={{ height: '1px', background: 'var(--border)' }}></div>
                        <div onClick={handleLogout} className="account-menu__item danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', fontSize: '0.82rem', color: 'var(--red)', cursor: 'pointer' }}>
                            <LogOutIcon size={14} /> Sign out
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Minimal inline styles for hiding things on mobile, normally this would be in index.css */}
            <style>{`
                @media (max-width: 768px) {
                    .hide-on-mobile { display: none !important; }
                }
            `}</style>
        </nav>
    );
}
