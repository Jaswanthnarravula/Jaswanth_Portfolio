/**
 * CHOOSE-EXIT-01 seam — the exit hand-off: a leaving OS offers the rest of its `exiting` phase to the registered return
 * stage (the chooser); with none registered, or when it declines, the OS completes the phase itself.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimPhases, handOffExit, isClaimed, registerReturnStage, resetStageClaims } from '@/stores/transition-stage';

afterEach(() => resetStageClaims());

describe('exit hand-off', () => {
  it('declines when no return stage is registered', () => {
    expect(handOffExit({ epoch: 3, from: 'macos', to: null })).toBe(false);
  });

  it('the registered stage decides; unregistering removes only that stage', () => {
    const stage = vi.fn(() => true);
    const unregister = registerReturnStage(stage);
    expect(handOffExit({ epoch: 4, from: 'macos', to: null })).toBe(true);
    expect(stage).toHaveBeenCalledWith({ epoch: 4, from: 'macos', to: null });
    const newer = vi.fn(() => false);
    const unregisterNewer = registerReturnStage(newer);
    unregister(); // an older stage leaving does not remove the current one
    expect(handOffExit({ epoch: 5, from: 'macos', to: null })).toBe(false);
    expect(newer).toHaveBeenCalledTimes(1);
    unregisterNewer();
    expect(handOffExit({ epoch: 6, from: 'macos', to: null })).toBe(false);
  });

  it('claims are per epoch and phase, and release cleanly', () => {
    const release = claimPhases(7, ['exiting']);
    expect(isClaimed(7, 'exiting')).toBe(true);
    expect(isClaimed(7, 'entering')).toBe(false);
    release();
    expect(isClaimed(7, 'exiting')).toBe(false);
  });
});
