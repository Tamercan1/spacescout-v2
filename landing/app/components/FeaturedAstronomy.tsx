import Image from 'next/image';
import Link from 'next/link';
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

export async function FeaturedAstronomySection({ date }: { date?: string } = {}) {
  const item = await getFeaturedAstronomy(date);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173';

  // Construct exploration URL for the prompt bridge
  const exploreUrl = `${appUrl}/explore?query=${encodeURIComponent(
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
                {item.mediaType === 'image' ? (
                  <Image
                    src={item.url}
                    alt={item.title}
                    width={900}
                    height={600}
                    priority
                    unoptimized
                    className="astronomy-img"
                  />
                ) : item.mediaType === 'video' ? (
                  item.url.includes('youtube.com') ||
                  item.url.includes('youtu.be') ||
                  item.url.includes('vimeo.com') ? (
                    <iframe
                      src={item.url}
                      title={item.title}
                      className="astronomy-video-frame"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div
                      style={{
                        padding: '40px 24px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        color: 'var(--text-1)',
                      }}
                    >
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          background: 'var(--blue-dim)',
                          color: 'var(--blue)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
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
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        <ExternalLink size={14} />
                        Watch Video Feed
                      </a>
                    </div>
                  )
                ) : (
                  <div
                    style={{
                      padding: '40px',
                      color: 'var(--text-3)',
                      textAlign: 'center',
                    }}
                  >
                    Media format not previewable directly.
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
                {item.hdUrl && item.mediaType === 'image' && (
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
                    {item.mediaType === 'video' ? 'NASA Video' : 'NASA APOD'}
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
