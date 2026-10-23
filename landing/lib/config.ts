/**
 * SpaceScout Landing Application — Configuration & URL Helpers
 *
 * Centralizes resolution of public application URLs, canonical site URLs,
 * and predictable fallback behavior between local development and production.
 */

const DEFAULT_DEV_APP_URL = 'http://localhost:5173';
const DEFAULT_PROD_APP_URL = 'https://spacescout.vercel.app';

/**
 * Returns the resolved SpaceScout exploration application URL.
 *
 * Fallback behavior:
 * - Production: defaults to deployed app 'https://spacescout.vercel.app'
 * - Development: defaults to local Vite dev server 'http://localhost:5173'
 *
 * Validation:
 * - Strips trailing slashes.
 * - Rejects malformed strings that do not start with http:// or https://.
 */
export function getAppUrl(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (raw && /^https?:\/\/[^\s]+$/i.test(raw)) {
    // Prevent accidental localhost URLs in production mode
    if (isProd && /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(raw)) {
      return DEFAULT_PROD_APP_URL;
    }
    return raw.replace(/\/+$/, '');
  }

  return isProd ? DEFAULT_PROD_APP_URL : DEFAULT_DEV_APP_URL;
}

/**
 * Returns the resolved canonical marketing site URL if explicitly configured.
 *
 * Constraints:
 * - Does NOT invent or hardcode a speculative production domain.
 * - In production: returns null if NEXT_PUBLIC_SITE_URL is missing or set to localhost.
 * - In development: returns 'http://localhost:3000' as a local convenience default.
 */
export function getSiteUrl(): string | null {
  const isProd = process.env.NODE_ENV === 'production';
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (raw && /^https?:\/\/[^\s]+$/i.test(raw)) {
    if (isProd && /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(raw)) {
      return null;
    }
    return raw.replace(/\/+$/, '');
  }

  return isProd ? null : 'http://localhost:3000';
}
