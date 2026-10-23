import type { FeaturedAstronomy } from './types.ts';

/**
 * Curated, pre-bundled fallback astronomy entry.
 * Used whenever the NASA APOD API times out, exceeds rate limits (429),
 * returns server errors (5xx), or is offline.
 *
 * Attribution: NASA / ESA / CSA / STScI — Webb Cosmic Cliffs (NGC 3324)
 */
export const FALLBACK_ASTRONOMY: FeaturedAstronomy = {
  title: 'The Carina Nebula: Cosmic Cliffs in Deep Infrared',
  date: '2024-07-12',
  explanation:
    'This landscape of "mountains" and "valleys" speckled with glittering stars is actually the edge of a nearby, young, star-forming region called NGC 3324 in the Carina Nebula. Captured in infrared light by NASA\'s James Webb Space Telescope, this image reveals for the first time previously invisible areas of star birth.',
  mediaType: 'image',
  url: '/carina-nebula.jpg',
  hdUrl: 'https://images-assets.nasa.gov/image/PIA25327/PIA25327~orig.jpg',
  copyright: 'NASA, ESA, CSA, STScI',
  isFallback: true,
  statusNotice: 'Archived NASA Feature (Standby Mode)',
};
