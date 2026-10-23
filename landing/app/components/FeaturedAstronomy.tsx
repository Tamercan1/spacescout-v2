import Image from 'next/image';
import Link from 'next/link';
import { AstronomyImage } from './AstronomyImage';
import {
  Calendar,
  Sparkles,
  ExternalLink,
  Video,
  Eye,
  Rocket,
  ShieldAlert,
} from 'lucide-react';
import { getFeaturedAstronomy } from '@/lib/nasa';
import { getAppUrl } from '@/lib/config';
import { resolveAstronomyMedia } from '@/lib/media';

export async function FeaturedAstronomySection({ date }: { date?: string } = {}) {
  const item = await getFeaturedAstronomy(date);
  const appUrl = getAppUrl();
  const media = resolveAstronomyMedia(item.url, item.mediaType);

  // Construct exploration URL for the prompt bridge using documented prompt parameter
  const exploreUrl = `${appUrl}/explore?prompt=${encodeURIComponent(
    `Tell me about ${item.title} discovered on ${item.date}`
  )}`;

  return (
    <section id="featured-astronomy" className="section" style={{ paddingTop: '20px' }}>
      <div className="container">
        {/* Section Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              <span className="badge badge-blue">
                <Sparkles size={12} />
                NASA Astronomy Picture of the Day
              </span>
              {item.isFallback ? (
                <span className="badge badge-amber" title={item.statusNotice}>
                  <ShieldAlert size={12} />
                  Archived Feature
                </span>
              ) : (
                <span className="badge badge-green">
                  <span className="pulse-dot" />
                  Live
                </span>
              )}
              {date && (
                <Link
                  href="/"
                  className="badge badge-purple"
                  title="Viewing custom date. Click to return to today's feature."
                  style={{ textDecoration: 'none' }}
                >
                  {date} ✕
                </Link>
              )}
            </div>
            <h2
              style={{
                fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Featured Astronomy Discovery
            </h2>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.88rem',
              color: 'var(--text-2)',
            }}
          >
            <Calendar size={14} />
            <span>{item.date}</span>
          </div>
        </div>

        {/* Featured Card */}
        <div className="astronomy-card">
          <div className="astronomy-grid">
            {/* Media Column */}
            <div className="astronomy-media-col">
              <div className="astronomy-media-wrap">
                {media.kind === 'image' ? (
                  <AstronomyImage
                    src={media.src}
                    alt={item.title}
                  />
                ) : media.kind === 'youtube' || media.kind === 'vimeo' || media.kind === 'iframe' ? (
                  <iframe
                    src={media.embedUrl}
                    title={item.title}
                    className="astronomy-video-frame"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : media.kind === 'video' ? (
                  <video
                    src={media.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="astronomy-video-player"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="astronomy-video-portal">
                    <div className="astronomy-video-portal__icon">
                      <Video size={28} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                        Video Presentation
                      </div>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-2)', maxWidth: '300px' }}>
                        This NASA feature is an external astronomical video.
                      </p>
                    </div>
                    <a
                      href={media.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      <ExternalLink size={14} />
                      Watch Video Feed
                    </a>
                  </div>
                )}
              </div>

              {/* Media Footer Attribution */}
              <div className="astronomy-media-footer">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.copyright
                    ? `Credit & Copyright: ${item.copyright}`
                    : 'Image Credit: NASA / Science Operations'}
                </span>
                {item.hdUrl && media.kind === 'image' && (
                  <a
                    href={item.hdUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  >
                    <Eye size={12} />
                    Full HD
                  </a>
                )}
              </div>
            </div>

            {/* Content Column */}
            <div className="astronomy-content-col">
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                  }}
                >
                  <span className="badge badge-blue">
                    {media.kind === 'image' ? 'NASA APOD' : 'NASA Video'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-3)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {item.date}
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 700,
                    letterSpacing: '-0.015em',
                    lineHeight: 1.3,
                    color: 'var(--text-1)',
                    marginBottom: '18px',
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    color: 'var(--text-2)',
                    fontSize: '0.96rem',
                    lineHeight: 1.7,
                    marginBottom: '24px',
                  }}
                >
                  {item.explanation}
                </p>
              </div>

              {/* Exploration Prompt Bridge */}
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>
                  Explore this discovery with SpaceScout&apos;s AI planner
                </div>
                <a
                  href={exploreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  <Rocket size={15} />
                  Explore in SpaceScout
                  <ExternalLink size={13} style={{ opacity: 0.7 }} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
