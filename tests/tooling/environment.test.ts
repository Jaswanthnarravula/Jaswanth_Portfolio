import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '@/lib/config/environment';

describe('environment contract', () => {
  it('works offline with safe defaults and never exposes secrets', () => {
    expect(parseEnvironment({ GITHUB_TOKEN: 'private' })).toEqual({
      siteUrl: 'http://localhost:3000',
      assetMode: 'official',
      githubUsername: null,
      checkContent: false,
      debug: false,
      production: false,
      preview: false,
      osPreview: [],
    });
  });
  it('validates explicit configuration and production content checks', () => {
    expect(
      parseEnvironment({
        NEXT_PUBLIC_SITE_URL: 'https://portfolio.example/path',
        NEXT_PUBLIC_ASSET_MODE: 'original',
        GITHUB_USERNAME: 'Jaswanthnarravula',
        VERCEL_ENV: 'production',
        NODE_ENV: 'production',
        NEXT_PUBLIC_DEBUG: 'true',
      }),
    ).toMatchObject({ siteUrl: 'https://portfolio.example', assetMode: 'original', checkContent: true, debug: false });
    expect(parseEnvironment({ CHECK_CONTENT: '1', NEXT_PUBLIC_DEBUG: 'true', VERCEL_ENV: 'preview' })).toMatchObject({
      checkContent: true,
      preview: true,
      debug: true,
    });
  });
  it.each([
    { NEXT_PUBLIC_SITE_URL: 'file:///secret' },
    { NEXT_PUBLIC_SITE_URL: 'https://user:password@example.com' },
    { NEXT_PUBLIC_ASSET_MODE: 'unknown' },
    { GITHUB_USERNAME: '../name' },
  ])('rejects invalid values: %j', (input) => expect(() => parseEnvironment(input)).toThrow());
});

describe('DEPLOY-ENV-01 preview allow-list', () => {
  it('parses NEXT_PUBLIC_OS_PREVIEW and ignores it in production', () => {
    expect(parseEnvironment({ NEXT_PUBLIC_OS_PREVIEW: 'all' }).osPreview).toEqual([
      'ios',
      'macos',
      'windows',
      'android',
      'linux',
    ]);
    expect(parseEnvironment({ NEXT_PUBLIC_OS_PREVIEW: 'linux, macos' }).osPreview).toEqual(['macos', 'linux']);
    expect(parseEnvironment({ NEXT_PUBLIC_OS_PREVIEW: 'all', VERCEL_ENV: 'production' }).osPreview).toEqual([]);
    expect(() => parseEnvironment({ NEXT_PUBLIC_OS_PREVIEW: 'beos' })).toThrow();
  });
});
