/** Analytics event catalogue — shared/18 `ANL-EVENT-01`. Types only: no PII, no free text, no query strings. */
import type { AppRole, OsId, PersonaId, SectionId } from '@/lib/kernel/ids';
import type { RoutePath, Tier } from '@/lib/kernel/types';

export type SearchKind = 'app' | 'content' | 'action' | 'command';

export type AnalyticsEvent =
  | { readonly name: 'persona_selected'; readonly persona: PersonaId }
  | { readonly name: 'os_entered'; readonly os: OsId; readonly via: 'chooser' | 'deep-link' | 'switch' | 'go' }
  | { readonly name: 'app_opened'; readonly os: OsId; readonly role: AppRole; readonly section?: SectionId }
  | { readonly name: 'resume_downloaded'; readonly os: OsId | 'pre-os' | 'plain' }
  | { readonly name: 'contact_initiated'; readonly channel: 'mailto' | 'copy' | 'link' }
  | { readonly name: 'search_used'; readonly os: OsId; readonly resultKind: SearchKind | 'none' }
  | { readonly name: 'hint_used'; readonly step: 'shown' | 'revealed' | 'pasted' }
  | {
      readonly name: 'continuity_offered' | 'continuity_accepted';
      readonly from: OsId;
      readonly to: OsId;
      readonly section: SectionId;
    }
  | { readonly name: 'tour_started' | 'tour_completed' | 'tour_cancelled'; readonly os: OsId }
  | { readonly name: 'egg_found'; readonly id: string }
  | {
      readonly name: 'tier';
      readonly tier: Tier;
      readonly motion: 'full' | 'reduced';
      readonly glass: 'full' | 'solid';
    }
  | { readonly name: 'intro'; readonly outcome: 'played' | 'skipped' | 'muted' };

export interface AnalyticsPort {
  track(event: AnalyticsEvent): void;
  pageview(path: RoutePath): void;
}
