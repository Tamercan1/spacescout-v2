import type { ApodResult } from '../../types/planner';

interface ApodResultCardProps {
    result: ApodResult;
}

export default function ApodResultCard({ result }: ApodResultCardProps) {
    const { title, date } = result.content;
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

            <div className="result-card__content" style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>
                Astronomy Picture of the Day successfully retrieved and added to your discoveries above.
            </div>
        </div>
    );
}
