/** Serves a production build for Playwright: `node scripts/e2e-serve.mjs <distDir> <port>` (never the dev server). */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const [distDir = '.next', port = '3000'] = process.argv.slice(2);
// Next's own binary, run by this Node directly (no shell, no npx): stopping the wrapper stops the server. Through a
// shell on Windows only `cmd.exe` died and `next start` lived on, so a later local run could reuse a stale build.
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, 'start', '-p', port], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_DIST_DIR: distDir },
});
const stop = (signal) => {
  if (child.exitCode === null) child.kill(signal);
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(signal));
process.on('exit', () => stop('SIGTERM'));
child.on('exit', (code) => process.exit(code ?? 0));
