import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Layers, Settings } from 'lucide-react';

export default function AppBottomNav() {
    const location = useLocation();

    const navItems = [
        {
            label: 'Home',
            path: '/',
            icon: Home,
            isActive: location.pathname === '/'
        },
        {
            label: 'Explore',
            path: '/explore',
            icon: Compass,
            isActive: location.pathname.startsWith('/explore') && location.pathname !== '/explorations'
        },
        {
            label: 'Explorations',
            path: '/explorations',
            icon: Layers,
            isActive: location.pathname.startsWith('/explorations')
        },
        {
            label: 'Settings',
            path: '/settings',
            icon: Settings,
            isActive: location.pathname.startsWith('/settings')
        }
    ];

    return (
        <nav className="bottom-nav" aria-label="Mobile Navigation">
            {navItems.map((item) => {
                const Icon = item.icon;
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`bottom-nav__item ${item.isActive ? 'active' : ''}`}
                    >
                        <div className="bottom-nav__icon-wrap">
                            <Icon size={19} strokeWidth={item.isActive ? 2.3 : 1.8} />
                        </div>
                        <span className="bottom-nav__label">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
