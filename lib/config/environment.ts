import { OS_IDS, isOsId, type OsId } from '@/lib/kernel/ids';

export type AssetMode = 'official' | 'original';

export interface Environment {
  siteUrl: string;
  assetMode: AssetMode;
  githubUsername: string | null;
  checkContent: boolean;
  debug: boolean;
  production: boolean;
  preview: boolean;
  /** Unreleased OSes made visible for preview/test builds. Always empty in production. */
  osPreview: readonly OsId[];
}

function parseOsPreview(value: string | undefined, production: boolean): readonly OsId[] {
  if (!value || production) return [];
  if (value.trim() === 'all') return OS_IDS;
  const list = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = list.filter((item) => !isOsId(item));
  if (invalid.length) throw new Error(`NEXT_PUBLIC_OS_PREVIEW has unknown OS ids: ${invalid.join(', ')}`);
  return OS_IDS.filter((os) => list.includes(os));
}

/** Build-time validation. Secrets are deliberately absent from the returned object. */
export function parseEnvironment(input: Readonly<Record<string, string | undefined>>): Environment {
  const url = new URL(input.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('NEXT_PUBLIC_SITE_URL must be an HTTP(S) URL without credentials.');
  const assetMode = input.NEXT_PUBLIC_ASSET_MODE || 'official';
  if (assetMode !== 'official' && assetMode !== 'original')
    throw new Error('NEXT_PUBLIC_ASSET_MODE must be official or original.');
  const githubUsername = input.GITHUB_USERNAME || null;
  if (githubUsername && !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(githubUsername))
    throw new Error('GITHUB_USERNAME must be a GitHub login.');
  const production = input.VERCEL_ENV === 'production' || input.NEXT_PUBLIC_VERCEL_ENV === 'production';
  return {
    siteUrl: url.origin,
    assetMode,
    githubUsername,
    checkContent: input.CHECK_CONTENT === '1' || production,
    debug: input.NODE_ENV !== 'production' && input.NEXT_PUBLIC_DEBUG === 'true',
    production,
    preview: input.VERCEL_ENV === 'preview' || input.NEXT_PUBLIC_VERCEL_ENV === 'preview',
    osPreview: parseOsPreview(input.NEXT_PUBLIC_OS_PREVIEW, production),
  };
}

/**
 * Client-safe environment. `NEXT_PUBLIC_*` references must be written out literally so the bundler inlines them.
 */
export const publicEnv = parseEnvironment({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_ASSET_MODE: process.env.NEXT_PUBLIC_ASSET_MODE,
  NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
  NEXT_PUBLIC_OS_PREVIEW: process.env.NEXT_PUBLIC_OS_PREVIEW,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  NODE_ENV: process.env.NODE_ENV,
});
