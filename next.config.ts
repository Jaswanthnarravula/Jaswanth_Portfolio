import type { NextConfig } from 'next';

/** Shader sources are imported as raw strings and handed to three's materials. */
const SHADER_EXTENSIONS = ['glsl', 'vert', 'frag', 'vs', 'fs'] as const;

/**
 * Cache + security headers (shared/13 `DEPLOY-HDR-01`, `DEPLOY-PREV-01`). Defined here — not in vercel.json — so the
 * production server used by every test applies exactly what Vercel serves.
 * CSP: scripts need 'unsafe-inline' because the App Router streams its RSC payload as per-page inline scripts that a
 * static build can neither hash nor nonce (see the shared/22 deviations log); every other directive is locked down.
 */
const IMMUTABLE = { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' };
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // The dev server needs eval for its overlay and source maps; production is strict.
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: CSP }] : []),
  // Preview deployments never enter a search index.
  ...(process.env.VERCEL_ENV === 'preview' ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev only: lets a phone/tablet on the LAN load the dev server (HMR) for device testing.
  allowedDevOrigins: ['10.0.0.77'],
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/assets/:path*', headers: [IMMUTABLE] },
      { source: '/decoders/three-0.186/:path*', headers: [IMMUTABLE] },
      {
        source: '/resume/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Disposition', value: 'inline' },
        ],
      },
    ];
  },
  typedRoutes: true,
  // A second build (e.g. ASSET_MODE=original for the asset-mode test project) can live beside the default one.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // Turbopack (dev + build default in Next 16) needs one rule per extension;
  // `as: '*.js'` makes the loader output a JS module exporting the source.
  turbopack: {
    rules: Object.fromEntries(SHADER_EXTENSIONS.map((ext) => [`*.${ext}`, { loaders: ['raw-loader'], as: '*.js' }])),
  },

  // Kept in sync for anyone running the webpack build (`next build --webpack`).
  webpack(config) {
    config.module.rules.push({
      test: new RegExp(`\\.(${SHADER_EXTENSIONS.join('|')})$`),
      use: ['raw-loader'],
    });
    return config;
  },

  // three + drei ship deep ESM trees; barrel-file tree shaking keeps them honest.
  experimental: {
    optimizePackageImports: ['@react-three/drei', 'three', 'lenis'],
  },
};

export default nextConfig;
