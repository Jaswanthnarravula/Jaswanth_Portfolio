/**
 * Build-time GitHub fetch — shared/17 `GH-FETCH-01`, `GH-SAFE-01`, `GH-TOKEN-01`. Runs in `prebuild`.
 *  1. No GITHUB_USERNAME → keep the committed snapshot, exit 0.
 *  2. Fetch, validate, write `data/generated/github.json` only on a fully validated success.
 *  3. Any error (network, 403 rate limit, schema mismatch, 8 s timeout) → warn, keep the file, exit 0.
 * GITHUB_TOKEN is read here only (server side, build time) and never written anywhere.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchGithubSnapshot, serializeSnapshot, validateSnapshot } from './lib/github-snapshot.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SNAPSHOT_PATH = join(root, 'data/generated/github.json');

/**
 * @param {{ env: Record<string, string | undefined>, fetch: typeof fetch, file?: string, log?: (m: string) => void, referencedRepos?: string[] }} options
 * @returns {Promise<'skipped' | 'updated' | 'kept'>}
 */
export async function run({ env, fetch: fetchImpl, file = SNAPSHOT_PATH, log = console.log, referencedRepos = [] }) {
  const username = env.GITHUB_USERNAME;
  if (!username) {
    log('[github] GITHUB_USERNAME not set — keeping the committed snapshot.');
    return 'skipped';
  }
  try {
    const snapshot = await fetchGithubSnapshot({
      username,
      token: env.GITHUB_TOKEN || null,
      fetch: fetchImpl,
      referencedRepos,
    });
    const problems = validateSnapshot(snapshot);
    if (problems.length) throw new Error(`schema mismatch: ${problems.join(', ')}`);
    await writeFile(file, serializeSnapshot(snapshot));
    log(
      `[github] snapshot updated: ${snapshot.repos.length} repos${snapshot.contributions ? `, ${snapshot.contributions.total} contributions` : ''}.`,
    );
    return 'updated';
  } catch (error) {
    log(
      `[github] warning: ${error instanceof Error ? error.message : String(error)} — keeping the committed snapshot.`,
    );
    return 'kept';
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let referencedRepos = [];
  try {
    const source = await readFile(join(root, 'data/portfolio.ts'), 'utf8');
    referencedRepos = [...source.matchAll(/repo:\s*'([^']+)'/g)].map((match) => match[1]);
  } catch {
    /* no referenced forks */
  }
  await run({ env: process.env, fetch: globalThis.fetch, referencedRepos });
}
