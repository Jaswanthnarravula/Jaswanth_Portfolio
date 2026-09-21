/**
 * Kernel bridge — how the welcome island on `/` talks to the kernel without shipping it in the welcome bundle
 * (shared/10: the `os-kernel` chunk is not part of `/`'s first load). The island owns the *visual* Hello → intro →
 * profiles sequence and must answer input instantly; it sends the matching kernel actions here. Until the shell
 * runtime has booted the kernel they queue, then flush in order, so the kernel always sees the same sequence.
 * This module imports no kernel code (types only).
 */
import type { KernelAction } from '@/lib/kernel/actions';
import type { UserPreferences } from '@/lib/kernel/types';

export interface AttachedKernel {
  dispatch(action: KernelAction): unknown;
  prefs(): UserPreferences;
}

/** An action, or a function that builds it from the booted kernel (e.g. a prefs patch that must merge current values). */
export type KernelMessage = KernelAction | ((kernel: AttachedKernel) => KernelAction | null);

let kernel: AttachedKernel | null = null;
const queue: KernelMessage[] = [];
const waiting = new Set<(kernel: AttachedKernel) => void>();

function deliver(target: AttachedKernel, message: KernelMessage): void {
  const action = typeof message === 'function' ? message(target) : message;
  if (action) target.dispatch(action);
}

/** Called by the shell runtime after BOOT. Returns a detach function. */
export function attachKernel(target: AttachedKernel): () => void {
  kernel = target;
  for (const message of queue.splice(0)) deliver(target, message);
  for (const resolve of waiting) resolve(target);
  waiting.clear();
  return () => {
    if (kernel === target) kernel = null;
  };
}

/** Dispatch now if the kernel is booted, otherwise queue (order preserved). */
export function sendToKernel(message: KernelMessage): void {
  if (kernel) deliver(kernel, message);
  else queue.push(message);
}

/** The booted kernel, or null while it is still loading. */
export const attachedKernel = (): AttachedKernel | null => kernel;

/** Resolves once the kernel is booted (immediately if it already is). */
export function whenKernel(): Promise<AttachedKernel> {
  if (kernel) return Promise.resolve(kernel);
  return new Promise((resolve) => waiting.add(resolve));
}

/** Test seam: forget everything. */
export function resetKernelBridge(): void {
  kernel = null;
  queue.length = 0;
  waiting.clear();
}
