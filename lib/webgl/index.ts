/**
 * `welcome-webgl` entry — decides Tier 2 and only then imports three.js (shared/10: T2 only, after `load`, idle, no
 * input for 500 ms; ≤ 190 KB). The page is on T1 CSS glass until the stage has drawn its first frame, and returns to
 * it for the rest of the session if the stage stops. `data-webgl="on"` tells the CSS to drop backdrop blur.
 */
import { forcedTier2 } from '@/lib/kernel/persist/storage';
import type { GlassStage, LensPanel } from './glass-stage';
import { browserTier2Environment, evaluateTier2 } from './tier2';

let stoppedThisSession = false;

export async function startHelloStage({
  container,
  panels,
}: {
  container: HTMLElement;
  panels: readonly LensPanel[];
}): Promise<GlassStage | null> {
  if (stoppedThisSession) return null;
  const forced = forcedTier2();
  const verdict = await evaluateTier2(browserTier2Environment(), { forced });
  if (!verdict.ok) return null;
  const { createGlassStage } = await import('./glass-stage');
  const root = document.documentElement;
  let stage: GlassStage;
  try {
    stage = createGlassStage({
      container,
      dpr: verdict.dpr,
      panels,
      onStop: () => {
        stoppedThisSession = true;
        delete root.dataset.webgl;
      },
    });
  } catch {
    stoppedThisSession = true; // context creation failed: T1 for the session
    return null;
  }
  root.dataset.webgl = 'on';
  // CI's forced-tier project reads GPU memory after dispose (PERF-GL-01).
  if (forced) (window as Window & { __glassStage?: GlassStage }).__glassStage = stage;
  return {
    dim: (seconds) => stage.dim(seconds),
    memory: () => stage.memory(),
    dispose() {
      stage.dispose();
      delete root.dataset.webgl;
    },
  };
}

export type { GlassStage } from './glass-stage';
