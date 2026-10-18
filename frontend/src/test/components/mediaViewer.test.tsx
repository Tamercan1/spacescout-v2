import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MediaViewer from '../../components/common/MediaViewer';

describe('MediaViewer Component', () => {
    it('returns null when url is empty or undefined', () => {
        const { container } = render(<MediaViewer url="" />);
        expect(container.firstChild).toBeNull();
    });

    it('renders native HTML5 video element for direct MP4 video URLs', () => {
        const videoUrl = 'https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/2026/october/CRS35-Holland30s1080p.mp4';
        const { container } = render(
            <MediaViewer
                url={videoUrl}
                mediaType="video"
                title="Chasing the International Space Station"
            />
        );

        const video = container.querySelector('video');
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute('src', videoUrl);
        expect(video).toHaveAttribute('controls');

        // Check caption/title
        expect(screen.getByText('Chasing the International Space Station')).toBeInTheDocument();
    });

    it('renders YouTube iframe player with privacy-enhanced nocookie embed', () => {
        const youtubeUrls = [
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://youtu.be/dQw4w9WgXcQ',
            'https://www.youtube.com/embed/dQw4w9WgXcQ',
            'https://www.youtube.com/shorts/dQw4w9WgXcQ',
            '//www.youtube.com/watch?v=dQw4w9WgXcQ',
        ];

        for (const url of youtubeUrls) {
            const { container, unmount } = render(
                <MediaViewer url={url} mediaType="video" title="Rick Astley" />
            );

            const iframe = container.querySelector('iframe');
            expect(iframe).toBeInTheDocument();
            expect(iframe?.getAttribute('src')).toBe(
                'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1'
            );
            unmount();
        }
    });

    it('renders Vimeo iframe player for Vimeo URLs', () => {
        const vimeoUrl = 'https://vimeo.com/76979871';
        const { container } = render(
            <MediaViewer url={vimeoUrl} mediaType="video" title="Vimeo Reel" />
        );

        const iframe = container.querySelector('iframe');
        expect(iframe).toBeInTheDocument();
        expect(iframe?.getAttribute('src')).toBe('https://player.vimeo.com/video/76979871');
    });

    it('renders dedicated Portal view for article/webpage video features instead of failing in <video>', () => {
        const portalUrl = 'https://science.nasa.gov/image-article/apod-2026-october-16-chasing-the-international-space-station/';
        const { container } = render(
            <MediaViewer
                url={portalUrl}
                mediaType="video"
                title="Chasing the ISS Feature"
            />
        );

        // Should NOT render <video> tag with an HTML page src
        expect(container.querySelector('video')).toBeNull();

        // Should NOT trigger the error fallback banner
        expect(screen.queryByText('Preview Unavailable')).toBeNull();

        // Should render portal badge and title
        expect(screen.getByText('NASA Video Feature')).toBeInTheDocument();
        expect(container.querySelector('.media-viewer__portal-title')).toHaveTextContent('Chasing the ISS Feature');

        // Should have action button linking to NASA portal
        const watchLink = screen.getByRole('link', { name: /Watch Video on NASA/i });
        expect(watchLink).toBeInTheDocument();
        expect(watchLink).toHaveAttribute('href', portalUrl);
        expect(watchLink).toHaveAttribute('target', '_blank');
    });

    it('renders standard image and supports Lightbox modal zoom and Escape key close', () => {
        const imageUrl = 'https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/2026/october/comet.jpg';
        const { container } = render(
            <MediaViewer
                url={imageUrl}
                mediaType="image"
                title="Comet Tsuchinshan-ATLAS"
                allowLightbox={true}
            />
        );

        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', imageUrl);

        // Lightbox should initially be closed
        expect(container.querySelector('.media-viewer__lightbox')).toBeNull();

        // Click frame to open lightbox
        const frame = container.querySelector('.media-viewer__frame');
        expect(frame).toBeInTheDocument();
        fireEvent.click(frame!);

        // Lightbox should now be visible
        expect(container.querySelector('.media-viewer__lightbox')).toBeInTheDocument();
        expect(container.querySelector('.media-lightbox__title')).toHaveTextContent('Comet Tsuchinshan-ATLAS');

        // Press Escape to dismiss lightbox
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(container.querySelector('.media-viewer__lightbox')).toBeNull();
    });

    it('displays Preview Unavailable fallback when image fails to load', () => {
        const brokenUrl = 'https://invalid-domain.example/nonexistent.jpg';
        const { container } = render(
            <MediaViewer
                url={brokenUrl}
                mediaType="image"
                title="Broken Asset"
            />
        );

        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();

        // Simulate image load error
        fireEvent.error(img!);

        // Error banner should appear
        expect(screen.getByText('Preview Unavailable')).toBeInTheDocument();
        expect(
            screen.getByText(/This media cannot be embedded directly in your browser/i)
        ).toBeInTheDocument();

        const openBtn = screen.getByRole('link', { name: /Open Original Media/i });
        expect(openBtn).toHaveAttribute('href', brokenUrl);
    });
});
