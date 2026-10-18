import { useState, useEffect, useMemo } from 'react';
import { ExternalLink, Maximize2, AlertTriangle, X, Play } from 'lucide-react';
import './MediaViewer.css';

export interface MediaViewerProps {
    url?: string | null;
    mediaType?: string | null;
    title?: string;
    caption?: string;
    sourceUrl?: string;
    allowLightbox?: boolean;
    className?: string;
}

/**
 * Determines whether a URL is a YouTube link and extracts an embeddable URL.
 */
function getYouTubeEmbedUrl(url: string): string | null {
    try {
        if (!url) return null;
        const normalized = url.startsWith('//') ? `https:${url}` : url;
        const ytRegex = /(?:youtu\.be\/|(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/;
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
 * Determines whether a URL is a Vimeo link and extracts an embeddable URL.
 */
function getVimeoEmbedUrl(url: string): string | null {
    try {
        if (!url) return null;
        const normalized = url.startsWith('//') ? `https:${url}` : url;
        const vimeoRegex = /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+))/;
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
 * Checks whether a URL points directly to an audio/video streaming format.
 */
function isDirectVideoUrl(url: string): boolean {
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
 * Checks whether a URL is an embeddable web player iframe.
 */
function isGenericEmbedUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('/embed/') || lower.includes('player.') || lower.includes('/player/');
}

/**
 * Robust, accessible media display component for SpaceScout discoveries and cards.
 * Automatically resolves images, YouTube/Vimeo embeds, and direct videos with
 * sleek loading states, error fallbacks, and a full-screen Lightbox.
 */
export default function MediaViewer({
    url,
    mediaType,
    title,
    caption,
    sourceUrl,
    allowLightbox = true,
    className = ''
}: MediaViewerProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [prevUrl, setPrevUrl] = useState(url);

    // Reset loading/error state if URL changes
    if (url !== prevUrl) {
        setPrevUrl(url);
        setIsLoading(true);
        setHasError(false);
    }

    // Handle Escape key listener for Lightbox
    useEffect(() => {
        if (!isLightboxOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsLightboxOpen(false);
            }
        };

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isLightboxOpen]);

    const resolved = useMemo(() => {
        if (!url) return { kind: 'empty' as const };

        const ytEmbed = getYouTubeEmbedUrl(url);
        if (ytEmbed) {
            return { kind: 'iframe' as const, embedUrl: ytEmbed, platform: 'YouTube' };
        }

        const vimeoEmbed = getVimeoEmbedUrl(url);
        if (vimeoEmbed) {
            return { kind: 'iframe' as const, embedUrl: vimeoEmbed, platform: 'Vimeo' };
        }

        if (isDirectVideoUrl(url)) {
            return { kind: 'video' as const, videoUrl: url };
        }

        if (isGenericEmbedUrl(url)) {
            return { kind: 'iframe' as const, embedUrl: url, platform: 'Video' };
        }

        if (mediaType === 'video') {
            return { kind: 'portal' as const, portalUrl: url };
        }

        return { kind: 'image' as const, imageUrl: url };
    }, [url, mediaType]);

    if (!url || resolved.kind === 'empty') {
        return null;
    }

    const effectiveSourceUrl = sourceUrl || url;

    // Error Fallback Banner
    if (hasError) {
        return (
            <div className={`media-viewer ${className}`}>
                <div className="media-viewer__fallback">
                    <div className="media-viewer__fallback-icon">
                        <AlertTriangle size={22} />
                    </div>
                    <div className="media-viewer__fallback-title">Preview Unavailable</div>
                    <div className="media-viewer__fallback-desc">
                        This media cannot be embedded directly in your browser. You can access the official original source directly.
                    </div>
                    <a
                        href={effectiveSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginTop: '4px' }}
                    >
                        <span>Open Original Media</span>
                        <ExternalLink size={14} />
                    </a>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={`media-viewer ${className}`}>
                {/* 1. Iframe Video (YouTube / Vimeo / Generic Embed) */}
                {resolved.kind === 'iframe' && (
                    <div className="media-viewer__frame media-viewer__frame--video">
                        {isLoading && (
                            <div className="media-viewer__skeleton">
                                <Play size={26} opacity={0.6} />
                                <span>Loading video player...</span>
                            </div>
                        )}
                        <iframe
                            className="media-viewer__iframe"
                            src={resolved.embedUrl}
                            title={title || `${resolved.platform} video player`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            onLoad={() => setIsLoading(false)}
                            onError={() => setHasError(true)}
                        />
                    </div>
                )}

                {/* 2. Direct HTML5 Video */}
                {resolved.kind === 'video' && (
                    <div className="media-viewer__frame media-viewer__frame--video">
                        <video
                            className="media-viewer__video"
                            src={resolved.videoUrl}
                            controls
                            playsInline
                            preload="metadata"
                            onLoadedData={() => setIsLoading(false)}
                            onError={() => setHasError(true)}
                        />
                    </div>
                )}

                {/* 3. External Video Portal / Feature */}
                {resolved.kind === 'portal' && (
                    <div className="media-viewer__frame media-viewer__frame--portal">
                        <div className="media-viewer__portal-backdrop"></div>
                        <div className="media-viewer__portal-content">
                            <div className="media-viewer__portal-badge">
                                <Play size={12} fill="currentColor" />
                                <span>NASA Video Feature</span>
                            </div>
                            <div className="media-viewer__portal-title">
                                {title || 'Interactive Space Video'}
                            </div>
                            <div className="media-viewer__portal-desc">
                                This astronomy feature includes an interactive video hosted on NASA's portal.
                            </div>
                            <a
                                href={resolved.portalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary media-viewer__portal-action"
                            >
                                <Play size={14} fill="currentColor" />
                                <span>Watch Video on NASA</span>
                                <ExternalLink size={13} />
                            </a>
                        </div>
                    </div>
                )}

                {/* 3. Image with Lightbox inspection */}
                {resolved.kind === 'image' && (
                    <div
                        className="media-viewer__frame"
                        onClick={() => allowLightbox && setIsLightboxOpen(true)}
                        title={allowLightbox ? 'Click to inspect full resolution' : undefined}
                        role={allowLightbox ? 'button' : undefined}
                        tabIndex={allowLightbox ? 0 : undefined}
                        onKeyDown={(e) => {
                            if (allowLightbox && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                setIsLightboxOpen(true);
                            }
                        }}
                    >
                        {isLoading && (
                            <div className="media-viewer__skeleton">
                                <span>Loading imagery...</span>
                            </div>
                        )}
                        <img
                            className="media-viewer__image"
                            src={resolved.imageUrl}
                            alt={caption || title || 'Space imagery'}
                            loading="lazy"
                            onLoad={() => setIsLoading(false)}
                            onError={() => setHasError(true)}
                            style={{ opacity: isLoading ? 0 : 1 }}
                        />

                        {allowLightbox && !isLoading && (
                            <div className="media-viewer__hover-overlay">
                                <div className="media-viewer__zoom-badge">
                                    <Maximize2 size={14} />
                                    <span>Expand Image</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Caption / Source bar */}
                {(caption || effectiveSourceUrl) && (
                    <div className="media-viewer__caption">
                        <div className="media-viewer__caption-text" title={caption || title}>
                            {caption || title || 'NASA Media Asset'}
                        </div>
                        {effectiveSourceUrl && (
                            <a
                                href={effectiveSourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="media-viewer__source-link"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <span>Source</span>
                                <ExternalLink size={12} />
                            </a>
                        )}
                    </div>
                )}
            </div>

            {/* Lightbox Modal */}
            {isLightboxOpen && resolved.kind === 'image' && (
                <div
                    className="media-lightbox media-viewer__lightbox"
                    onClick={() => setIsLightboxOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={title || 'Image Viewer'}
                >
                    <div className="media-lightbox__header" onClick={(e) => e.stopPropagation()}>
                        <div className="media-lightbox__title">{title || 'NASA High-Resolution Imagery'}</div>
                        <div className="media-lightbox__actions">
                            <a
                                href={effectiveSourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="media-lightbox__btn"
                            >
                                <span>Full Resolution</span>
                                <ExternalLink size={14} />
                            </a>
                            <button
                                className="media-lightbox__close"
                                onClick={() => setIsLightboxOpen(false)}
                                title="Close (Esc)"
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="media-lightbox__stage">
                        <img
                            className="media-lightbox__content"
                            src={resolved.imageUrl}
                            alt={caption || title || 'Full resolution imagery'}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {caption && (
                        <div className="media-lightbox__footer" onClick={(e) => e.stopPropagation()}>
                            {caption}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
