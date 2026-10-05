import type { AnalysisResult } from '../../types/planner';

interface GeneralResultCardProps {
    result: AnalysisResult;
}

/**
 * Renders an analysis-style interaction result.
 * Supports a title and multiple sections with headings and content.
 */
export default function GeneralResultCard({ result }: GeneralResultCardProps) {
    const { title, sections } = result.content;
    const failures = result.metadata?.tool_failures as Array<{ tool: string; error: string }> | undefined;

    return (
        <div className="result-card">
            <div className="result-card__title">{title}</div>
            
            {failures && failures.length > 0 && (
                <div className="result-card__error-metadata" style={{ padding: '8px', marginBottom: '12px', backgroundColor: 'rgba(255, 50, 50, 0.1)', borderLeft: '3px solid var(--danger)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>Partial Failures:</div>
                    {failures.map((f, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>• {f.tool}: {f.error}</div>
                    ))}
                </div>
            )}

            {sections?.map((section, i) => (
                <div key={i} className="result-card__section">
                    <div className="result-card__heading">{section.heading}</div>
                    <div className="result-card__content">{section.content}</div>
                </div>
            ))}
        </div>
    );
}

