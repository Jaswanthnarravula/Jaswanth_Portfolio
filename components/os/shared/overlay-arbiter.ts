/**
 * Overlay arbiter — one transient surface at a time (plans/macos/06-edge-cases.md E15 / E22, `MAC-EDGE-04`; Windows
 * reuses it with its own table). Pure: given what is open and what is requested, it says what happens.
 *   · `open`     nothing is open → the request opens.
 *   · `keep`     the same surface is requested again → it stays (callers treat a second press as a toggle).
 *   · `replace`  the open surface closes first, then the request opens (menus and popovers close on any other request;
 *                a request that outranks the open surface replaces it).
 *   · `drop`     the open surface outranks the request, or blocks it (e.g. Spotlight while Mission Control is up).
 *   · `coexist`  banners never compete: they sit beside any surface and never take focus.
 * `pick` resolves requests that arrive in the same tick by priority (highest first).
 */

export type Verdict = 'open' | 'keep' | 'replace' | 'drop' | 'coexist';

export interface ArbiterTable<K extends string> {
  /** Highest priority first. */
  readonly priority: readonly K[];
  /** Surfaces that close whenever anything else is requested (menus, popovers). */
  readonly dismissable: readonly K[];
  /** Surfaces that never compete (banners). */
  readonly coexisting: readonly K[];
  /** `[open, requested]` pairs that are always dropped, whatever the priority says. */
  readonly blocks?: readonly (readonly [open: K, requested: K])[];
}

export function arbitrate<K extends string>(table: ArbiterTable<K>, open: K | null, requested: K): Verdict {
  if (table.coexisting.includes(requested)) return 'coexist';
  if (open === null || table.coexisting.includes(open)) return 'open';
  if (open === requested) return 'keep';
  if (table.blocks?.some(([a, b]) => a === open && b === requested)) return 'drop';
  if (table.dismissable.includes(open)) return 'replace';
  const rank = (kind: K) => {
    const index = table.priority.indexOf(kind);
    return index < 0 ? table.priority.length : index;
  };
  return rank(requested) < rank(open) ? 'replace' : 'drop';
}

/** Requests that arrive together: the highest-priority one wins; the rest are dropped (banners always pass). */
export function pick<K extends string>(table: ArbiterTable<K>, requests: readonly K[]): K | null {
  const competing = requests.filter((kind) => !table.coexisting.includes(kind));
  if (competing.length === 0) return null;
  return [...competing].sort((a, b) => {
    const ra = table.priority.indexOf(a);
    const rb = table.priority.indexOf(b);
    return (ra < 0 ? Infinity : ra) - (rb < 0 ? Infinity : rb);
  })[0]!;
}
