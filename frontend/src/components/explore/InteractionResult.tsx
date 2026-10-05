import React from 'react';
import type { 
    Interaction, 
    InteractionResponse, 
    AnalysisResult
} from '../../types/planner';
import GeneralResultCard from './GeneralResultCard';
import ApodResultCard from './ApodResultCard';
import NeowsResultCard from './NeowsResultCard';
import DonkiResultCard from './DonkiResultCard';
import { Loader2 } from 'lucide-react';

// Central registry for dynamic result cards
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CardRegistry: Record<string, React.FC<{ result: any }>> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    analysis: GeneralResultCard as React.FC<{ result: any }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apod: ApodResultCard as React.FC<{ result: any }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    neows: NeowsResultCard as React.FC<{ result: any }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    donki: DonkiResultCard as React.FC<{ result: any }>,
};

interface InteractionResultProps {
    interaction: Interaction;
}

/**
 * Routes an Interaction's response to the appropriate result renderer.
 * Uses a CardRegistry based on the response's result_type.
 * Unknown types gracefully fall back to the generic GeneralResultCard.
 */
export default function InteractionResult({ interaction }: InteractionResultProps) {
    const { status, response, error_code } = interaction;

    if (status === 'pending' || status === 'processing') {
        return (
            <div className="result-card result-card--loading">
                <Loader2 size={16} className="spinner" />
                <span>{status === 'pending' ? 'Waiting to process...' : 'Processing...'}</span>
            </div>
        );
    }

    if (status === 'failed') {
        return (
            <div className="result-card result-card--error">
                <div className="result-card__title">Request failed</div>
                <div className="result-card__content">
                    {error_code || 'An unexpected error occurred. Please try again.'}
                </div>
            </div>
        );
    }

    // status === 'completed' — route based on result_type
    const typedResponse = response as InteractionResponse;

    if (typedResponse && 'result_type' in typedResponse) {
        const CardComponent = CardRegistry[typedResponse.result_type];
        
        if (CardComponent) {
            return <CardComponent result={typedResponse} />;
        }
        
        // Fallback for unknown result types (Phase 5.6 requirements)
        // Wraps the unknown content into a format GeneralResultCard can display
        const fallbackResult: AnalysisResult = {
            result_type: "analysis",
            content: {
                title: "Tool Result",
                summary: "Data from an external source.",
                sections: [
                    { heading: "Raw Content", content: JSON.stringify(typedResponse.content, null, 2) }
                ]
            },
            discoveries: typedResponse.discoveries || [],
            metadata: typedResponse.metadata
        };
        
        return <GeneralResultCard result={fallbackResult} />;
    }

    // Ultimate fallback for completely unrecognized or empty responses
    if (response && Object.keys(response).length > 0) {
        return (
            <div className="result-card">
                <div className="result-card__content" style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(response, null, 2)}
                </div>
            </div>
        );
    }

    return null;
}

