/** System-wide search — shared/15. One index, one matcher, five skins. */
import type { ContentRef } from '@/data/schema';
import type { AppRole } from '@/lib/kernel/ids';
import type { SearchKind } from '@/lib/analytics/events';

export type { SearchKind };

export type KernelActionId =
  'switch-os' | 'toggle-sound' | 'reduce-motion' | 'open-resume' | 'start-tour' | 'show-shortcuts';

export interface SearchEntry {
  readonly id: string;
  readonly kind: SearchKind;
  readonly title: string;
  readonly subtitle?: string;
  readonly keywords: readonly string[];
  readonly ref?: ContentRef;
  readonly role?: AppRole;
  readonly action?: KernelActionId;
  readonly command?: string;
  readonly weight: number;
}

export interface SearchResult extends SearchEntry {
  readonly score: number;
  /** Matched ranges in `title`, half-open. */
  readonly matched: readonly (readonly [start: number, end: number])[];
}

export interface CommandInfo {
  readonly name: string;
  readonly summary: string;
  readonly aliases?: readonly string[];
}
