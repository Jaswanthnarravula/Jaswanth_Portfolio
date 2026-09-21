/**
 * ARCH-TREE-01 (folder tree) · DEPLOY-GIT-01 (repository + ignore rules) · ARCH-DEPS-01 (dependency diff check) ·
 * ARCH-FIX-01 (scaffold defects, static half — the viewport/safe-area half runs in e2e and Lighthouse CI).
 */
import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { directories, files } from '../../scripts/architecture-manifest.mjs';

/**
 * The approved dependency set (plans/shared/01-architecture.md "Dependency policy"). Adding a package means
 * updating that file and the budgets in shared/10 first, then this list — never the other way round.
 */
const RUNTIME = [
  '@gsap/react',
  '@react-three/drei',
  '@react-three/fiber',
  '@vercel/analytics',
  '@vercel/speed-insights',
  'gsap',
  'lenis',
  'next',
  'react',
  'react-dom',
  'three',
  'zustand',
];
const DEV = [
  // v1 dev additions named by the policy
  '@axe-core/playwright',
  '@lhci/cli',
  '@playwright/test',
  '@testing-library/jest-dom',
  '@testing-library/react',
  '@testing-library/user-event',
  '@vitest/coverage-v8',
  'jsdom',
  'opentype.js',
  'vitest',
  'web-vitals',
  // the original scaffold toolchain
  '@gltf-transform/cli',
  '@gltf-transform/core',
  '@gltf-transform/extensions',
  '@gltf-transform/functions',
  '@tailwindcss/postcss',
  '@types/node',
  '@types/react',
  '@types/react-dom',
  '@types/three',
  'draco3d',
  'eslint',
  'eslint-config-next',
  'meshoptimizer',
  'postcss',
  'prettier',
  'prettier-plugin-tailwindcss',
  'raw-loader',
  'tailwindcss',
  'typescript',
  'vercel',
];
const BANNED = ['react-aria', 'framer-motion', 'motion', '@react-aria/interactions'];

describe('ARCH-TREE-01 / DEPLOY-GIT-01 / ARCH-DEPS-01 / ARCH-FIX-01 foundation scaffold', () => {
  it('folder-structure matches architecture manifest', async () => {
    await Promise.all([...directories, ...files].map((path) => access(path)));
  });

  it('repository exists and generated or sensitive inputs are ignored', async () => {
    await access('.git');
    const ignore = await readFile('.gitignore', 'utf8');
    for (const path of [
      '.env',
      'node_modules/',
      '.next/',
      '.next-original/',
      'public/decoders/',
      'assets-inbox/*',
      'test-results/',
      'coverage/',
    ])
      expect(ignore, path).toContain(path);
  });

  it('dependencies are exactly pinned and match the approved set (package.json diff check)', async () => {
    const manifest = JSON.parse(await readFile('package.json', 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies).sort()).toEqual([...RUNTIME].sort());
    expect(Object.keys(manifest.devDependencies).sort()).toEqual([...DEV].sort());
    for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }))
      expect(version, name).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/);
    for (const name of BANNED) expect(RUNTIME.concat(DEV)).not.toContain(name);
  });

  it('versions immutable decoder URLs, allows browser zoom and covers the safe areas', async () => {
    // Headers live in next.config.ts (DEPLOY-HDR-01), so next start and Vercel serve the same rules.
    const headers = await readFile('next.config.ts', 'utf8');
    const layout = await readFile('app/layout.tsx', 'utf8');
    expect(headers).toContain("'/decoders/three-0.186/:path*'");
    expect(headers).not.toContain("'/decoders/:path*'"); // unversioned decoder paths are never immutable
    expect(await readFile('vercel.json', 'utf8')).not.toContain('headers');
    expect(layout).not.toContain('maximumScale');
    expect(layout).toContain("viewportFit: 'cover'");
    expect(layout).toContain("interactiveWidget: 'resizes-content'");
  });

  it('reduced motion is the [data-motion] system, not a blanket rule', async () => {
    const globals = await readFile('app/globals.css', 'utf8');
    const tokens = await readFile('styles/tokens.css', 'utf8');
    expect(globals).not.toMatch(/prefers-reduced-motion/);
    expect(tokens).toContain(":root[data-motion='reduced']");
    expect(tokens).toMatch(/prefers-reduced-motion: reduce\)\s*{\s*:root:not\(\[data-motion\]\)/);
  });

  it('typed routes on, cacheComponents off, jsx-a11y strict enabled', async () => {
    const next = await readFile('next.config.ts', 'utf8');
    const eslint = await readFile('eslint.config.mjs', 'utf8');
    expect(next).toContain('typedRoutes: true');
    expect(next).not.toMatch(/cacheComponents:\s*true/);
    expect(eslint).toContain('accessibility.configs.strict.rules');
  });
});
