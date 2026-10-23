import { FALLBACK_ASTRONOMY } from './fallback.ts';
import type { FeaturedAstronomy, RawApodResponse, ApodMediaType } from './types.ts';

/**
 * Normalizes and validates raw APOD response data into a typed FeaturedAstronomy structure.
 * Pure function suitable for direct unit testing.
 */
export function parseApodResponse(
  raw: RawApodResponse,
  fallbackNotice?: string
): FeaturedAstronomy {
  if (!raw || typeof raw !== 'object') {
    return {
      ...FALLBACK_ASTRONOMY,
      statusNotice: fallbackNotice || 'Invalid response data received from NASA APOD.',
    };
  }

  // Check if API returned an error payload (e.g. {"code": 400, "msg": "..."})
  if (raw.code || raw.msg || raw.error) {
    const errorMsg = raw.msg || raw.error?.message || 'NASA API returned an error response.';
    return {
      ...FALLBACK_ASTRONOMY,
      statusNotice: `NASA API: ${errorMsg}`,
    };
  }

  // Validate critical fields
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  const date = typeof raw.date === 'string' ? raw.date.trim() : '';

  if (!title || !url || !date) {
    return {
      ...FALLBACK_ASTRONOMY,
      statusNotice: fallbackNotice || 'Incomplete astronomy entry received from NASA APOD.',
    };
  }

  // Normalize media type
  let mediaType: ApodMediaType = 'other';
  const rawMediaType = (raw.media_type || '').toLowerCase();
  if (rawMediaType === 'image') {
    mediaType = 'image';
  } else if (rawMediaType === 'video') {
    mediaType = 'video';
  }

  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  const hdUrl = typeof raw.hdurl === 'string' ? raw.hdurl.trim() : undefined;
  const copyright = typeof raw.copyright === 'string' ? raw.copyright.trim().replace(/\n/g, ' ') : undefined;

  return {
    title,
    date,
    explanation,
    mediaType,
    url,
    hdUrl,
    copyright,
    isFallback: false,
    statusNotice: fallbackNotice,
  };
}

/**
 * Server-only data service to retrieve NASA Astronomy Picture of the Day (APOD).
 *
 * Caching & Revalidation:
 * Uses Next.js data cache with 1-hour revalidation (3600 seconds). This keeps
 * server response times instant while staying well within NASA's DEMO_KEY rate limits
 * (30 requests/hour per IP address).
 *
 * Resilience:
 * Uses a 3-second AbortSignal timeout and catches HTTP 429 rate limits, server errors,
 * or network outages to return an authentic, pre-bundled fallback without breaking the page.
 */
export async function getFeaturedAstronomy(
  date?: string,
  fetchFn: typeof fetch = fetch
): Promise<FeaturedAstronomy> {
  // Read exclusively on the server side
  const apiKey = process.env.NASA_API_KEY?.trim() || 'DEMO_KEY';

  const endpoint = new URL('https://api.nasa.gov/planetary/apod');
  endpoint.searchParams.set('api_key', apiKey);

  if (date) {
    const cleanDate = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      endpoint.searchParams.set('date', cleanDate);
    }
  }

  try {
    const response = await fetchFn(endpoint.toString(), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[SpaceScout SSR] NASA API rate limit exceeded (HTTP 429). Serving curated fallback.');
        return {
          ...FALLBACK_ASTRONOMY,
          statusNotice: 'NASA API rate limit exceeded. Displaying curated astronomy feature.',
        };
      }

      if (response.status === 401 || response.status === 403) {
        console.warn('[SpaceScout SSR] NASA API authentication rejected. Serving curated fallback.');
        return {
          ...FALLBACK_ASTRONOMY,
          statusNotice: 'NASA API key invalid or unauthorized. Displaying curated astronomy feature.',
        };
      }

      console.warn(`[SpaceScout SSR] NASA API returned status ${response.status}. Serving curated fallback.`);
      return {
        ...FALLBACK_ASTRONOMY,
        statusNotice: `NASA API unavailable (status ${response.status}). Displaying curated astronomy feature.`,
      };
    }

    const data: RawApodResponse = await response.json();
    return parseApodResponse(data);
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      console.warn('[SpaceScout SSR] NASA API timed out after 3000ms. Serving curated fallback.');
      return {
        ...FALLBACK_ASTRONOMY,
        statusNotice: 'NASA API request timed out (3s threshold). Displaying curated astronomy feature.',
      };
    }

    console.warn('[SpaceScout SSR] Network error reaching NASA API. Serving curated fallback.');
    return {
      ...FALLBACK_ASTRONOMY,
      statusNotice: 'Could not reach NASA APOD service. Displaying curated astronomy feature.',
    };
  }
}
