import type { Interaction, InteractionResponse, AnalysisResult } from '../../types/planner';
import GeneralResultCard from './GeneralResultCard';
import { Loader2 } from 'lucide-react';

interface InteractionResultProps {
    interaction: Interaction;
}

/**
 * Routes an Interaction's response to the appropriate result renderer.
 * Uses the response's result_type to determine which card to use.
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
        switch (typedResponse.result_type) {
            case 'analysis':
                return <GeneralResultCard result={typedResponse as AnalysisResult} />;
            case 'discovery':
                // Future: DiscoveryResultCard
                return (
                    <div className="result-card">
                        <div className="result-card__title">New discoveries found</div>
                        <div className="result-card__content">
                            Discovery results will be rendered here in a future batch.
                        </div>
                    </div>
                );
            default:
                break;
        }
    }

    // Fallback for unrecognized or empty responses
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
