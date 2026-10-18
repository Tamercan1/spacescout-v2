import axios, { type InternalAxiosRequestConfig } from "axios";

const getApiBaseUrl = (): string => {
    const configuredUrl = import.meta.env.VITE_API_URL;
    if (configuredUrl) {
        return configuredUrl;
    }
    // In production builds, do NOT silently fall back to an HTTP localhost or hostname-based URL.
    if (import.meta.env.PROD) {
        console.error(
            "CRITICAL: VITE_API_URL environment variable is not defined for production build. " +
            "API requests will fail. Please configure VITE_API_URL to point to your backend."
        );
        return "";
    }
    // Local development fallback
    if (typeof window !== "undefined" && window.location.hostname) {
        return `http://${window.location.hostname}:8000`;
    }
    return "http://127.0.0.1:8000";
};

const VITE_API_URL = getApiBaseUrl();

export const api = axios.create({
    baseURL: VITE_API_URL,
    headers: {
        "Content-Type": "application/json"
    }
});

export const authApi = axios.create({
    baseURL: VITE_API_URL,
    headers: {
        "Content-Type": "application/json"
    }
})

api.interceptors.request.use(
    (config) => {
        const access_token = localStorage.getItem("access_token")

        if(access_token) {
            config.headers.Authorization = `Bearer ${access_token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }   
)

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

// Module-level in-flight refresh promise to prevent duplicate concurrent refresh requests
let refreshPromise: Promise<string> | null = null;

// Helper to clear stale credentials and notify auth context without duplication
function clearSessionAndNotify() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("spacescout:session_expired"));
    }
}

// for error 401 unauthorized error - expired token with retry protection
api.interceptors.response.use(
    (response) => response,

    async (error: unknown) => {
        const axiosError = error as {
            config?: RetryableRequestConfig;
            response?: { status?: number };
            url?: string;
        } | null | undefined;

        // Safely check error.response: do not assume it exists (handles network errors, timeouts, etc.)
        if (!axiosError?.response || axiosError.response.status !== 401) {
            return Promise.reject(error);
        }

        const originalRequest = axiosError.config;

        // If request config is missing or has already been retried, do not loop
        if (!originalRequest || originalRequest._retry) {
            if (originalRequest?._retry) {
                // Already retried once and still 401: session is invalid
                clearSessionAndNotify();
            }
            return Promise.reject(error);
        }

        // Avoid intercepting auth/public endpoints to preserve normal handling
        if (
            typeof originalRequest.url === "string" &&
            (originalRequest.url.includes("/auth/token/") || originalRequest.url.includes("/register/"))
        ) {
            return Promise.reject(error);
        }

        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) {
            // Non-auth request returned 401 with no refresh token: session is invalid/stale
            clearSessionAndNotify();
            return Promise.reject(error);
        }

        // Mark as retried so this request cannot trigger another refresh cycle
        originalRequest._retry = true;

        try {
            // Deduplicate concurrent refresh calls: share in-flight refresh promise
            if (!refreshPromise) {
                refreshPromise = authApi.post<{ access: string }>(
                    "/auth/token/refresh/",
                    {
                        refresh: refreshToken
                    }
                ).then((response) => {
                    const newAccessToken = response.data.access;
                    localStorage.setItem("access_token", newAccessToken);
                    return newAccessToken;
                }).catch((refreshError: unknown) => {
                    clearSessionAndNotify();
                    return Promise.reject(refreshError);
                }).finally(() => {
                    refreshPromise = null;
                });
            }

            const newAccessToken = await refreshPromise;

            // Update Authorization header on original request
            if (originalRequest.headers) {
                if (typeof (originalRequest.headers as { set?: unknown }).set === "function") {
                    (originalRequest.headers as { set: (k: string, v: string) => void }).set("Authorization", `Bearer ${newAccessToken}`);
                } else {
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                }
            }

            return api(originalRequest);
        } catch (refreshError: unknown) {
            return Promise.reject(refreshError);
        }
    }
);

export default api;