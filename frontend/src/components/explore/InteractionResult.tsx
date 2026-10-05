import React from 'react';
import type { 
    Interaction, 
    InteractionResponse, 
    AnalysisResult,
    ApodResult,
    NeowsResult,
    DonkiResult,
    GenericResult
} from '../../types/planner';
import GeneralResultCard from './GeneralResultCard';
import ApodResultCard from './ApodResultCard';
import NeowsResultCard from './NeowsResultCard';
import DonkiResultCard from './DonkiResultCard';
import { Loader2 } from 'lucide-react';

// Central registry for dynamic result cards
const CardRegistry: {
    analysis: React.FC<{ result: AnalysisResult }>;
    apod: React.FC<{ result: ApodResult }>;
    neows: React.FC<{ result: NeowsResult }>;
    donki: React.FC<{ result: DonkiResult }>;
} = {
    analysis: GeneralResultCard,
    apod: ApodResultCard,
    neows: NeowsResultCard,
    donki: DonkiResultCard,
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
        const resultType = typedResponse.result_type as keyof typeof CardRegistry;
        const CardComponent = CardRegistry[resultType];
        
        if (CardComponent) {
            // A safe upcast for the dynamically looked-up component
            const Component = CardComponent as React.FC<{ result: InteractionResponse }>;
            return <Component result={typedResponse} />;
        }
        
        // Fallback for unknown result types (Phase 5.6 requirements)
        // Wraps the unknown content into a format GeneralResultCard can display
        // Preserves the original result_type by casting to GenericResult
        return <GeneralResultCard result={typedResponse as GenericResult} />;
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

