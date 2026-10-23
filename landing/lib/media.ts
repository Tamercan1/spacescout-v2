/**
 * SpaceScout Landing Application — Media Resolver
 *
 * Handles detection, normalization, and secure embedding of diverse NASA APOD media formats:
 * - Standard Images (jpg, png, webp, gif, etc.)
 * - YouTube links (watch, embed, shorts, youtu.be, protocol-relative) -> converted to privacy-enhanced nocookie embeds
 * - Vimeo links (standard video and player links) -> converted to player.vimeo.com embeds
 * - Direct HTML5 streaming video files (.mp4, .webm, .ogg, .mov, .m4v)
 * - Generic embeddable iframe players
 * - External video portals (graceful fallback card)
 */

export type ResolvedAstronomyMedia =
  | { kind: 'image'; src: string }
  | { kind: 'youtube'; embedUrl: string; originalUrl: string }
  | { kind: 'vimeo'; embedUrl: string; originalUrl: string }
  | { kind: 'video'; videoUrl: string }
  | { kind: 'iframe'; embedUrl: string }
  | { kind: 'external_video'; portalUrl: string };

/**
 * Extracts a privacy-enhanced nocookie embed URL from any valid YouTube URL format.
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  try {
    if (!url) return null;
    const normalized = url.startsWith('//') ? `https:${url}` : url;
    const ytRegex =
      /(?:youtu\.be\/|(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/i;
    const match = normalized.match(ytRegex);
    if (match && match[1]) {
      return `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0&modestbranding=1`;
    }
  } catch {
    // Fall back gracefully
  }
  return null;
}

/**
 * Normalizes a Vimeo URL into an embeddable player URL.
 */
export function getVimeoEmbedUrl(url: string): string | null {
  try {
    if (!url) return null;
    const normalized = url.startsWith('//') ? `https:${url}` : url;
    const vimeoRegex =
      /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+))/i;
    const match = normalized.match(vimeoRegex);
    if (match && match[3]) {
      return `https://player.vimeo.com/video/${match[3]}`;
    }
    if (normalized.includes('player.vimeo.com/video/')) {
      return normalized;
    }
  } catch {
    // Fall back gracefully
  }
  return null;
}

/**
 * Checks whether a URL points directly to an HTML5 playable video stream.
 */
export function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  const cleanUrl = url.split(/[?#]/)[0].toLowerCase();
  return (
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.webm') ||
    cleanUrl.endsWith('.ogg') ||
    cleanUrl.endsWith('.mov') ||
    cleanUrl.endsWith('.m4v')
  );
}

/**
 * Checks whether a URL is an embeddable player iframe.
 */
export function isGenericEmbedUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('/embed/') || lower.includes('player.') || lower.includes('/player/');
}

/**
 * Checks whether a URL ends in a common image extension.
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;
  const cleanUrl = url.split(/[?#]/)[0].toLowerCase();
  return (
    cleanUrl.endsWith('.jpg') ||
    cleanUrl.endsWith('.jpeg') ||
    cleanUrl.endsWith('.png') ||
    cleanUrl.endsWith('.webp') ||
    cleanUrl.endsWith('.gif') ||
    cleanUrl.endsWith('.svg') ||
    cleanUrl.endsWith('.avif')
  );
}

/**
 * Resolves media URL and declared mediaType into an actionable rendering format.
 */
export function resolveAstronomyMedia(
  url: string | null | undefined,
  declaredMediaType?: string | null
): ResolvedAstronomyMedia {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { kind: 'image', src: '/carina-nebula.jpg' };
  }

  const trimmedUrl = url.trim();
  const normalized = trimmedUrl.startsWith('//') ? `https:${trimmedUrl}` : trimmedUrl;
  const lowerMediaType = (declaredMediaType || '').toLowerCase();

  // 1. YouTube (e.g. watch?v=, youtu.be, shorts, embed)
  const ytEmbed = getYouTubeEmbedUrl(normalized);
  if (ytEmbed) {
    return { kind: 'youtube', embedUrl: ytEmbed, originalUrl: normalized };
  }

  // 2. Vimeo
  const vimeoEmbed = getVimeoEmbedUrl(normalized);
  if (vimeoEmbed) {
    return { kind: 'vimeo', embedUrl: vimeoEmbed, originalUrl: normalized };
  }

  // 3. Direct HTML5 video file (.mp4, .webm, .ogg, etc.)
  if (isDirectVideoUrl(normalized)) {
    return { kind: 'video', videoUrl: normalized };
  }

  // 4. Generic iframe embed (/embed/ or player.)
  if (isGenericEmbedUrl(normalized)) {
    return { kind: 'iframe', embedUrl: normalized };
  }

  // 5. If declared as video or clearly non-image video portal
  if (lowerMediaType === 'video') {
    return { kind: 'external_video', portalUrl: normalized };
  }

  // 6. Default to image (handled by AstronomyImage with fallback)
  return { kind: 'image', src: normalized };
}
