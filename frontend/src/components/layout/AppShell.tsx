import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppNavbar from './AppNavbar';
import AppSidebar from './AppSidebar';
import AppBottomNav from './AppBottomNav';

export default function AppShell() {
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            return false;
        }
        const saved = localStorage.getItem('spacescout_sidebar_open');
        return saved !== null ? saved === 'true' : true;
    });

    const handleToggle = () => {
        setSidebarOpen(prev => {
            const next = !prev;
            if (window.innerWidth > 768) {
                localStorage.setItem('spacescout_sidebar_open', String(next));
            }
            return next;
        });
    };

    const handleClose = () => {
        setSidebarOpen(false);
        if (window.innerWidth > 768) {
            localStorage.setItem('spacescout_sidebar_open', 'false');
        }
    };

    return (
        <div className="app-shell">
            <AppNavbar toggleSidebar={handleToggle} />

            <AppSidebar isOpen={sidebarOpen} closeSidebar={handleClose} />

            <main className="main-content">
                <Outlet />
            </main>

            <AppBottomNav />
        </div>
    );
}
