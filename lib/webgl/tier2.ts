/**
 * Tier 2 candidacy + GPU probe — shared/10 `PERF-TIER-01` steps 4–5, used only by the Hello `GlassStage`
 * (`HELLO-GL-01`, `PERF-GL-02`). Evaluated in idle time after `load`; a coarse pointer, a small screen, a weak or
 * software GPU, low battery, reduced motion or solid glass keeps the page on T1 and three.js is never requested.
 * CI has only software GL, so a test-only session flag (`pf.debug.tier=2`) forces candidacy and allows it
 * (shared/12 "WebGL in CI").
 */

export interface Tier2Environment {
  readonly matches: (query: string) => boolean;
  readonly width: number;
  readonly deviceMemory?: number;
  readonly hardwareConcurrency?: number;
  readonly dataset: DOMStringMap;
  readonly battery?: () => Promise<{ charging: boolean; level: number }>;
  /**
   * Creates a probe context; returns null when WebGL2 is unavailable or (unless `allowSoftware`) has a major
   * performance caveat.
   */
  readonly probe: (allowSoftware: boolean) => { renderer: string; release: () => void } | null;
  readonly devicePixelRatio: number;
}

export interface Tier2Verdict {
  readonly ok: boolean;
  readonly reason: string;
  /** Starting device-pixel ratio (the governor steps it down: 1.5 → 1.25 → 1.0). */
  readonly dpr: number;
}

const DENY = /SwiftShader|llvmpipe|Software|Basic Render|Intel.*(HD|UHD)|Mali|Adreno|PowerVR/i;
const LOW_DPR = /Iris.*Xe|Intel.*Arc/i;

export async function evaluateTier2(env: Tier2Environment, { forced = false } = {}): Promise<Tier2Verdict> {
  const no = (reason: string): Tier2Verdict => ({ ok: false, reason, dpr: 1 });
  if (!forced) {
    if (!env.matches('(pointer: fine)') || !env.matches('(hover: hover)')) return no('pointer');
    if (env.width < 1024) return no('width');
    if (env.deviceMemory !== undefined && env.deviceMemory < 8) return no('memory');
    if ((env.hardwareConcurrency ?? 0) < 8) return no('cores');
  }
  if (env.dataset.motion !== 'full' || env.dataset.glass !== 'full') return no('preference');
  if (env.dataset.tier === '0') return no('tier');
  if (!forced && env.battery) {
    try {
      const battery = await env.battery();
      if (!battery.charging && battery.level < 0.3) return no('battery');
    } catch {
      /* no battery API: not a reason to refuse */
    }
  }
  const probe = env.probe(forced);
  if (!probe) return no('webgl2');
  probe.release();
  if (!forced && DENY.test(probe.renderer) && !LOW_DPR.test(probe.renderer)) return no('gpu');
  const cap = LOW_DPR.test(probe.renderer) ? 1 : 1.5;
  return { ok: true, reason: forced ? 'forced' : 'capable', dpr: Math.min(cap, Math.max(1, env.devicePixelRatio)) };
}

/** The browser environment (a real WebGL2 probe, released immediately). */
export function browserTier2Environment(): Tier2Environment {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    getBattery?: () => Promise<{ charging: boolean; level: number }>;
  };
  return {
    matches: (query) => window.matchMedia(query).matches,
    width: window.innerWidth,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    dataset: document.documentElement.dataset,
    battery: nav.getBattery ? () => nav.getBattery!() : undefined,
    devicePixelRatio: window.devicePixelRatio || 1,
    probe: (allowSoftware) => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: !allowSoftware });
      if (!gl) return null;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      return { renderer, release: () => gl.getExtension('WEBGL_lose_context')?.loseContext() };
    },
  };
}
