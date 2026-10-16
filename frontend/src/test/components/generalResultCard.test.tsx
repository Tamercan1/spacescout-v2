import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GeneralResultCard from '../../components/explore/GeneralResultCard';
import type { AnalysisResult, GenericResult } from '../../types/planner';

describe('GeneralResultCard Component', () => {
    it('renders representative markdown content across multiple sections', () => {
        const analysis: AnalysisResult = {
            result_type: 'analysis',
            content: {
                title: 'Solar Flare Analysis',
                summary: 'M-class flare event',
                sections: [
                    {
                        heading: 'Primary Findings',
                        content: 'An **M2.5 solar flare** erupted from active region *AR3182*.',
                    },
                    {
                        heading: 'Coronal Mass Ejection',
                        content: '- Velocity: 850 km/s\n- Earth-directed: Minimal',
                    },
                ],
            },
            discoveries: [],
        };

        render(<GeneralResultCard result={analysis} />);

        expect(screen.getByText('Solar Flare Analysis')).toBeInTheDocument();
        expect(screen.getByText('Primary Findings')).toBeInTheDocument();
        expect(screen.getByText('M2.5 solar flare')).toBeInTheDocument();
        expect(screen.getByText('AR3182')).toBeInTheDocument();
        expect(screen.getByText('Coronal Mass Ejection')).toBeInTheDocument();
        expect(screen.getByText(/Velocity: 850 km\/s/i)).toBeInTheDocument();
    });

    it('displays partial tool-failure alerts when failures metadata is present', () => {
        const resultWithFailures: AnalysisResult = {
            result_type: 'analysis',
            content: {
                title: 'Partial Data',
                summary: 'Some tools failed',
                sections: [{ heading: 'Response', content: 'Data is incomplete.' }],
            },
            discoveries: [],
            metadata: {
                tool_failures: [
                    { tool: 'nasa_donki', error: 'Service Unavailable (503)' },
                    { tool: 'nasa_epic', error: 'Timeout after 10s' },
                ],
            },
        };

        render(<GeneralResultCard result={resultWithFailures} />);

        expect(screen.getByText('Partial Failures:')).toBeInTheDocument();
        expect(screen.getByText(/• nasa_donki: Service Unavailable \(503\)/)).toBeInTheDocument();
        expect(screen.getByText(/• nasa_epic: Timeout after 10s/)).toBeInTheDocument();
    });

    it('displays added and referenced discovery counts with correct singular/plural wording', () => {
        const baseResult: AnalysisResult = {
            result_type: 'analysis',
            content: {
                title: 'Cosmic Scan',
                summary: 'Scan summary',
                sections: [{ heading: 'Response', content: 'Found objects.' }],
            },
            discoveries: [],
        };

        // 1 added discovery (singular)
        const { rerender } = render(<GeneralResultCard result={baseResult} addedCount={1} />);
        expect(screen.getByText('Added 1 new discovery')).toBeInTheDocument();

        // 3 added discoveries (plural)
        rerender(<GeneralResultCard result={baseResult} addedCount={3} />);
        expect(screen.getByText('Added 3 new discoveries')).toBeInTheDocument();

        // 1 referenced discovery (singular)
        rerender(<GeneralResultCard result={baseResult} referencedCount={1} />);
        expect(screen.getByText('Referenced 1 discovery')).toBeInTheDocument();

        // 2 referenced discoveries (plural)
        rerender(<GeneralResultCard result={baseResult} referencedCount={2} />);
        expect(screen.getByText('Referenced 2 discoveries')).toBeInTheDocument();
    });

    it('renders generic fallback card with raw content when result_type is not analysis', () => {
        const genericResult: GenericResult = {
            result_type: 'custom_generic' as unknown as 'analysis',
            content: {
                title: 'Sensor Feed',
                data_points: [12, 18, 24],
            },
            discoveries: [],
        };

        render(<GeneralResultCard result={genericResult} />);

        expect(screen.getByText('Sensor Feed')).toBeInTheDocument();
        expect(screen.getByText('Raw Content')).toBeInTheDocument();
        expect(screen.getByText(/"data_points":/)).toBeInTheDocument();
    });
});
