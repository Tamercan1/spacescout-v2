import { FALLBACK_ASTRONOMY } from './fallback.ts';
import type { FeaturedAstronomy, RawApodResponse, ApodMediaType } from './types.ts';

const NASA_APOD_BASIC_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const NASA_APOD_LEGACY_URL = 'https://api.nasa.gov/planetary/apod';

/**
 * Strips HTML tags and unescapes basic HTML entities.
 */
export function cleanHtmlText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;|&#39;/g, "'")
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&#038;|&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cleans raw HTML explanation from NASA Science APOD API into clean readable text.
 * Strips leading "Explanation:" headers, HTML links/formatting, and normalizes spacing.
 */
export function cleanApodExplanation(rawExplanation: string): string {
  if (!rawExplanation) return '';
  let cleaned = rawExplanation.trim().replace(/^(?:<p>\s*)?<(?:strong|b)>Explanation:?\s*<\/(?:strong|b)>\s*/i, '');
  cleaned = cleaned.replace(/^Explanation:?\s*/i, '');
  return cleanHtmlText(cleaned);
}

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

  // Validate title and date
  const title = typeof raw.title === 'string' ? cleanHtmlText(raw.title) : '';
  const date = typeof raw.date === 'string' ? raw.date.trim() : '';

  if (!title || !date) {
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

  // Extract media URL based on media type and source format
  let url = '';
  let hdUrl = typeof raw.hdurl === 'string' ? raw.hdurl.trim() : undefined;

  if (mediaType === 'video') {
    if (raw.basic_html) {
      const iframeMatch = raw.basic_html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      const sourceMatch = raw.basic_html.match(/<source[^>]+src=["']([^"']+)["']/i);
      const videoMatch = raw.basic_html.match(/<video[^>]+src=["']([^"']+)["']/i);
      const directLinkMatch = raw.basic_html.match(/https?:\/\/[^\s"'<>]+\.(?:mp4|webm|ogg|mov|m4v)/i);
      const ytMatch = raw.basic_html.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/i);
      const vimeoMatch = raw.basic_html.match(/https?:\/\/(?:player\.)?vimeo\.com\/(?:video\/)?\d+/i);

      if (iframeMatch?.[1]) {
        const src = iframeMatch[1].trim();
        url = src.startsWith('//') ? `https:${src}` : src;
      } else if (sourceMatch?.[1]) {
        const src = sourceMatch[1].trim();
        url = src.startsWith('//') ? `https:${src}` : src;
      } else if (videoMatch?.[1]) {
        const src = videoMatch[1].trim();
        url = src.startsWith('//') ? `https:${src}` : src;
      } else if (directLinkMatch?.[0]) {
        url = directLinkMatch[0].trim();
      } else if (ytMatch?.[0]) {
        url = ytMatch[0].trim();
      } else if (vimeoMatch?.[0]) {
        url = vimeoMatch[0].trim();
      }
    }
    if (!url && typeof raw.url === 'string') {
      url = raw.url.trim();
    }
  } else {
    // Image handling: science.nasa.gov often sets url to an HTML article page and hdurl to the image
    let basicImgSrc: string | undefined;
    if (raw.basic_html) {
      const imgMatch = raw.basic_html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch?.[1]) {
        basicImgSrc = imgMatch[1].trim();
      }
    }

    if (basicImgSrc) {
      url = basicImgSrc;
      if (!hdUrl) {
        hdUrl = basicImgSrc;
      }
    } else if (raw.url && !raw.url.includes('/image-article/')) {
      url = raw.url.trim();
    } else if (hdUrl) {
      url = hdUrl;
    } else if (raw.url) {
      url = raw.url.trim();
    }
  }

  // Reject fallback scraper placeholder logo (e.g. WordPress nasa-logo@2x.png with title "NASA Science")
  const isPlaceholderLogo =
    title.toLowerCase() === 'nasa science' ||
    url.includes('nasa-logo') ||
    (hdUrl && hdUrl.includes('nasa-logo'));

  if (isPlaceholderLogo) {
    return {
      ...FALLBACK_ASTRONOMY,
      statusNotice: fallbackNotice || 'NASA APOD service returned generic site logo. Serving curated astronomy feature.',
    };
  }

  if (!url) {
    return {
      ...FALLBACK_ASTRONOMY,
      statusNotice: fallbackNotice || 'Incomplete astronomy entry received from NASA APOD.',
    };
  }

  const rawExplanation = typeof raw.explanation === 'string' ? raw.explanation : '';
  const explanation = cleanApodExplanation(rawExplanation);

  const rawCopyright = raw.copyright || raw.credit;
  const copyright = typeof rawCopyright === 'string' && rawCopyright.trim()
    ? cleanHtmlText(rawCopyright).replace(/\n/g, ' ')
    : undefined;

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
 * Uses Next.js data cache with 1-hour revalidation (3600 seconds).
 *
 * Resilience & Dual-Source Architecture:
 * 1. Primary: Official NASA Science REST API (https://science.nasa.gov/wp-json/wp/v2/apod-basic).
 * 2. Fallback: Legacy API endpoint (https://api.nasa.gov/planetary/apod).
 * 3. Pre-bundled fallback: Authentic curated astronomy discovery if both fail, time out, or rate limit.
 */
export async function getFeaturedAstronomy(
  date?: string,
  fetchFn: typeof fetch = fetch
): Promise<FeaturedAstronomy> {
  const apiKey = process.env.NASA_API_KEY?.trim() || 'DEMO_KEY';

  let cleanDate: string | undefined;
  let yymmdd: string | undefined;
  if (date) {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      cleanDate = trimmed;
      const parts = trimmed.split('-');
      yymmdd = `${parts[0].slice(-2)}${parts[1]}${parts[2]}`;
    }
  }

  // 1. Attempt Primary Service: NASA Science REST API
  const primaryUrl = yymmdd
    ? `${NASA_APOD_BASIC_URL}/${yymmdd}`
    : `${NASA_APOD_BASIC_URL}?per_page=1`;

  try {
    const primaryRes = await fetchFn(primaryUrl, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4500),
    });

    if (primaryRes.ok) {
      const json = await primaryRes.json();
      const rawItem: RawApodResponse = Array.isArray(json) ? json[0] : json;
      if (rawItem && typeof rawItem === 'object') {
        const parsed = parseApodResponse(rawItem);
        if (!parsed.isFallback) {
          return parsed;
        }
      }
    } else if (primaryRes.status === 429) {
      console.warn('[SpaceScout SSR] NASA API rate limit exceeded (HTTP 429). Serving curated fallback.');
      return {
        ...FALLBACK_ASTRONOMY,
        statusNotice: 'NASA API rate limit exceeded. Displaying curated astronomy feature.',
      };
    }
  } catch (err: unknown) {
    console.warn('[SpaceScout SSR] Primary NASA Science API unavailable, falling back to legacy endpoint.', err);
  }

  // 2. Fallback to Legacy endpoint: https://api.nasa.gov/planetary/apod
  const legacyEndpoint = new URL(NASA_APOD_LEGACY_URL);
  legacyEndpoint.searchParams.set('api_key', apiKey);
  if (cleanDate) {
    legacyEndpoint.searchParams.set('date', cleanDate);
  }

  try {
    const legacyRes = await fetchFn(legacyEndpoint.toString(), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4500),
    });

    if (!legacyRes.ok) {
      if (legacyRes.status === 429) {
        console.warn('[SpaceScout SSR] NASA API rate limit exceeded (HTTP 429). Serving curated fallback.');
        return {
          ...FALLBACK_ASTRONOMY,
          statusNotice: 'NASA API rate limit exceeded. Displaying curated astronomy feature.',
        };
      }
      if (legacyRes.status === 401 || legacyRes.status === 403) {
        console.warn('[SpaceScout SSR] NASA API authentication rejected. Serving curated fallback.');
        return {
          ...FALLBACK_ASTRONOMY,
          statusNotice: 'NASA API key invalid or unauthorized. Displaying curated astronomy feature.',
        };
      }

      console.warn(`[SpaceScout SSR] NASA API returned status ${legacyRes.status}. Serving curated fallback.`);
      return {
        ...FALLBACK_ASTRONOMY,
        statusNotice: `NASA API unavailable (status ${legacyRes.status}). Displaying curated astronomy feature.`,
      };
    }

    const data: RawApodResponse = await legacyRes.json();
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
