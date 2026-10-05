import type { ApodResult } from '../../types/planner';

interface ApodResultCardProps {
    result: ApodResult;
}

export default function ApodResultCard({ result }: ApodResultCardProps) {
    const { title, date, explanation, media_url, media_type } = result.content;
    const failures = result.metadata?.tool_failures as Array<{ tool: string; error: string }> | undefined;

    return (
        <div className="result-card">
            <div className="result-card__title">
                <span style={{ marginRight: '8px' }}>📸</span>
                {title}
            </div>
            
            <div className="result-card__meta" style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '12px' }}>
                Date: {date}
            </div>

            {failures && failures.length > 0 && (
                <div className="result-card__error-metadata" style={{ padding: '8px', marginBottom: '12px', backgroundColor: 'rgba(255, 50, 50, 0.1)', borderLeft: '3px solid var(--danger)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>Partial Failures:</div>
                    {failures.map((f, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>• {f.tool}: {f.error}</div>
                    ))}
                </div>
            )}

            {media_url && media_type === "image" && (
                <div className="result-card__media" style={{ marginBottom: '16px' }}>
                    <img src={media_url} alt={title} style={{ width: '100%', borderRadius: '4px' }} />
                </div>
            )}

            {media_url && media_type === "video" && (
                <div className="result-card__media" style={{ marginBottom: '16px' }}>
                    <iframe src={media_url} title={title} style={{ width: '100%', aspectRatio: '16/9', border: 'none', borderRadius: '4px' }} allowFullScreen />
                </div>
            )}

            <div className="result-card__content">
                {explanation}
            </div>
        </div>
    );
}
