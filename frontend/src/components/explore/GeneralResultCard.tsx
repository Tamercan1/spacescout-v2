import type { AnalysisResult } from '../../types/planner';

interface GeneralResultCardProps {
    result: AnalysisResult;
}

/**
 * Renders an analysis-style interaction result.
 * Supports a title and multiple sections with headings and content.
 */
export default function GeneralResultCard({ result }: GeneralResultCardProps) {
    return (
        <div className="result-card">
            <div className="result-card__title">{result.title}</div>
            {result.sections?.map((section, i) => (
                <div key={i} className="result-card__section">
                    <div className="result-card__heading">{section.heading}</div>
                    <div className="result-card__content">{section.content}</div>
                </div>
            ))}
        </div>
    );
}
