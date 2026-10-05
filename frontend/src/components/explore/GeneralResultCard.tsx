import type { AnalysisResult, GenericResult, ResultSection } from '../../types/planner';
import ReactMarkdown from 'react-markdown';

interface GeneralResultCardProps {
    result: AnalysisResult | GenericResult;
}

/**
 * Renders an analysis-style interaction result or a generic fallback.
 * Supports a title and multiple sections, or raw generic content.
 */
export default function GeneralResultCard({ result }: GeneralResultCardProps) {
    const failures = result.metadata?.tool_failures as Array<{ tool: string; error: string }> | undefined;
    
    let title = "Tool Result";
    let renderContent: React.ReactNode;

    if (result.result_type === "analysis") {
        const analysis = result as AnalysisResult;
        title = analysis.content.title || title;
        renderContent = analysis.content.sections?.map((section: ResultSection, i: number) => (
            <div key={i} className="result-card__section">
                <div className="result-card__heading">{section.heading}</div>
                <div className="result-card__content react-markdown-content">
                    <ReactMarkdown>{section.content as string}</ReactMarkdown>
                </div>
            </div>
        ));
    } else {
        // GenericResult
        title = typeof result.content.title === 'string' ? result.content.title : title;
        renderContent = (
            <div className="result-card__section">
                <div className="result-card__heading">Raw Content</div>
                <div className="result-card__content" style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(result.content, null, 2)}
                </div>
            </div>
        );
    }

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

            {renderContent}
        </div>
    );
}


