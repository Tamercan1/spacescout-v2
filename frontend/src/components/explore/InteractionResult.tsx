import React from 'react';
import type { 
    Interaction, 
    InteractionResponse, 
    AnalysisResult,
    ApodResult,
    NeowsResult,
    DonkiResult,
    NasaImagesResult,
    EpicResult,
    GenericResult
} from '../../types/planner';
import GeneralResultCard from './GeneralResultCard';
import ApodResultCard from './ApodResultCard';
import NeowsResultCard from './NeowsResultCard';
import DonkiResultCard from './DonkiResultCard';
import NasaImagesResultCard from './NasaImagesResultCard';
import EpicResultCard from './EpicResultCard';
import { Loader2, AlertCircle, Key } from 'lucide-react';

// Central registry for dynamic result cards
const CardRegistry: {
    analysis: React.FC<{ result: AnalysisResult }>;
    apod: React.FC<{ result: ApodResult }>;
    neows: React.FC<{ result: NeowsResult }>;
    donki: React.FC<{ result: DonkiResult }>;
    nasa_images: React.FC<{ result: NasaImagesResult }>;
    epic: React.FC<{ result: EpicResult }>;
} = {
    analysis: GeneralResultCard,
    apod: ApodResultCard,
    neows: NeowsResultCard,
    donki: DonkiResultCard,
    nasa_images: NasaImagesResultCard,
    epic: EpicResultCard,
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
        const isMissingCred = error_code === 'missing_credential';
        const isInvalidCred = error_code === 'invalid_credential';
        const isRateLimit = error_code === 'provider_rate_limited' || error_code?.toLowerCase().includes('rate_limit');

        let userMsg = error_code || 'An unexpected error occurred. Please try again.';
        if (isMissingCred) {
            userMsg = 'No AI provider key is configured. Please add your OpenRouter API key in Settings to continue exploring.';
        } else if (isInvalidCred) {
            userMsg = 'The configured OpenRouter API key was rejected or invalid. Please check your key in Settings.';
        } else if (response && typeof response === 'object' && 'error' in response && typeof (response as { error?: string }).error === 'string') {
            const rawErr = (response as { error: string }).error;
            if (!rawErr.toLowerCase().includes('traceback') && !rawErr.toLowerCase().includes('exception')) {
                userMsg = rawErr;
            }
        }

        return (
            <div className="result-card result-card--error">
                <div className="result-card__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={15} color="var(--red)" />
                    <span>Request failed</span>
                </div>
                <div className="result-card__content" style={{ marginTop: '6px', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {userMsg}
                </div>
                {(isMissingCred || isInvalidCred || isRateLimit) && (
                    <div style={{ marginTop: '10px' }}>
                        <a
                            href="/settings?tab=credentials"
                            className="btn btn-secondary"
                            style={{
                                fontSize: '0.78rem',
                                padding: '5px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                textDecoration: 'none'
                            }}
                        >
                            <Key size={13} />
                            <span>Configure API Keys in Settings</span>
                        </a>
                    </div>
                )}
            </div>
        );
    }

    // status === 'completed' — route based on result_type
    const typedResponse = response as InteractionResponse;

    if (typedResponse && 'result_type' in typedResponse) {
        const addedCount = interaction.added_discoveries?.length ?? 0;
        const responseTargetDiscoveries = 'target_discoveries' in typedResponse && Array.isArray(typedResponse.target_discoveries)
            ? typedResponse.target_discoveries
            : undefined;
        const targetCount = interaction.target_discoveries?.length ?? responseTargetDiscoveries?.length ?? 0;
        const synthesis = (typedResponse.metadata?.synthesis as string | undefined)?.trim();

        // In follow-up interactions: if conversational synthesis exists and new discoveries were created,
        // render the streamlined AI response card with the discovery badge instead of duplicating
        // full-sized tool cards in the stream (the full discovery card is already visible in the feed).
        if (synthesis && addedCount > 0 && typedResponse.result_type !== "analysis") {
            const cleanSynthesis = synthesis
                .replace(/!\[.*?\]\(.*?\)/g, '')
                .replace(/^\s*(?:image|photo|media):\s*$/gim, '')
                .trim();

            const syntheticAnalysis: AnalysisResult = {
                result_type: "analysis",
                content: {
                    title: "Response",
                    summary: "AI Response",
                    sections: [
                        {
                            heading: "Response",
                            content: cleanSynthesis
                        }
                    ]
                },
                discoveries: Array.isArray(typedResponse.discoveries) ? typedResponse.discoveries : [],
                metadata: typedResponse.metadata || {}
            };
            return <GeneralResultCard result={syntheticAnalysis} addedCount={addedCount} referencedCount={targetCount} />;
        }

        if (typedResponse.result_type === "analysis") {
            return <GeneralResultCard result={typedResponse as AnalysisResult} addedCount={addedCount} referencedCount={targetCount} />;
        }

        const resultType = typedResponse.result_type as keyof typeof CardRegistry;
        const CardComponent = CardRegistry[resultType];
        
        if (CardComponent) {
            // A safe upcast for the dynamically looked-up component
            const Component = CardComponent as React.FC<{ result: InteractionResponse }>;
            return <Component result={typedResponse} />;
        }
        
        return <GeneralResultCard result={typedResponse as GenericResult} addedCount={addedCount} referencedCount={targetCount} />;
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

