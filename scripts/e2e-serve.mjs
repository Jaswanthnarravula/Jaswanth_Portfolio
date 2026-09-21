/** Serves a production build for Playwright: `node scripts/e2e-serve.mjs <distDir> <port>` (never the dev server). */
import { spawn } from 'node:child_process';

const [distDir = '.next', port = '3000'] = process.argv.slice(2);
const child = spawn('npx', ['next', 'start', '-p', port], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: distDir },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
