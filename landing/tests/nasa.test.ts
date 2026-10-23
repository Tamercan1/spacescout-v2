import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseApodResponse, getFeaturedAstronomy } from '../lib/nasa.ts';
import { FALLBACK_ASTRONOMY } from '../lib/fallback.ts';
import type { RawApodResponse } from '../lib/types.ts';

describe('NASA APOD Data Service — Response Parsing & Media Types', () => {
  test('parses standard image APOD response successfully', () => {
    const mockRaw: RawApodResponse = {
      title: 'NGC 1365: Majestic Island Universe',
      date: '2024-04-18',
      explanation: 'Barred spiral galaxy NGC 1365 is a truly majestic island universe.',
      media_type: 'image',
      url: 'https://apod.nasa.gov/apod/image/2404/ngc1365.jpg',
      hdurl: 'https://apod.nasa.gov/apod/image/2404/ngc1365_hd.jpg',
      copyright: 'Martin Pugh',
    };

    const result = parseApodResponse(mockRaw);

    assert.equal(result.isFallback, false);
    assert.equal(result.title, 'NGC 1365: Majestic Island Universe');
    assert.equal(result.date, '2024-04-18');
    assert.equal(result.mediaType, 'image');
    assert.equal(result.url, 'https://apod.nasa.gov/apod/image/2404/ngc1365.jpg');
    assert.equal(result.hdUrl, 'https://apod.nasa.gov/apod/image/2404/ngc1365_hd.jpg');
    assert.equal(result.copyright, 'Martin Pugh');
  });

  test('parses video APOD response correctly and flags mediaType as video', () => {
    const mockRaw: RawApodResponse = {
      title: 'A Total Solar Eclipse over Texas',
      date: '2024-04-09',
      explanation: 'What does a total solar eclipse look like from above?',
      media_type: 'video',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      copyright: 'NASA SDO',
    };

    const result = parseApodResponse(mockRaw);

    assert.equal(result.isFallback, false);
    assert.equal(result.title, 'A Total Solar Eclipse over Texas');
    assert.equal(result.mediaType, 'video');
    assert.equal(result.url, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
    assert.equal(result.hdUrl, undefined);
  });

  test('returns fallback astronomy entry when raw data has NASA error payload', () => {
    const errorPayload: RawApodResponse = {
      code: 400,
      msg: 'Date must be between Jun 16, 1995 and today.',
    };

    const result = parseApodResponse(errorPayload);

    assert.equal(result.isFallback, true);
    assert.equal(result.title, FALLBACK_ASTRONOMY.title);
    assert.equal(result.mediaType, FALLBACK_ASTRONOMY.mediaType);
    assert.match(result.statusNotice || '', /Date must be between/);
  });

  test('returns fallback astronomy entry when raw response is missing required fields', () => {
    const missingUrl: RawApodResponse = {
      title: 'Incomplete Entry',
      date: '2024-01-01',
    };

    const result = parseApodResponse(missingUrl);

    assert.equal(result.isFallback, true);
    assert.equal(result.title, FALLBACK_ASTRONOMY.title);
    assert.equal(result.url, FALLBACK_ASTRONOMY.url);
  });

  test('returns fallback astronomy entry when raw input is null or not an object', () => {
    // @ts-expect-error Testing invalid runtime input
    const resultFromNull = parseApodResponse(null);
    assert.equal(resultFromNull.isFallback, true);
    assert.equal(resultFromNull.title, FALLBACK_ASTRONOMY.title);

    // @ts-expect-error Testing invalid runtime input
    const resultFromUndefined = parseApodResponse(undefined);
    assert.equal(resultFromUndefined.isFallback, true);
  });

  test('guarantees zero credential leakage in parsed astronomy results', () => {
    const mockRaw: RawApodResponse = {
      title: 'Security Verification Entry',
      date: '2024-01-01',
      url: 'https://apod.nasa.gov/image.jpg',
      media_type: 'image',
    };

    const result = parseApodResponse(mockRaw);
    const serialized = JSON.stringify(result);

    // Ensure no API key properties exist in the serialized payload
    assert.equal('apiKey' in result, false);
    assert.equal('api_key' in result, false);
    assert.equal(serialized.includes('api_key'), false);
    assert.equal(serialized.includes('API_KEY'), false);
  });
});

describe('NASA APOD Data Service — Network Resilience & HTTP Status Handling', () => {
  test('handles custom date parameter in request URL', async () => {
    let capturedUrl = '';
    const mockFetch: typeof fetch = async (input) => {
      capturedUrl = input.toString();
      return new Response(
        JSON.stringify({
          title: 'Custom Eclipse',
          date: '2024-04-08',
          explanation: 'Eclipse over North America',
          url: 'https://apod.nasa.gov/apod/image/2404/eclipse.jpg',
          media_type: 'image',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const result = await getFeaturedAstronomy('2024-04-08', mockFetch);

    assert.match(capturedUrl, /date=2024-04-08/);
    assert.equal(result.title, 'Custom Eclipse');
    assert.equal(result.date, '2024-04-08');
    assert.equal(result.isFallback, false);
  });

  test('handles HTTP 429 rate limiting with graceful fallback notice', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response('Rate limit exceeded', { status: 429 });
    };

    const result = await getFeaturedAstronomy(undefined, mockFetch);

    assert.equal(result.isFallback, true);
    assert.equal(result.title, FALLBACK_ASTRONOMY.title);
    assert.match(result.statusNotice || '', /rate limit/i);
  });

  test('handles HTTP 401 / 403 unauthorized errors with graceful fallback notice', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response('API key rejected', { status: 403 });
    };

    const result = await getFeaturedAstronomy(undefined, mockFetch);

    assert.equal(result.isFallback, true);
    assert.equal(result.title, FALLBACK_ASTRONOMY.title);
    assert.match(result.statusNotice || '', /invalid or unauthorized/i);
  });

  test('handles HTTP 500 server errors with graceful fallback notice', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response('Internal Server Error', { status: 500 });
    };

    const result = await getFeaturedAstronomy(undefined, mockFetch);

    assert.equal(result.isFallback, true);
    assert.equal(result.title, FALLBACK_ASTRONOMY.title);
    assert.match(result.statusNotice || '', /status 500/i);
  });

  test('handles network timeout (TimeoutError / AbortError) with fallback notice', async () => {
    const mockFetch: typeof fetch = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'TimeoutError';
      throw err;
    };

    const result = await getFeaturedAstronomy(undefined, mockFetch);

    assert.equal(result.isFallback, true);
    assert.equal(result.title, FALLBACK_ASTRONOMY.title);
    assert.match(result.statusNotice || '', /timed out/i);
  });

  test('handles network connection failure with fallback notice', async () => {
    const mockFetch: typeof fetch = async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    };

    const result = await getFeaturedAstronomy(undefined, mockFetch);

    assert.equal(result.isFallback, true);
    assert.equal(result.title, FALLBACK_ASTRONOMY.title);
    assert.match(result.statusNotice || '', /Could not reach/i);
  });
});
