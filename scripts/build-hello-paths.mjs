/**
 * Hello greeting paths — plans/02-hello-page.md `HELLO-PATHS-01` / `HELLO-MORPH-01`.
 *
 * Single-stroke handwriting paths for the five greetings. The opening "hello" is the storyboard's authored cursive
 * stroke (`CURSIVE_HELLO`); the other four are generated from open-licensed handwriting fonts: the shaped text is rasterized (Pango/HarfBuzz via sharp, so Devanagari conjuncts are correct),
 * thinned to its centreline, traced into pen strokes, put in writing order, smoothed into cubic Béziers and
 * normalized into one shared 1000 × 320 box so any two greetings can morph. Deterministic: same fonts → same bytes.
 * No single-line font covers Devanagari and Japanese, hence centrelines (see the deviations log).
 *
 *   node scripts/build-hello-paths.mjs            → writes lib/welcome/hello-paths.generated.json
 *   node scripts/build-hello-paths.mjs --preview  → also writes a preview SVG next to it (not committed)
 * Fonts are build inputs only (never shipped): assets-inbox/fonts/ (Kalam, Klee One — SIL OFL 1.1).
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const VIEW = { width: 1000, height: 320, padX: 40, padY: 30 };
/** A pair morphs only when stroke and segment counts are comparable; otherwise it crossfades. */
export const MORPH_LIMITS = { strokeRatio: 2.5, segmentRatio: 2 };

/**
 * The opening "hello": one continuous cursive pen stroke, authored for the owner-approved storyboard
 * (assets-inbox/preview/storyboard.html). It is resampled and normalized like the font greetings, so it morphs with
 * them (see the deviations log in plans/06-onboarding-acceptance.md).
 */
export const CURSIVE_HELLO =
  'M 242.5 467.4 C 351 372 304.8 427.6 351 372 C 386.5 329.2 405.1 271.6 390.9 246.8 C 338.9 156.6 308 485.3 315.5 485.4 C 323.1 485.4 322.6 389.7 360.9 368 C 399.1 346.3 412.5 375.2 414.3 388.7 C 417.1 410.5 405.6 445 407.5 457.6 C 415.7 510.1 547.7 458.5 558.1 398.9 C 569.2 334.7 471.4 337.8 490.8 440.3 C 497.9 477.9 542 487.6 565.5 482 C 650.4 461.6 708.6 357.6 706.6 277.7 C 703.8 174.3 612.6 278.8 634.5 438.2 C 643 499.6 714.8 479.7 736 463.3 C 775.2 433.1 844.4 346 831.7 261.5 C 818.5 173.2 719.1 318.6 764.7 450.8 C 780 494.9 825.6 480 838.1 473.2 C 867.9 457.1 877.4 398.6 902.1 373.1 C 933.2 340.8 982.2 364.9 984.3 403.3 C 988.7 487.7 923.6 487.8 899.4 468.8 C 878.4 452.3 873.5 403.4 901.7 373.1 C 921 352.4 951.8 351.9 992.4 375.1 C 1009 384.6 1023.2 382.9 1034.3 367.7';

export const GREETINGS = [
  { id: 'hello', text: 'hello', lang: 'en', path: CURSIVE_HELLO },
  { id: 'hola', text: 'Hola', lang: 'es', font: 'Kalam', file: 'kalam-Kalam-Regular.ttf' },
  { id: 'bonjour', text: 'Bonjour', lang: 'fr', font: 'Kalam', file: 'kalam-Kalam-Regular.ttf' },
  { id: 'namaste', text: 'नमस्ते', lang: 'hi', font: 'Kalam', file: 'kalam-Kalam-Regular.ttf' },
  { id: 'konnichiwa', text: 'こんにちは', lang: 'ja', font: 'Klee One', file: 'kleeone-KleeOne-Regular.ttf' },
];

// --- raster → skeleton ---------------------------------------------------------------------------------------------

/** 8-neighbour offsets, clockwise from north: N, NE, E, SE, S, SW, W, NW. */
const RING = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/** Zhang–Suen thinning, in place. `bits` is a w×h Uint8Array of 0/1 with a clear 1-px border. */
export function thin(bits, w, h) {
  const at = (x, y) => bits[y * w + x];
  const clear = [];
  for (let changed = true; changed;) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      clear.length = 0;
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          if (!at(x, y)) continue;
          const p = RING.map(([dx, dy]) => at(x + dx, y + dy));
          const b = p.reduce((sum, v) => sum + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) a++;
          if (a !== 1) continue;
          const [n, , e, , s, , wv] = p;
          if (step === 0 ? n * e * s || e * s * wv : n * e * wv || n * s * wv) continue;
          clear.push(y * w + x);
        }
      for (const i of clear) bits[i] = 0;
      if (clear.length) changed = true;
    }
  }
  // Zhang–Suen can leave 2-px staircases; remove corner pixels whose removal keeps the skeleton connected
  // (Yokoi connectivity number = 1), so every stroke is exactly one 8-connected pixel wide.
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (!at(x, y)) continue;
      const p = RING.map(([dx, dy]) => at(x + dx, y + dy));
      const [n, , e, , s, , wv] = p;
      const corner = (n && e) || (e && s) || (s && wv) || (wv && n);
      if (!corner || p.reduce((sum, v) => sum + v, 0) < 2) continue;
      // Yokoi C8 over x1..x8 = E, NE, N, NW, W, SW, S, SE (complemented values).
      const ring = [p[2], p[1], p[0], p[7], p[6], p[5], p[4], p[3]].map((v) => 1 - v);
      let c8 = 0;
      for (const k of [0, 2, 4, 6]) c8 += ring[k] - ring[k] * ring[(k + 1) % 8] * ring[(k + 2) % 8];
      if (c8 === 1) bits[y * w + x] = 0;
    }
  return bits;
}

const neighbours = (bits, w, x, y) => {
  const out = [];
  for (const [dx, dy] of RING) if (bits[(y + dy) * w + (x + dx)]) out.push([x + dx, y + dy]);
  return out;
};

/**
 * Skeleton → graph. Nodes are endpoints (1 neighbour) and junction clusters (≥ 3 neighbours, adjacent junction pixels
 * merged). Edges are pixel polylines between nodes; closed loops without nodes become self-loops.
 */
export function traceSkeleton(bits, w, h) {
  const key = (x, y) => y * w + x;
  const degree = new Map();
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) if (bits[key(x, y)]) degree.set(key(x, y), neighbours(bits, w, x, y).length);

  const nodeOf = new Map();
  const nodes = [];
  for (const [k, d] of degree) {
    if (nodeOf.has(k) || d === 2) continue;
    const id = nodes.length;
    const members = [];
    const stack = [k];
    nodeOf.set(k, id);
    while (stack.length) {
      const cur = stack.pop();
      members.push(cur);
      if (degree.get(cur) === 1) continue;
      for (const [nx, ny] of neighbours(bits, w, cur % w, Math.floor(cur / w))) {
        const nk = key(nx, ny);
        if (!nodeOf.has(nk) && (degree.get(nk) ?? 0) >= 3) {
          nodeOf.set(nk, id);
          stack.push(nk);
        }
      }
    }
    const cx = members.reduce((s, m) => s + (m % w), 0) / members.length;
    const cy = members.reduce((s, m) => s + Math.floor(m / w), 0) / members.length;
    nodes.push({ id, x: cx, y: cy, members, endpoint: members.length === 1 && degree.get(k) === 1 });
  }

  const visited = new Set();
  const edges = [];
  const walk = (fromNode, startKey) => {
    const points = [[nodes[fromNode].x, nodes[fromNode].y]];
    let prev = null;
    let cur = startKey;
    for (;;) {
      const cx = cur % w;
      const cy = Math.floor(cur / w);
      const node = nodeOf.get(cur);
      if (node !== undefined) {
        points.push([nodes[node].x, nodes[node].y]);
        return { a: fromNode, b: node, points };
      }
      visited.add(cur);
      points.push([cx, cy]);
      const next = neighbours(bits, w, cx, cy)
        .map(([nx, ny]) => key(nx, ny))
        .filter((nk) => nk !== prev && !visited.has(nk) && !nodes[fromNode].members.includes(nk) === true)
        .sort((p, q) => (nodeOf.has(q) ? 1 : 0) - (nodeOf.has(p) ? 1 : 0));
      // Reaching a node is preferred; otherwise continue along the single unvisited pixel.
      const step = next.find((nk) => nodeOf.has(nk)) ?? next[0];
      if (step === undefined) {
        // Ran back into the start node's own cluster or a dead end.
        const back = neighbours(bits, w, cx, cy)
          .map(([nx, ny]) => key(nx, ny))
          .find((nk) => nodeOf.has(nk) && nk !== prev);
        const end = back !== undefined ? nodeOf.get(back) : fromNode;
        points.push([nodes[end].x, nodes[end].y]);
        return { a: fromNode, b: end, points };
      }
      prev = cur;
      cur = step;
    }
  };
  for (const node of nodes)
    for (const member of node.members)
      for (const [nx, ny] of neighbours(bits, w, member % w, Math.floor(member / w))) {
        const nk = key(nx, ny);
        if (nodeOf.has(nk) || visited.has(nk)) continue;
        edges.push(walk(node.id, nk));
      }
  // Closed loops with no endpoint or junction (an "o" drawn in one stroke).
  for (const [k] of degree) {
    if (visited.has(k) || nodeOf.has(k)) continue;
    const points = [];
    let prev = null;
    let cur = k;
    while (cur !== undefined && !visited.has(cur)) {
      visited.add(cur);
      points.push([cur % w, Math.floor(cur / w)]);
      const next = neighbours(bits, w, cur % w, Math.floor(cur / w))
        .map(([nx, ny]) => key(nx, ny))
        .find((nk) => nk !== prev && !visited.has(nk));
      prev = cur;
      cur = next;
    }
    points.push(points[0]);
    const id = nodes.length;
    nodes.push({ id, x: points[0][0], y: points[0][1], members: [k], endpoint: false });
    edges.push({ a: id, b: id, points });
  }
  return { nodes, edges };
}

const length = (points) => {
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
};

/** Remove short spurs (endpoint → junction) that thinning grows at stroke ends and corners. */
export function pruneSpurs(graph, minLength) {
  let { nodes, edges } = graph;
  for (let pass = 0; pass < 4; pass++) {
    const degree = new Map();
    for (const e of edges) {
      degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
      degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
    }
    const kept = edges.filter((e) => {
      const spur = (degree.get(e.a) === 1 && degree.get(e.b) >= 3) || (degree.get(e.b) === 1 && degree.get(e.a) >= 3);
      return !(spur && length(e.points) < minLength);
    });
    if (kept.length === edges.length) break;
    edges = kept;
  }
  return { nodes, edges };
}

/** Direction leaving `node` along `points` (oriented from the node), sampled `reach` px out. */
function heading(points, reach) {
  const [x0, y0] = points[0];
  for (const [x, y] of points) {
    const d = Math.hypot(x - x0, y - y0);
    if (d >= reach) return [(x - x0) / d, (y - y0) / d];
  }
  const [x, y] = points[points.length - 1];
  const d = Math.hypot(x - x0, y - y0) || 1;
  return [(x - x0) / d, (y - y0) / d];
}

/**
 * Join edges into pen strokes: at every junction, pair the edges that continue most nearly straight (deviation
 * < 65°); paired edges become one stroke through the junction.
 */
export function joinStrokes(graph, reach) {
  const { edges } = graph;
  const ends = new Map(); // node → [{edge, atStart}]
  edges.forEach((edge, index) => {
    for (const atStart of [true, false]) {
      const node = atStart ? edge.a : edge.b;
      if (!ends.has(node)) ends.set(node, []);
      ends.get(node).push({ index, atStart });
    }
  });
  const link = new Map(); // `${index}:${atStart}` → partner end
  for (const [, list] of ends) {
    if (list.length < 2) continue;
    const dirs = list.map(({ index, atStart }) => {
      const pts = atStart ? edges[index].points : [...edges[index].points].reverse();
      return heading(pts, reach);
    });
    const candidates = [];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].index === list[j].index) continue;
        const dot = dirs[i][0] * dirs[j][0] + dirs[i][1] * dirs[j][1];
        candidates.push({ i, j, straightness: -dot });
      }
    candidates.sort((p, q) => q.straightness - p.straightness || p.i - q.i || p.j - q.j);
    const used = new Set();
    for (const { i, j, straightness } of candidates) {
      if (used.has(i) || used.has(j) || straightness < Math.cos((65 * Math.PI) / 180)) continue;
      used.add(i);
      used.add(j);
      link.set(`${list[i].index}:${list[i].atStart}`, list[j]);
      link.set(`${list[j].index}:${list[j].atStart}`, list[i]);
    }
  }
  const done = new Set();
  const strokes = [];
  const follow = (index, atStart) => {
    // Walk from the free end of `index` (entering at `atStart`) along linked edges.
    const points = [];
    let cur = { index, atStart };
    while (cur && !done.has(cur.index)) {
      done.add(cur.index);
      const pts = cur.atStart ? edges[cur.index].points : [...edges[cur.index].points].reverse();
      points.push(...(points.length ? pts.slice(1) : pts));
      cur = link.get(`${cur.index}:${!cur.atStart}`);
    }
    return points;
  };
  // Start from ends that have no partner, so strokes are maximal; then any cycles that remain.
  edges.forEach((_, index) => {
    if (done.has(index)) return;
    if (!link.has(`${index}:true`)) strokes.push(follow(index, true));
    else if (!link.has(`${index}:false`)) strokes.push(follow(index, false));
  });
  edges.forEach((_, index) => {
    if (!done.has(index)) strokes.push(follow(index, true));
  });
  return strokes.filter((stroke) => stroke.length > 1);
}

/** Ramer–Douglas–Peucker. */
export function simplify(points, epsilon) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const norm = Math.hypot(dx, dy);
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = norm === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / norm;
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= epsilon) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1), epsilon).slice(0, -1), ...simplify(points.slice(index), epsilon)];
}

/** Writing order: left to right by each stroke's left edge; long flat strokes (a Devanagari headline) go last. */
export function orderStrokes(strokes) {
  const box = (s) => {
    const xs = s.map((p) => p[0]);
    const ys = s.map((p) => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  const all = strokes.flat();
  const width = Math.max(...all.map((p) => p[0])) - Math.min(...all.map((p) => p[0])) || 1;
  const decorated = strokes.map((stroke) => {
    const b = box(stroke);
    const headline = b.x1 - b.x0 > width * 0.55 && b.y1 - b.y0 < (b.x1 - b.x0) * 0.2;
    // Pen starts at the left end (the top end for near-vertical strokes).
    const [first, last] = [stroke[0], stroke[stroke.length - 1]];
    const vertical = Math.abs(last[1] - first[1]) > Math.abs(last[0] - first[0]) * 1.5;
    const reverse = vertical ? last[1] < first[1] : last[0] < first[0];
    return { stroke: reverse ? [...stroke].reverse() : stroke, b, headline };
  });
  decorated.sort((p, q) => Number(p.headline) - Number(q.headline) || p.b.x0 - q.b.x0 || p.b.y0 - q.b.y0);
  return decorated.map((d) => d.stroke);
}

const round = (n) => Math.round(n * 10) / 10;

/** Catmull-Rom (centripetal-ish, tension 1/6) → cubic Bézier path data for one stroke. */
export function strokeToPath(points) {
  if (points.length === 2) {
    const [[x0, y0], [x1, y1]] = points;
    return `M${round(x0)} ${round(y0)}L${round(x1)} ${round(y1)}`;
  }
  let d = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return d;
}

/** Fit every stroke into the shared view box (uniform scale, centred). */
export function normalize(strokes) {
  const all = strokes.flat();
  const x0 = Math.min(...all.map((p) => p[0]));
  const x1 = Math.max(...all.map((p) => p[0]));
  const y0 = Math.min(...all.map((p) => p[1]));
  const y1 = Math.max(...all.map((p) => p[1]));
  const scale = Math.min(
    (VIEW.width - 2 * VIEW.padX) / Math.max(x1 - x0, 1),
    (VIEW.height - 2 * VIEW.padY) / Math.max(y1 - y0, 1),
  );
  const ox = (VIEW.width - (x1 - x0) * scale) / 2;
  const oy = (VIEW.height - (y1 - y0) * scale) / 2;
  return {
    scale,
    strokes: strokes.map((stroke) => stroke.map(([x, y]) => [(x - x0) * scale + ox, (y - y0) * scale + oy])),
  };
}

/**
 * One greeting from a grayscale raster (0–255, ink bright). Returns path data plus the counts the morph rule uses.
 * Thresholds scale with the measured stroke width, so any font size gives the same shapes.
 */
export function greetingFromRaster({ data, width: w, height: h }) {
  const bits = new Uint8Array(w * h);
  let ink = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      if (data[y * w + x] >= 128) {
        bits[y * w + x] = 1;
        ink++;
      }
  thin(bits, w, h);
  let skeleton = 0;
  for (const v of bits) skeleton += v;
  const strokeWidth = ink / Math.max(skeleton, 1);
  const graph = pruneSpurs(traceSkeleton(bits, w, h), strokeWidth * 1.2);
  const raw = joinStrokes(graph, strokeWidth * 1.5)
    .map((stroke) => simplify(stroke, Math.max(0.8, strokeWidth * 0.12)))
    .filter((stroke) => length(stroke) > strokeWidth * 0.9);
  const { strokes, scale } = normalize(orderStrokes(raw));
  const d = strokes.map(strokeToPath).join('');
  const segments = (d.match(/[CL]/g) ?? []).length;
  return { d, strokes: strokes.length, segments, strokeWidth: round(strokeWidth * scale) };
}

/**
 * One greeting from authored path data (absolute M/C commands, one subpath per pen stroke): each cubic is sampled,
 * simplified and re-smoothed, then normalized exactly like a font greeting. `strokeWidth` is the drawn ink width.
 */
export function greetingFromPath(source, { steps = 24, epsilon = 1.5, strokeWidth = 36 } = {}) {
  const raw = [];
  for (const [, command, args] of source.matchAll(/([MC])([^MC]*)/g)) {
    const v = (args.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    if (command === 'M') {
      raw.push([[v[0], v[1]]]);
      continue;
    }
    const stroke = raw[raw.length - 1];
    for (let i = 0; i + 5 < v.length; i += 6) {
      const [x0, y0] = stroke[stroke.length - 1];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const u = 1 - t;
        const [a, b, c, e] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
        stroke.push([
          a * x0 + b * v[i] + c * v[i + 2] + e * v[i + 4],
          a * y0 + b * v[i + 1] + c * v[i + 3] + e * v[i + 5],
        ]);
      }
    }
  }
  const { strokes, scale } = normalize(raw.map((stroke) => simplify(stroke, epsilon)));
  const d = strokes.map(strokeToPath).join('');
  const segments = (d.match(/[CL]/g) ?? []).length;
  return { d, strokes: strokes.length, segments, strokeWidth: round(strokeWidth * scale) };
}

/**
 * Consecutive pairs in loop order (last → first closes the loop), each marked morph or crossfade.
 * @param {readonly { id: string, strokes: number, segments: number }[]} greetings
 * @returns {{ from: string, to: string, mode: 'morph' | 'crossfade' }[]}
 */
export function pairModes(greetings) {
  return greetings.map((from, i) => {
    const to = greetings[(i + 1) % greetings.length];
    const strokeRatio = Math.max(from.strokes, to.strokes) / Math.max(1, Math.min(from.strokes, to.strokes));
    const segmentRatio = Math.max(from.segments, to.segments) / Math.max(1, Math.min(from.segments, to.segments));
    const morph = strokeRatio <= MORPH_LIMITS.strokeRatio && segmentRatio <= MORPH_LIMITS.segmentRatio;
    return { from: from.id, to: to.id, mode: morph ? 'morph' : 'crossfade' };
  });
}

// --- CLI -----------------------------------------------------------------------------------------------------------

async function rasterize(sharp, fontDir, { text, font, file }) {
  const { data, info } = await sharp({
    text: { text, font: `${font} 96`, fontfile: join(fontDir, file), dpi: 300, rgba: false },
  })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0 } })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const grey = new Uint8Array(info.width * info.height);
  for (let i = 0; i < grey.length; i++) grey[i] = data[i * channels];
  return { data: grey, width: info.width, height: info.height };
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const sharp = createRequire(join(root, 'package.json'))('sharp');
  const fontDir = join(root, 'assets-inbox/fonts');
  const greetings = [];
  for (const source of GREETINGS) {
    const shape = source.path
      ? greetingFromPath(source.path)
      : greetingFromRaster(await rasterize(sharp, fontDir, source));
    greetings.push({ id: source.id, text: source.text, lang: source.lang, ...shape });
    console.log(`[hello] ${source.id}: ${shape.strokes} strokes, ${shape.segments} segments`);
  }
  const output = {
    viewBox: [0, 0, VIEW.width, VIEW.height],
    sources: [
      { font: 'Kalam', licence: 'SIL OFL 1.1', copyright: 'Indian Type Foundry' },
      { font: 'Klee One', licence: 'SIL OFL 1.1', copyright: 'Fontworks Inc.' },
    ],
    greetings,
    pairs: pairModes(greetings),
  };
  const target = join(root, 'lib/welcome/hello-paths.generated.json');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`[hello] wrote ${target}`);
  if (process.argv.includes('--preview')) {
    const rows = greetings
      .map(
        (g, i) =>
          `<g transform="translate(0 ${i * VIEW.height})"><rect width="${VIEW.width}" height="${VIEW.height}" fill="#101418"/><path d="${g.d}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>`,
      )
      .join('');
    await writeFile(
      join(root, 'assets-inbox/hello-preview.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.width} ${VIEW.height * greetings.length}">${rows}</svg>`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
