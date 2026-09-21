/**
 * Kernel store — shared/01 "Pure-TS kernel in lib/kernel, wrapped by a vanilla Zustand store". Zustand is only the
 * container: `dispatch` runs the pure reducer, commits the state, applies the prefs patch, and publishes the result's
 * side-effect intents (history, focus, analytics) on an effects bus consumed by RouteSync / FocusManager / analytics.
 * Animation and DOM state never live here.
 */
import { createStore } from 'zustand/vanilla';
import { contentIndex } from '@/data/content-index';
import type { KernelAction } from '@/lib/kernel/actions';
import { toPersisted } from '@/lib/kernel/persist/sessions';
import { writePersistedSessions } from '@/lib/kernel/persist/storage';
import { reduce, type KernelDeps, type KernelResult } from '@/lib/kernel/reducers';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { routeCodec, VISIBLE_OSES } from '@/lib/kernel/route';
import { initialKernelState } from '@/lib/kernel/state';
import type { KernelState } from '@/lib/kernel/types';
import { getPrefs, prefsStore } from './prefs-store';

export interface KernelStore {
  readonly kernel: KernelState;
}

export type KernelEffect = KernelResult & { readonly action: KernelAction; readonly previous: KernelState };
type EffectListener = (effect: KernelEffect) => void;

export const kernelStore = createStore<KernelStore>()(() => ({ kernel: initialKernelState(contentIndex.rev) }));

const listeners = new Set<EffectListener>();

export function subscribeEffects(listener: EffectListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const deps = (): KernelDeps => ({
  registry: OS_REGISTRY,
  catalog: contentIndex,
  codec: routeCodec,
  prefs: getPrefs(),
  visible: VISIBLE_OSES,
  now: Date.now(),
});

let persistScheduled = false;

export function dispatch(action: KernelAction): KernelResult {
  const previous = kernelStore.getState().kernel;
  const result = reduce(previous, action, deps());
  if (result.state !== previous) {
    kernelStore.setState({ kernel: result.state });
    // Sessions persist through the debounced safe storage (250 ms); geometry only ever arrives committed.
    if (result.state.boot === 'ready' && !persistScheduled) {
      persistScheduled = true;
      queueMicrotask(() => {
        persistScheduled = false;
        writePersistedSessions(toPersisted(kernelStore.getState().kernel, Date.now(), contentIndex.rev));
      });
    }
  }
  if (result.prefsPatch) prefsStore.getState().patch(result.prefsPatch);
  if (result.state !== previous || result.focusTarget || result.routeIntent || result.events.length) {
    const effect: KernelEffect = { ...result, action, previous };
    for (const listener of listeners) listener(effect);
  }
  return result;
}

export const getKernel = (): KernelState => kernelStore.getState().kernel;
