import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppNavbar from './AppNavbar';
import AppSidebar from './AppSidebar';
import AppBottomNav from './AppBottomNav';

export default function AppShell() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="app-shell">
            <AppNavbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            <AppSidebar isOpen={sidebarOpen} closeSidebar={() => setSidebarOpen(false)} />

            <main className="main-content">
                <Outlet />
            </main>

            <AppBottomNav />
        </div>
    );
}
