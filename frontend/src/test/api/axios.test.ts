import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { authApi } from '../../api/axios';
import type { InternalAxiosRequestConfig } from 'axios';

describe('Axios Client & Interceptors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('attaches Bearer access token to request Authorization header when present', async () => {
        localStorage.setItem('access_token', 'jwt-token-alpha');

        // Request interceptor handler
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestInterceptor = (api.interceptors.request as any).handlers[0].fulfilled;

        const config = {
            headers: {} as Record<string, string>,
        } as InternalAxiosRequestConfig;

        const updatedConfig = await requestInterceptor(config);
        expect(updatedConfig.headers.Authorization).toBe('Bearer jwt-token-alpha');
    });

    it('does not attach Authorization header when no access token exists', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestInterceptor = (api.interceptors.request as any).handlers[0].fulfilled;

        const config = {
            headers: {} as Record<string, string>,
        } as InternalAxiosRequestConfig;

        const updatedConfig = await requestInterceptor(config);
        expect(updatedConfig.headers.Authorization).toBeUndefined();
    });

    it('clears stale tokens and dispatches session_expired on 401 when refresh token is missing', async () => {
        localStorage.setItem('access_token', 'expired-access');

        const sessionExpiredSpy = vi.fn();
        window.addEventListener('spacescout:session_expired', sessionExpiredSpy);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responseInterceptorRejected = (api.interceptors.response as any).handlers[0].rejected;

        const error = {
            config: { url: '/api/plans/' },
            response: { status: 401 },
        };

        await expect(responseInterceptorRejected(error)).rejects.toEqual(error);

        expect(localStorage.getItem('access_token')).toBeNull();
        expect(localStorage.getItem('refresh_token')).toBeNull();
        expect(sessionExpiredSpy).toHaveBeenCalledTimes(1);

        window.removeEventListener('spacescout:session_expired', sessionExpiredSpy);
    });

    it('handles network errors without response object without crashing', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responseInterceptorRejected = (api.interceptors.response as any).handlers[0].rejected;

        const networkError = new Error('Network Error');
        // No response property attached

        await expect(responseInterceptorRejected(networkError)).rejects.toBe(networkError);
    });

    it('deduplicates concurrent 401 refresh requests into a single refresh call', async () => {
        localStorage.setItem('access_token', 'expired-access');
        localStorage.setItem('refresh_token', 'valid-refresh');

        const refreshSpy = vi.spyOn(authApi, 'post').mockResolvedValue({
            data: { access: 'brand-new-access-token' },
        });

        api.defaults.adapter = vi.fn().mockResolvedValue({ status: 200, data: 'success' });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responseInterceptorRejected = (api.interceptors.response as any).handlers[0].rejected;

        const error1 = {
            config: { url: '/api/plans/', headers: {} },
            response: { status: 401 },
        };
        const error2 = {
            config: { url: '/api/credentials/', headers: {} },
            response: { status: 401 },
        };

        // Fire both concurrent 401 errors
        const p1 = responseInterceptorRejected(error1);
        const p2 = responseInterceptorRejected(error2);

        await Promise.all([p1, p2]);

        // Auth refresh endpoint should have been hit only ONCE
        expect(refreshSpy).toHaveBeenCalledTimes(1);
        expect(refreshSpy).toHaveBeenCalledWith('/auth/token/refresh/', {
            refresh: 'valid-refresh',
        });
        expect(localStorage.getItem('access_token')).toBe('brand-new-access-token');
    });
});
