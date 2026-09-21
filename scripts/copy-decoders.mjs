/**
 * Copies the WASM/JS decoders that three's loaders fetch at runtime out of
 * node_modules and into /public, so they are served from our own origin
 * instead of a third-party CDN.
 *
 *   public/decoders/three-0.186/draco/
 *   public/decoders/three-0.186/basis/
 *
 * Meshopt needs no copy: three ships MeshoptDecoder as an ES module that is
 * bundled directly (three/examples/jsm/libs/meshopt_decoder.module.js).
 *
 * Runs on postinstall; also available as `npm run setup:decoders`.
 */
import { cp, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const jobs = [
  { from: 'node_modules/three/examples/jsm/libs/draco', to: 'public/decoders/three-0.186/draco' },
  { from: 'node_modules/three/examples/jsm/libs/basis', to: 'public/decoders/three-0.186/basis' },
];

for (const { from, to } of jobs) {
  const src = resolve(root, from);
  const dest = resolve(root, to);

  try {
    await access(src);
  } catch {
    console.warn(`[decoders] skipped — ${from} not found (is three installed?)`);
    continue;
  }

  await cp(src, dest, { recursive: true });
  console.log(`[decoders] ${from} -> ${to}`);
}
