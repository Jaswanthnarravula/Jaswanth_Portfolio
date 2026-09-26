/**
 * Placeholder guard — shared/02 `DATA-GUARD-01`. Runs in `prebuild` when VERCEL_ENV=production (or CHECK_CONTENT=1):
 * any `placeholder: true` in the portfolio data fails the build with the list of offending entries, so unconfirmed
 * facts can never reach production.
 *   node --experimental-strip-types scripts/check-content.mjs
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @param {any} data @returns {string[]} */
export function findPlaceholders(data) {
  const offenders = [];
  if (data.person?.placeholder) offenders.push('person');
  for (const [collection, key] of [
    ['experience', 'slug'],
    ['projects', 'slug'],
    ['education', 'slug'],
  ])
    for (const entry of data[collection] ?? [])
      if (entry.placeholder) {
        const missing = Object.entries(entry)
          .filter(([, value]) => value === null)
          .map(([field]) => field);
        offenders.push(`${collection}/${entry[key]}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
      }
  return offenders;
}

export function shouldCheck(env) {
  return env.CHECK_CONTENT === '1' || env.VERCEL_ENV === 'production';
}

/**
 * Reports the guard's verdict and returns the process exit code.
 * @param {any} data
 * @param {{ log: (message: string) => void; error: (message: string) => void }} [log]
 * @returns {0 | 1}
 */
export function checkContent(data, log = console) {
  const offenders = findPlaceholders(data);
  if (offenders.length) {
    log.error(
      `[content] ${offenders.length} placeholder entr${offenders.length === 1 ? 'y' : 'ies'} cannot ship to production:\n  - ${offenders.join('\n  - ')}`,
    );
    return 1;
  }
  log.log('[content] no placeholders — content is production-ready.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!shouldCheck(process.env)) {
    console.log('[content] placeholder guard skipped (not a production build).');
  } else {
    const { portfolio } = await import(pathToFileURL(join(root, 'data/portfolio.ts')).href);
    process.exitCode = checkContent(portfolio);
  }
}
