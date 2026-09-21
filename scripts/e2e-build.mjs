/**
 * Builds the production servers the Playwright matrix needs (shared/12), each followed by the post-build audit:
 *   official    `.next`            preview build, official assets, every OS visible (the journey suite, :3000)
 *   original    `.next-original`   preview build, ASSET_MODE=original (the `asset-original` project, :3001)
 *   production  `.next-production` a real production build: no preview allow-list, analytics and Speed Insights on,
 *                                  only released OSes (the `perf` project's production.spec, :3002)
 * Preview builds make every OS visible through NEXT_PUBLIC_OS_PREVIEW, which production always ignores.
 *   node scripts/e2e-build.mjs [official|original|production|all]
 */
import { spawnSync } from 'node:child_process';

const which = process.argv[2] ?? 'all';
const preview = { VERCEL_ENV: 'preview', NEXT_PUBLIC_OS_PREVIEW: process.env.NEXT_PUBLIC_OS_PREVIEW ?? 'all' };
const builds = [
  { name: 'official', env: { ...preview, NEXT_PUBLIC_ASSET_MODE: 'official' } },
  { name: 'original', env: { ...preview, NEXT_PUBLIC_ASSET_MODE: 'original', NEXT_DIST_DIR: '.next-original' } },
  {
    name: 'production',
    env: {
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_VERCEL_ENV: 'production',
      NEXT_PUBLIC_OS_PREVIEW: '',
      NEXT_PUBLIC_ASSET_MODE: 'official',
      NEXT_DIST_DIR: '.next-production',
    },
  },
].filter((build) => which === 'all' || which === 'both' || which === build.name);

for (const build of builds) {
  console.log(`[e2e-build] ${build.name}`);
  const result = spawnSync('npx', ['next', 'build'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...build.env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  // `npx next build` skips npm's post hook, so the post-build audit (DEPLOY-STATIC-01, GH-TOKEN-01) runs here explicitly.
  const audit = spawnSync('node', ['scripts/check-build.mjs', build.env.NEXT_DIST_DIR ?? '.next'], {
    stdio: 'inherit',
  });
  if (audit.status !== 0) process.exit(audit.status ?? 1);
}
