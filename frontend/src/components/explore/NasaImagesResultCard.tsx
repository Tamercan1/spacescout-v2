import type { NasaImagesResult } from '../../types/planner';
import MediaViewer from '../common/MediaViewer';

interface NasaImagesResultCardProps {
    result: NasaImagesResult;
}

export default function NasaImagesResultCard({ result }: NasaImagesResultCardProps) {
    const { title, summary, query, item_count, items } = result.content;
    const failures = result.metadata?.tool_failures as Array<{ tool: string; error: string }> | undefined;

    const matchesCount = item_count ?? items?.length ?? 0;

    return (
        <div className="result-card result-card--nasa-images">
            <div className="result-card__badge result-card__badge--nasa-images">
                <span>🌌 NASA Media Archive</span>
            </div>
            <div className="result-card__title">
                {title || `NASA Media Archive: ${query}`}
            </div>

            <div className="result-card__meta" style={{ display: 'flex', gap: '16px', color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '12px' }}>
                <span>Query: <strong>"{query}"</strong></span>
                <span>Matches: <strong>{matchesCount}</strong></span>
            </div>

            {failures && failures.length > 0 && (
                <div className="result-card__error-metadata" style={{ padding: '8px', marginBottom: '12px', backgroundColor: 'rgba(255, 50, 50, 0.1)', borderLeft: '3px solid var(--danger)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>Partial Failures:</div>
                    {failures.map((f, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>• {f.tool}: {f.error}</div>
                    ))}
                </div>
            )}

            <div className="result-card__content" style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: items && items.length > 0 ? '16px' : '0' }}>
                {summary}
            </div>

            {matchesCount === 0 && (
                <div style={{ marginTop: '10px', fontSize: '0.82rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
                    Tip: NASA Image search works best with specific entity or mission names (e.g. <code>OSIRIS-REx</code>, <code>Bennu</code>, <code>James Webb</code>, <code>Apollo 11</code>).
                </div>
            )}

            {items && items.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '10px' }}>
                    {items.map((item, idx) => (
                        <div 
                            key={item.nasa_id || idx}
                            style={{ 
                                backgroundColor: 'var(--surface-2, rgba(255, 255, 255, 0.04))', 
                                border: '1px solid var(--border)', 
                                borderRadius: '8px', 
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {item.image_url && (
                                <MediaViewer
                                    url={item.image_url}
                                    title={item.title}
                                    caption={item.title}
                                    sourceUrl={item.image_url}
                                    allowLightbox={true}
                                />
                            )}
                            <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-1)', lineHeight: '1.3' }}>
                                    {item.title}
                                </div>
                                {item.description && (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {item.description}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px' }}>
                                    {item.center && <span>Center: {item.center}</span>}
                                    {item.date_created && <span>{item.date_created.split('T')[0]}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
