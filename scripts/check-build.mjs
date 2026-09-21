/**
 * Post-build audit (runs as `postbuild` and after each e2e build). Exits non-zero on any failure.
 *   DEPLOY-STATIC-01 — every app route is fully static: each page or route handler is prerendered at its own path or
 *     is a dynamic segment with `fallback: false` whose paths were all prerendered, and nothing revalidates (no ISR).
 *   GH-TOKEN-01 (bundle grep) — no client asset mentions `GITHUB_TOKEN` or contains the token's value.
 *   node scripts/check-build.mjs [distDir]   (defaults to NEXT_DIST_DIR, then `.next`)
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @param {Record<string, string>} appRoutes  app-path-routes-manifest.json (entry → route)
 * @param {{ routes: Record<string, { srcRoute?: string, initialRevalidateSeconds?: number | false, compute?: string }>,
 *           dynamicRoutes: Record<string, { fallback?: unknown }> }} prerender  prerender-manifest.json
 * @returns {{ problems: string[], staticPaths: number }}
 */
export function auditStaticOutput(appRoutes, prerender) {
  const problems = [];
  const bySource = new Map();
  for (const [path, entry] of Object.entries(prerender.routes)) {
    const source = entry.srcRoute ?? path;
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    if (entry.initialRevalidateSeconds !== false)
      problems.push(`${path} revalidates (${entry.initialRevalidateSeconds})`);
    if (entry.compute && entry.compute !== 'static') problems.push(`${path} is computed "${entry.compute}"`);
  }
  for (const route of new Set(Object.values(appRoutes))) {
    const dynamic = prerender.dynamicRoutes[route];
    if (dynamic && dynamic.fallback !== false) problems.push(`${route} renders unknown paths on demand`);
    // A dynamic segment with `fallback: false` and no paths is static too: every URL is a 404 (e.g. `/[os]` before any
    // OS is released). Anything else without prerendered output renders at request time.
    if (!bySource.has(route) && !(dynamic && dynamic.fallback === false))
      problems.push(`${route} has no prerendered output (dynamic at request time)`);
  }
  return { problems, staticPaths: Object.keys(prerender.routes).length };
}

/**
 * @param {{ path: string, text: string }[]} assets  client assets (the browser-reachable `static/` tree)
 * @param {string | undefined} token  the build's GitHub token, if one was set
 */
export function auditClientSecrets(assets, token) {
  const problems = [];
  for (const { path, text } of assets) {
    if (text.includes('GITHUB_TOKEN')) problems.push(`${path} mentions GITHUB_TOKEN`);
    if (token && token.length >= 8 && text.includes(token)) problems.push(`${path} contains the GitHub token`);
  }
  return problems;
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (/\.(?:js|css|json|html|txt)$/.test(entry.name)) files.push(path);
  }
  return files;
}

async function main() {
  const distDir = resolve(process.argv[2] ?? (process.env.NEXT_DIST_DIR || '.next'));
  const read = async (name) => JSON.parse(await readFile(join(distDir, name), 'utf8'));
  const { problems, staticPaths } = auditStaticOutput(
    await read('app-path-routes-manifest.json'),
    await read('prerender-manifest.json'),
  );
  const paths = await listFiles(join(distDir, 'static'));
  const assets = await Promise.all(paths.map(async (path) => ({ path, text: await readFile(path, 'utf8') })));
  problems.push(...auditClientSecrets(assets, process.env.GITHUB_TOKEN));
  if (problems.length) {
    console.error(`[build-audit] ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `[build-audit] all routes static (${staticPaths} prerendered paths); ${assets.length} client assets carry no token (${distDir}).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
