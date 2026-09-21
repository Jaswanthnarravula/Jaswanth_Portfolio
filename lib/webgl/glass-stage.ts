/**
 * GlassStage — plans/02-hello-page.md "Liquid glass by tier" (T2) · `HELLO-GL-01`, `PERF-GL-01`, `PERF-GL-02`.
 * Imperative three.js (never R3F, never inside an OS): one fullscreen triangle, one fragment shader, zero render
 * targets. Lens rects come from a ResizeObserver (never measured per frame). GSAP's ticker is the clock: 30 fps idle,
 * full rate for 1 s after pointer input, nothing while the tab is hidden. The governor steps DPR 1.5 → 1.25 → 1.0 and
 * then gives up to T1; a lost context drops to T1 for the session (no restore loop). dispose() frees every GPU
 * resource so `renderer.info.memory` returns to zero.
 */
import { gsap } from 'gsap';
import {
  BufferAttribute,
  BufferGeometry,
  GLSL3,
  Mesh,
  OrthographicCamera,
  RawShaderMaterial,
  Scene,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three';
import fragmentShader from '@/shaders/hello.frag';
import vertexShader from '@/shaders/fullscreen.vert';

export interface LensPanel {
  readonly element: Element;
  /** On-screen corner radius in CSS px. */
  readonly radius: () => number;
}

export interface GlassStageOptions {
  readonly container: HTMLElement;
  readonly dpr: number;
  readonly panels: readonly LensPanel[];
  /** The stage stopped for good (context lost or too slow): the page is back on T1 CSS glass. */
  readonly onStop: (reason: 'lost' | 'slow') => void;
}

export interface GlassStage {
  /** Fade toward the intro's black (uDim → 1) over `seconds`. */
  dim(seconds: number): Promise<void>;
  dispose(): void;
  /** `renderer.info.memory` (leak checks). */
  memory(): { geometries: number; textures: number };
}

const IDLE_FRAME_MS = 1000 / 30;
const INPUT_WINDOW_MS = 1000;
const DPR_STEPS = [1.5, 1.25, 1] as const;
const MAX_PANELS = 4;

export function createGlassStage({ container, dpr: startDpr, panels, onStop }: GlassStageOptions): GlassStage {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:0;';
  container.append(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  let dpr = DPR_STEPS.find((step) => step <= startDpr) ?? 1;
  renderer.setPixelRatio(dpr);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const uniforms = {
    uResolution: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uPointer: { value: new Vector2(0.5, 0.6) },
    uAccent: { value: new Vector3(0.36, 0.52, 1) },
    uIntensity: { value: 0 },
    uDim: { value: 0 },
    uPanels: { value: Array.from({ length: MAX_PANELS }, () => new Vector4()) },
    uRadii: { value: Array.from({ length: MAX_PANELS }, () => 0) },
    uPanelCount: { value: 0 },
  };
  const material = new RawShaderMaterial({ vertexShader, fragmentShader, uniforms, glslVersion: GLSL3 });
  const scene = new Scene();
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const lifetime = new AbortController();
  const { signal } = lifetime;
  let disposed = false;
  let lastInput = 0;
  let lastRender = 0;
  let lastTick = 0;
  let started = performance.now();
  const pointerTarget = new Vector2(0.5, 0.6);
  const deltas: number[] = [];

  const size = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    uniforms.uResolution.value.set(window.innerWidth * dpr, window.innerHeight * dpr);
  };
  const measure = () => {
    const height = window.innerHeight;
    let count = 0;
    for (const panel of panels.slice(0, MAX_PANELS)) {
      const r = panel.element.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      uniforms.uPanels.value[count]!.set(r.left * dpr, (height - r.bottom) * dpr, r.width * dpr, r.height * dpr);
      uniforms.uRadii.value[count] = panel.radius() * dpr;
      count++;
    }
    uniforms.uPanelCount.value = count;
  };
  size();
  measure();
  const observer = new ResizeObserver(() => {
    size();
    measure();
  });
  for (const panel of panels) observer.observe(panel.element);
  window.addEventListener('resize', measure, { signal });
  window.addEventListener(
    'pointermove',
    (event) => {
      lastInput = performance.now();
      pointerTarget.set(event.clientX / window.innerWidth, 1 - event.clientY / window.innerHeight);
    },
    { signal, passive: true },
  );
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault(); // no restore loop: T1 for the rest of the session
      stop('lost');
    },
    { signal },
  );

  /** p95 of recent frame intervals; three slow windows step the DPR down, then give up. */
  const govern = (delta: number) => {
    if (delta > 250) return; // a hidden tab or a breakpoint, not a slow GPU
    deltas.push(delta);
    if (deltas.length < 90) return;
    const sorted = [...deltas].sort((a, b) => a - b);
    deltas.length = 0;
    if (sorted[Math.floor(sorted.length * 0.95)]! <= 22) return;
    const next = DPR_STEPS[DPR_STEPS.indexOf(dpr as (typeof DPR_STEPS)[number]) + 1];
    if (next === undefined) return stop('slow');
    dpr = next;
    renderer.setPixelRatio(dpr);
    size();
    measure();
  };

  const tick = () => {
    if (disposed || document.hidden) return;
    const now = performance.now();
    if (lastTick) govern(now - lastTick);
    lastTick = now;
    const interacting = now - lastInput < INPUT_WINDOW_MS;
    if (!interacting && now - lastRender < IDLE_FRAME_MS) return;
    lastRender = now;
    uniforms.uTime.value = now / 1000;
    uniforms.uPointer.value.lerp(pointerTarget, 0.08);
    uniforms.uIntensity.value = Math.min(1, (now - started) / 600);
    renderer.render(scene, camera);
  };
  renderer.render(scene, camera); // the first frame exists before the canvas shows
  canvas.style.opacity = '1';
  started = performance.now();
  gsap.ticker.add(tick);

  function dispose() {
    if (disposed) return;
    disposed = true;
    gsap.ticker.remove(tick);
    lifetime.abort();
    observer.disconnect();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    canvas.remove();
  }
  function stop(reason: 'lost' | 'slow') {
    if (disposed) return;
    dispose();
    onStop(reason);
  }

  return {
    dim(seconds) {
      return new Promise((resolve) => {
        gsap.to(uniforms.uDim, { value: 1, duration: seconds, ease: 'power1.out', onComplete: () => resolve() });
      });
    },
    dispose,
    memory: () => ({ geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
  };
}
