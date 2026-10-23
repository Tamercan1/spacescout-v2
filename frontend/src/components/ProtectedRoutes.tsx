import { useAuth } from "../context/AuthContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";

function ProtectedRoute() {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to='/login' state={{ from: location }} replace />;
    }

    // Authenticated, waiting for profile details to load
    if (!user) {
        return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
    }

    const isOnboarded = Boolean(user.profile?.onboarding_completed_at);
    const isOnboardingRoute = location.pathname === '/onboarding';

    if (!isOnboarded && !isOnboardingRoute) {
        return <Navigate to='/onboarding' replace />;
    }

    if (isOnboarded && isOnboardingRoute) {
        return <Navigate to='/' replace />;
    }

    return <Outlet />;
}

export default ProtectedRoute;