import { useState } from 'react';
import type { ApodResult } from '../../types/planner';
import MediaViewer from '../common/MediaViewer';

interface ApodResultCardProps {
    result: ApodResult;
}

export default function ApodResultCard({ result }: ApodResultCardProps) {
    const { title, date, explanation, media_url, media_type, permalink } = result.content;
    const failures = result.metadata?.tool_failures as Array<{ tool: string; error: string }> | undefined;
    const [expanded, setExpanded] = useState(false);

    const isLongText = explanation && explanation.length > 220;
    const displayText = isLongText && !expanded ? `${explanation.slice(0, 220)}...` : explanation;

    return (
        <div className="result-card result-card--apod">
            <div className="result-card__badge result-card__badge--apod">
                <span>📸 Astronomy Picture</span>
            </div>
            <div className="result-card__title">
                {title || 'NASA Astronomy Picture of the Day'}
            </div>

            <div className="result-card__meta" style={{ display: 'flex', gap: '16px', color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '14px' }}>
                {date && <span>Feature Date: <strong>{date}</strong></span>}
                {media_type && <span>Media: <strong>{media_type.toUpperCase()}</strong></span>}
            </div>

            {failures && failures.length > 0 && (
                <div className="result-card__error-metadata" style={{ padding: '8px', marginBottom: '12px', backgroundColor: 'rgba(255, 50, 50, 0.1)', borderLeft: '3px solid var(--danger)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>Partial Failures:</div>
                    {failures.map((f, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>• {f.tool}: {f.error}</div>
                    ))}
                </div>
            )}

            {media_url && (
                <MediaViewer
                    url={media_url}
                    mediaType={media_type}
                    title={title}
                    caption={title}
                    sourceUrl={permalink || `https://apod.nasa.gov/apod/ap${date ? date.replace(/-/g, '').slice(2) : ''}.html`}
                />
            )}

            {explanation && (
                <div className="result-card__content" style={{ color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    {displayText}
                    {isLongText && (
                        <button
                            type="button"
                            onClick={() => setExpanded(!expanded)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--blue)',
                                cursor: 'pointer',
                                padding: '0 0 0 6px',
                                fontSize: '0.85rem',
                                fontWeight: 500
                            }}
                        >
                            {expanded ? 'Show less' : 'Read more'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
