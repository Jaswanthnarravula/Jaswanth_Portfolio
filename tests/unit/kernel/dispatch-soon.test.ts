/**
 * PERF-INP-01 seam — `dispatchSoon`: an input handler queues its kernel action, the press paints, and the queue commits
 * in the task after that frame, in order, once per frame. `flushQueued` lands pending presses immediately, so a second
 * press in the same frame reads the first one's result.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterQueued, dispatchSoon, flushQueued, getKernel } from '@/stores/kernel-store';

const frames: FrameRequestCallback[] = [];
const nextFrame = () => frames.splice(0).forEach((run) => run(0));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => frames.push(run));
});
afterEach(() => {
  flushQueued();
  frames.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const resize = (w: number) => ({ type: 'VIEWPORT_CHANGED', w, h: 800, pointer: 'fine' }) as const;

describe('dispatchSoon', () => {
  it('commits after the next frame paints, not during the press', () => {
    const before = getKernel().viewport.w;
    dispatchSoon(resize(before + 11));
    expect(getKernel().viewport.w).toBe(before);
    nextFrame();
    expect(getKernel().viewport.w).toBe(before); // the frame paints first…
    vi.runOnlyPendingTimers();
    expect(getKernel().viewport.w).toBe(before + 11); // …then the kernel commits
  });

  it('keeps order and schedules one commit per frame', () => {
    const w = getKernel().viewport.w;
    dispatchSoon(resize(w + 21));
    dispatchSoon(resize(w + 22));
    expect(frames).toHaveLength(1);
    nextFrame();
    vi.runOnlyPendingTimers();
    expect(getKernel().viewport.w).toBe(w + 22);
  });

  it('afterQueued runs after the queued press has committed (focus moves into the new DOM)', () => {
    const w = getKernel().viewport.w;
    dispatchSoon(resize(w + 41));
    let seen = 0;
    afterQueued(() => (seen = getKernel().viewport.w));
    nextFrame();
    vi.runOnlyPendingTimers();
    expect(seen).toBe(w + 41);
  });

  it('flushQueued lands pending presses now; the scheduled commit then has nothing left', () => {
    const w = getKernel().viewport.w;
    dispatchSoon(resize(w + 31));
    flushQueued();
    expect(getKernel().viewport.w).toBe(w + 31);
    dispatchSoon(resize(w + 32)); // a later press schedules its own commit
    nextFrame();
    vi.runOnlyPendingTimers();
    expect(getKernel().viewport.w).toBe(w + 32);
  });
});
