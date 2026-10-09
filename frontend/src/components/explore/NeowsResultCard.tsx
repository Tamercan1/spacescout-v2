import type { NeowsResult } from '../../types/planner';

interface NeowsResultCardProps {
    result: NeowsResult;
}

export default function NeowsResultCard({ result }: NeowsResultCardProps) {
    const { title, summary, object_count, date_range } = result.content;
    const failures = result.metadata?.tool_failures as Array<{ tool: string; error: string }> | undefined;

    return (
        <div className="result-card result-card--neows">
            <div className="result-card__badge result-card__badge--neows">
                <span>☄️ Near-Earth Object</span>
            </div>
            <div className="result-card__title">
                {title}
            </div>
            
            <div className="result-card__meta" style={{ display: 'flex', gap: '16px', color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '12px' }}>
                <span>Objects found: <strong>{object_count}</strong></span>
                {date_range && (
                    <span>Range: {date_range.start} to {date_range.end}</span>
                )}
            </div>

            {failures && failures.length > 0 && (
                <div className="result-card__error-metadata" style={{ padding: '8px', marginBottom: '12px', backgroundColor: 'rgba(255, 50, 50, 0.1)', borderLeft: '3px solid var(--danger)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>Partial Failures:</div>
                    {failures.map((f, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>• {f.tool}: {f.error}</div>
                    ))}
                </div>
            )}

            <div className="result-card__content">
                {summary}
            </div>
        </div>
    );
}
