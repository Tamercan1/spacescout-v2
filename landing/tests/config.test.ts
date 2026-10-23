import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getAppUrl, getSiteUrl } from '../lib/config.ts';

describe('Landing Configuration & URL Resolution', () => {
  const originalEnv = { ...process.env };

  function setEnv(key: string, value?: string) {
    const env = process.env as Record<string, string | undefined>;
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('resolves appUrl to production Vercel default when in production and env is unset', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('NEXT_PUBLIC_APP_URL', undefined);

    const url = getAppUrl();
    assert.equal(url, 'https://spacescout.vercel.app');
  });

  test('resolves appUrl to localhost default in development when unset', () => {
    setEnv('NODE_ENV', 'development');
    setEnv('NEXT_PUBLIC_APP_URL', undefined);

    const url = getAppUrl();
    assert.equal(url, 'http://localhost:5173');
  });

  test('rejects accidental localhost appUrl in production and uses production default', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:5173/');

    const url = getAppUrl();
    assert.equal(url, 'https://spacescout.vercel.app');
  });

  test('accepts valid custom appUrl and removes trailing slash', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('NEXT_PUBLIC_APP_URL', 'https://custom-app.spacescout.org///');

    const url = getAppUrl();
    assert.equal(url, 'https://custom-app.spacescout.org');
  });

  test('handles malformed appUrl predictably by falling back to safe default', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('NEXT_PUBLIC_APP_URL', 'javascript:alert(1)');

    const url = getAppUrl();
    assert.equal(url, 'https://spacescout.vercel.app');
  });

  test('returns null for siteUrl in production when unset without inventing a domain', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('NEXT_PUBLIC_SITE_URL', undefined);

    const siteUrl = getSiteUrl();
    assert.equal(siteUrl, null);
  });

  test('rejects localhost siteUrl in production and returns null to prevent bad canonicals', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');

    const siteUrl = getSiteUrl();
    assert.equal(siteUrl, null);
  });

  test('returns valid configured siteUrl in production', () => {
    setEnv('NODE_ENV', 'production');
    setEnv('NEXT_PUBLIC_SITE_URL', 'https://spacescout.app/');

    const siteUrl = getSiteUrl();
    assert.equal(siteUrl, 'https://spacescout.app');
  });
});
