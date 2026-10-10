import type { EpicResult } from '../../types/planner';
import { ExternalLink } from 'lucide-react';
import MediaViewer from '../common/MediaViewer';

interface EpicResultCardProps {
    result: EpicResult;
}

export default function EpicResultCard({ result }: EpicResultCardProps) {
    const { title, summary, date, image_count, images } = result.content;
    const failures = result.metadata?.tool_failures as Array<{ tool: string; error: string }> | undefined;

    return (
        <div className="result-card result-card--epic">
            <div className="result-card__badge result-card__badge--epic">
                <span>🌍 Earth from DSCOVR EPIC</span>
            </div>
            <div className="result-card__title">
                {title || 'Earth from DSCOVR EPIC'}
            </div>

            <div className="result-card__meta" style={{ display: 'flex', gap: '16px', color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '12px', flexWrap: 'wrap' }}>
                {date && <span>Observation Date: <strong>{date}</strong></span>}
                <span>Observations: <strong>{image_count ?? images?.length ?? 0}</strong></span>
                <span>Location: <strong>Sun-Earth L1 (1M miles)</strong></span>
            </div>

            {failures && failures.length > 0 && (
                <div className="result-card__error-metadata" style={{ padding: '8px', marginBottom: '12px', backgroundColor: 'rgba(255, 50, 50, 0.1)', borderLeft: '3px solid var(--danger)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>Partial Failures:</div>
                    {failures.map((f, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>• {f.tool}: {f.error}</div>
                    ))}
                </div>
            )}

            <div className="result-card__content" style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: images && images.length > 0 ? '12px' : '0' }}>
                {summary}
            </div>

            {images && images.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '10px' }}>
                    {images.map((img, idx) => (
                        <div 
                            key={img.identifier || idx}
                            style={{ 
                                backgroundColor: 'var(--surface-2, rgba(255, 255, 255, 0.04))', 
                                border: '1px solid var(--border)', 
                                borderRadius: '8px', 
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {img.image_url && (
                                <MediaViewer
                                    url={img.image_url}
                                    title={img.caption || `Earth observation ${img.date}`}
                                    caption={img.caption || `Earth observation ${img.date}`}
                                    sourceUrl="https://epic.gsfc.nasa.gov"
                                    allowLightbox={true}
                                />
                            )}
                            <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 500 }}>
                                    {img.caption || 'Full-disc Earth view'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
                                    <span>Time: {img.date.split(' ')[1] || img.date}</span>
                                    {img.centroid_coordinates && (
                                        <span>
                                            {img.centroid_coordinates.lat?.toFixed(1)}°, {img.centroid_coordinates.lon?.toFixed(1)}°
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="result-card__footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <a
                    href="https://epic.gsfc.nasa.gov"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8rem', color: 'var(--blue, #38bdf8)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                >
                    <span>DSCOVR EPIC Mission Archive</span>
                    <ExternalLink size={12} />
                </a>
            </div>
        </div>
    );
}
