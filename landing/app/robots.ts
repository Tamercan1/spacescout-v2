import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/config';

/**
 * Dynamic robots.txt Generator.
 *
 * Directs search engine crawlers and attaches the dynamic sitemap
 * only when a valid canonical site URL is configured.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  };
}
