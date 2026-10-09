import type { AnalysisResult, GenericResult, ResultSection } from '../../types/planner';
import ReactMarkdown from 'react-markdown';
import { Sparkles } from 'lucide-react';

interface GeneralResultCardProps {
    result: AnalysisResult | GenericResult;
    addedCount?: number;
    referencedCount?: number;
    discoveryCount?: number;
}

/**
 * Renders an analysis-style interaction result or a generic fallback.
 * Supports a title and streamlined markdown content, with optional discovery indicators.
 */
export default function GeneralResultCard({ result, addedCount, referencedCount, discoveryCount }: GeneralResultCardProps) {
    const failures = result.metadata?.tool_failures as Array<{ tool: string; error: string }> | undefined;
    
    let title = "Response";
    let renderContent: React.ReactNode;

    const effectiveAddedCount = addedCount ?? discoveryCount ?? 0;
    const effectiveReferencedCount = referencedCount ?? 0;

    if (result.result_type === "analysis") {
        const analysis = result as AnalysisResult;
        const rawTitle = analysis.content.title || "";
        if (rawTitle && rawTitle !== "Consolidated Analysis" && rawTitle !== "Analysis Result") {
            title = rawTitle;
        } else {
            title = "Response";
        }

        renderContent = analysis.content.sections?.map((section: ResultSection, i: number) => {
            const isSingleOrGenericHeading = 
                analysis.content.sections.length === 1 ||
                section.heading === "Response" || 
                section.heading === "Synthesis";

            return (
                <div key={i} className="result-card__section">
                    {!isSingleOrGenericHeading && section.heading && (
                        <div className="result-card__heading">{section.heading}</div>
                    )}
                    <div className="result-card__content react-markdown-content">
                        <ReactMarkdown>{section.content as string}</ReactMarkdown>
                    </div>
                </div>
            );
        });
    } else {
        // GenericResult
        title = typeof result.content.title === 'string' ? result.content.title : "Result";
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
        <div className="result-card result-card--analysis">
            <div className="result-card__badge result-card__badge--analysis">
                <Sparkles size={11} />
                <span>AI Analysis</span>
            </div>
            <div className="result-card__header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                <div className="result-card__title" style={{ margin: 0 }}>{title}</div>
                {effectiveAddedCount > 0 ? (
                    <div className="result-card__discovery-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.12)', color: 'var(--blue, #38bdf8)', border: '1px solid rgba(56, 189, 248, 0.25)', fontWeight: 500 }}>
                        <Sparkles size={13} />
                        <span>Added {effectiveAddedCount} new discover{effectiveAddedCount === 1 ? 'y' : 'ies'}</span>
                    </div>
                ) : effectiveReferencedCount > 0 ? (
                    <div className="result-card__discovery-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(148, 163, 184, 0.12)', color: 'var(--text-2)', border: '1px solid var(--border)', fontWeight: 500 }}>
                        <span>Referenced {effectiveReferencedCount} discover{effectiveReferencedCount === 1 ? 'y' : 'ies'}</span>
                    </div>
                ) : null}
            </div>
            
            {failures && failures.length > 0 && (
                <div className="result-card__error-metadata" style={{ padding: '8px 12px', marginBottom: '12px', backgroundColor: 'rgba(255, 50, 50, 0.1)', borderLeft: '3px solid var(--danger)', borderRadius: '4px' }}>
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


