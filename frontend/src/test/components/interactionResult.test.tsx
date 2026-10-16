import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InteractionResult from '../../components/explore/InteractionResult';
import type { Interaction, ApodResult, NeowsResult, AnalysisResult, NasaImagesResult } from '../../types/planner';

describe('InteractionResult Routing & Resilience', () => {
    it('renders loading indicator with correct message for pending and processing states', () => {
        const pendingInteraction: Interaction = {
            id: 'int-1',
            space_plan: 1,
            user_prompt: 'Search stars',
            interaction_type: 'find_more',
            status: 'pending',
            response: {} as unknown as Interaction['response'],
            error_code: '',
            target_discoveries: [],
            added_discoveries: [],
            created_at: '2026-10-10T00:00:00Z',
            completed_at: null,
        };

        const { rerender } = render(<InteractionResult interaction={pendingInteraction} />);
        expect(screen.getByText('Waiting to process...')).toBeInTheDocument();

        const processingInteraction: Interaction = {
            ...pendingInteraction,
            status: 'processing',
        };
        rerender(<InteractionResult interaction={processingInteraction} />);
        expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('renders error card with error_code or fallback message when status is failed', () => {
        const failedWithCode: Interaction = {
            id: 'int-2',
            space_plan: 1,
            user_prompt: 'Search stars',
            interaction_type: 'find_more',
            status: 'failed',
            response: {} as unknown as Interaction['response'],
            error_code: 'RATE_LIMIT_EXCEEDED',
            target_discoveries: [],
            added_discoveries: [],
            created_at: '2026-10-10T00:00:00Z',
            completed_at: null,
        };

        const { rerender } = render(<InteractionResult interaction={failedWithCode} />);
        expect(screen.getByText('Request failed')).toBeInTheDocument();
        expect(screen.getByText('RATE_LIMIT_EXCEEDED')).toBeInTheDocument();

        const failedWithoutCode: Interaction = {
            ...failedWithCode,
            error_code: '',
        };
        rerender(<InteractionResult interaction={failedWithoutCode} />);
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    });

    it('routes analysis result_type to GeneralResultCard', () => {
        const analysisResponse: AnalysisResult = {
            result_type: 'analysis',
            content: {
                title: 'Stellar Evolution',
                summary: 'Analysis of main sequence stars',
                sections: [
                    { heading: 'Overview', content: 'Stars evolve over billions of years.' },
                ],
            },
            discoveries: [],
        };

        const interaction: Interaction = {
            id: 'int-3',
            space_plan: 1,
            user_prompt: 'Explain stellar evolution',
            interaction_type: 'enrich',
            status: 'completed',
            response: analysisResponse,
            error_code: '',
            target_discoveries: [],
            added_discoveries: [],
            created_at: '2026-10-10T00:00:00Z',
            completed_at: '2026-10-10T00:01:00Z',
        };

        render(<InteractionResult interaction={interaction} />);
        expect(screen.getByText('AI Analysis')).toBeInTheDocument();
        expect(screen.getByText('Stellar Evolution')).toBeInTheDocument();
        expect(screen.getByText('Stars evolve over billions of years.')).toBeInTheDocument();
    });

    it('routes representative specialized NASA result types to appropriate cards', () => {
        const apodResponse: ApodResult = {
            result_type: 'apod',
            content: {
                title: 'Nebula Over Horizon',
                date: '2026-10-12',
                explanation: 'A vivid deep sky image.',
                media_url: 'https://apod.nasa.gov/image.jpg',
                media_type: 'image',
            },
            discoveries: [],
        };

        const interactionApod: Interaction = {
            id: 'int-apod',
            space_plan: 1,
            user_prompt: 'Show APOD',
            interaction_type: 'find_more',
            status: 'completed',
            response: apodResponse,
            error_code: '',
            target_discoveries: [],
            added_discoveries: [],
            created_at: '2026-10-10T00:00:00Z',
            completed_at: '2026-10-10T00:01:00Z',
        };

        const { rerender } = render(<InteractionResult interaction={interactionApod} />);
        expect(screen.getByText(/Astronomy Picture/i)).toBeInTheDocument();
        expect(screen.getAllByText('Nebula Over Horizon')[0]).toBeInTheDocument();

        // Test NeoWs routing
        const neowsResponse: NeowsResult = {
            result_type: 'neows',
            content: {
                title: 'Near Earth Asteroids',
                summary: '5 asteroids tracked.',
                object_count: 5,
                date_range: { start: '2026-10-01', end: '2026-10-07' },
            },
            discoveries: [],
        };
        const interactionNeows: Interaction = {
            ...interactionApod,
            id: 'int-neows',
            response: neowsResponse,
        };
        rerender(<InteractionResult interaction={interactionNeows} />);
        expect(screen.getByText(/Near-Earth Object/i)).toBeInTheDocument();
        expect(screen.getByText('Near Earth Asteroids')).toBeInTheDocument();

        // Test NASA Images routing
        const nasaImagesResponse: NasaImagesResult = {
            result_type: 'nasa_images',
            content: {
                title: 'JWST Deep Field',
                summary: 'Earliest galaxies',
                query: 'deep field',
                item_count: 1,
                items: [],
            },
            discoveries: [],
        };
        const interactionImages: Interaction = {
            ...interactionApod,
            id: 'int-images',
            response: nasaImagesResponse,
        };
        rerender(<InteractionResult interaction={interactionImages} />);
        expect(screen.getByText(/NASA Media Archive/i)).toBeInTheDocument();
    });

    it('renders streamlined synthesis card when follow-up conversational synthesis and added discoveries exist', () => {
        const apodWithSynthesis: ApodResult = {
            result_type: 'apod',
            content: {
                title: 'Orion Nebula',
                date: '2026-10-15',
                explanation: 'Stars forming',
                media_url: 'https://apod.nasa.gov/orion.jpg',
                media_type: 'image',
            },
            discoveries: [10],
            metadata: {
                synthesis: 'I found an astronomy picture of Orion and added it to your plan.',
            },
        };

        const interaction: Interaction = {
            id: 'int-synth',
            space_plan: 1,
            user_prompt: 'Find Orion photo',
            interaction_type: 'find_more',
            status: 'completed',
            response: apodWithSynthesis,
            error_code: '',
            target_discoveries: [],
            added_discoveries: [10],
            created_at: '2026-10-10T00:00:00Z',
            completed_at: '2026-10-10T00:01:00Z',
        };

        render(<InteractionResult interaction={interaction} />);
        expect(screen.getByText('AI Analysis')).toBeInTheDocument();
        expect(screen.getByText(/I found an astronomy picture of Orion and added it to your plan/i)).toBeInTheDocument();
        expect(screen.getByText(/Added 1 new discovery/i)).toBeInTheDocument();
    });

    it('fails gracefully on unknown result types and malformed payloads without throwing', () => {
        // Unknown result_type
        const unknownResult = {
            result_type: 'unknown_exotic_payload',
            content: { title: 'Exotic Sensor Data' },
            discoveries: [],
        } as unknown as Interaction['response'];
        const interactionUnknown: Interaction = {
            id: 'int-unknown',
            space_plan: 1,
            user_prompt: 'Exotic scan',
            interaction_type: 'other',
            status: 'completed',
            response: unknownResult,
            error_code: '',
            target_discoveries: [],
            added_discoveries: [],
            created_at: '2026-10-10T00:00:00Z',
            completed_at: '2026-10-10T00:01:00Z',
        };

        const { rerender } = render(<InteractionResult interaction={interactionUnknown} />);
        expect(screen.getByText('Raw Content')).toBeInTheDocument();

        // Completely unrecognized response object without result_type
        const malformedResponse = { arbitrary_key: 'some_value' } as unknown as Interaction['response'];
        const interactionMalformed: Interaction = {
            ...interactionUnknown,
            response: malformedResponse,
        };
        rerender(<InteractionResult interaction={interactionMalformed} />);
        expect(screen.getByText(/"arbitrary_key": "some_value"/)).toBeInTheDocument();

        // Null response returns null safely
        const interactionNull: Interaction = {
            ...interactionUnknown,
            response: null as unknown as Interaction['response'],
        };
        const { container } = render(<InteractionResult interaction={interactionNull} />);
        expect(container.firstChild).toBeNull();
    });
});
