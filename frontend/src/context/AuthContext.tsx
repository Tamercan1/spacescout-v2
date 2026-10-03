/* eslint-disable react-refresh/only-export-components */
import { useContext, createContext, useState, useEffect, type ReactNode } from "react";
import { login } from "../api/auth";
import { getCurrentUser, type User } from "../api/user";

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    isLoading: boolean;
    loginUser: (username: string, password: string) => Promise<void>;
    logoutUser: () => void;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: {children: ReactNode}) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
        Boolean(localStorage.getItem("access_token"))
    );
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchUser = async () => {
            if (isAuthenticated) {
                try {
                    const userData = await getCurrentUser();
                    setUser(userData);
                } catch (error) {
                    console.error("Failed to fetch user profile", error);
                    setIsAuthenticated(false);
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("refresh_token");
                }
            }
            setIsLoading(false);
        };

        fetchUser();
    }, [isAuthenticated]);

    const loginUser = async (username: string, password: string) => {
        const tokens = await login(username, password);

        if (tokens) {
            localStorage.setItem("access_token", tokens.access);
            localStorage.setItem("refresh_token", tokens.refresh);
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
        }
    };

    const logoutUser = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setIsAuthenticated(false);
        setUser(null);
    };

    const provided_contexts: AuthContextType = {
        isAuthenticated,
        user,
        isLoading,
        loginUser,
        logoutUser,
        updateUser: setUser
    };

    return (
        <AuthContext.Provider value={provided_contexts}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if(!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }

    return context;
}