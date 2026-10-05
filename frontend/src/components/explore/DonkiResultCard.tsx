import type { DonkiResult } from '../../types/planner';

interface DonkiResultCardProps {
    result: DonkiResult;
}

export default function DonkiResultCard({ result }: DonkiResultCardProps) {
    const { title, summary, event_count, date_range } = result.content;
    const failures = result.metadata?.tool_failures as Array<{ tool: string; error: string }> | undefined;

    return (
        <div className="result-card">
            <div className="result-card__title">
                <span style={{ marginRight: '8px' }}>☀️</span>
                {title}
            </div>
            
            <div className="result-card__meta" style={{ display: 'flex', gap: '16px', color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '12px' }}>
                <span>Events found: <strong>{event_count}</strong></span>
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
