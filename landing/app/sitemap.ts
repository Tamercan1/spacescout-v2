import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/config';

/**
 * Dynamic Sitemap Generator.
 *
 * Constraints:
 * - If NEXT_PUBLIC_SITE_URL is not configured (or is a localhost URL in production),
 *   returns an empty sitemap to prevent indexing speculative or non-production URLs.
 * - When configured with a valid absolute URL, returns the canonical homepage entry.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  if (!siteUrl) {
    return [];
  }

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];
}
