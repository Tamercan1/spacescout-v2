import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAstronomyMedia,
  getYouTubeEmbedUrl,
  getVimeoEmbedUrl,
  isDirectVideoUrl,
} from '../lib/media.ts';

describe('Landing Astronomy Media Resolver', () => {
  test('converts standard YouTube watch URL to privacy-enhanced nocookie embed', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const resolved = resolveAstronomyMedia(url, 'video');

    assert.equal(resolved.kind, 'youtube');
    if (resolved.kind === 'youtube') {
      assert.equal(
        resolved.embedUrl,
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1'
      );
    }
  });

  test('converts youtu.be short URL to privacy-enhanced nocookie embed', () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    const resolved = resolveAstronomyMedia(url, 'video');

    assert.equal(resolved.kind, 'youtube');
    if (resolved.kind === 'youtube') {
      assert.equal(
        resolved.embedUrl,
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1'
      );
    }
  });

  test('converts YouTube shorts URL to privacy-enhanced nocookie embed', () => {
    const url = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
    const resolved = resolveAstronomyMedia(url, 'video');

    assert.equal(resolved.kind, 'youtube');
    if (resolved.kind === 'youtube') {
      assert.equal(
        resolved.embedUrl,
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1'
      );
    }
  });

  test('handles protocol-relative YouTube URL (//www.youtube.com/...)', () => {
    const url = '//www.youtube.com/watch?v=dQw4w9WgXcQ';
    const resolved = resolveAstronomyMedia(url, 'video');

    assert.equal(resolved.kind, 'youtube');
    if (resolved.kind === 'youtube') {
      assert.equal(
        resolved.embedUrl,
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1'
      );
    }
  });

  test('handles YouTube URL with extra query parameters', () => {
    const url = 'https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ&t=42';
    const resolved = resolveAstronomyMedia(url, 'video');

    assert.equal(resolved.kind, 'youtube');
    if (resolved.kind === 'youtube') {
      assert.equal(
        resolved.embedUrl,
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1'
      );
    }
  });

  test('normalizes Vimeo standard URL to player.vimeo.com embed', () => {
    const url = 'https://vimeo.com/1084537';
    const resolved = resolveAstronomyMedia(url, 'video');

    assert.equal(resolved.kind, 'vimeo');
    if (resolved.kind === 'vimeo') {
      assert.equal(resolved.embedUrl, 'https://player.vimeo.com/video/1084537');
    }
  });

  test('preserves direct Vimeo player URL', () => {
    const url = 'https://player.vimeo.com/video/1084537';
    const resolved = resolveAstronomyMedia(url, 'video');

    assert.equal(resolved.kind, 'vimeo');
    if (resolved.kind === 'vimeo') {
      assert.equal(resolved.embedUrl, 'https://player.vimeo.com/video/1084537');
    }
  });

  test('identifies and preserves direct HTML5 video files (.mp4, .webm, .mov, etc.)', () => {
    const videoUrls = [
      'https://svs.gsfc.nasa.gov/vis/a010000/a014600/a014648/14648_BlackHole.mp4',
      'https://example.com/deep-space.webm?token=123',
      'https://example.com/sun-transit.mov#t=10',
      'https://example.com/solar-flare.ogg',
    ];

    for (const url of videoUrls) {
      assert.equal(isDirectVideoUrl(url), true);
      const resolved = resolveAstronomyMedia(url, 'video');
      assert.equal(resolved.kind, 'video');
      if (resolved.kind === 'video') {
        assert.equal(resolved.videoUrl, url);
      }
    }
  });

  test('handles generic embeddable iframe players', () => {
    const url = 'https://cdn.jwplayer.com/players/abc12345.html';
    const resolved = resolveAstronomyMedia(url, 'video');

    assert.equal(resolved.kind, 'iframe');
    if (resolved.kind === 'iframe') {
      assert.equal(resolved.embedUrl, url);
    }
  });

  test('falls back to external video portal when URL cannot be embedded inside iframe', () => {
    const url = 'https://science.nasa.gov/astronomy/video-archive/mars-landing-simulation';
    const resolved = resolveAstronomyMedia(url, 'video');

    assert.equal(resolved.kind, 'external_video');
    if (resolved.kind === 'external_video') {
      assert.equal(resolved.portalUrl, url);
    }
  });

  test('resolves standard image URL as image', () => {
    const url = 'https://apod.nasa.gov/apod/image/2404/ngc1365.jpg';
    const resolved = resolveAstronomyMedia(url, 'image');

    assert.equal(resolved.kind, 'image');
    if (resolved.kind === 'image') {
      assert.equal(resolved.src, url);
    }
  });

  test('prioritizes video signature even if declared media_type was erroneously image', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const resolved = resolveAstronomyMedia(url, 'image');

    assert.equal(resolved.kind, 'youtube');
  });

  test('handles null or empty URL safely by returning fallback image', () => {
    const resolved = resolveAstronomyMedia(null, 'image');
    assert.equal(resolved.kind, 'image');
    if (resolved.kind === 'image') {
      assert.equal(resolved.src, '/carina-nebula.jpg');
    }
  });
});
