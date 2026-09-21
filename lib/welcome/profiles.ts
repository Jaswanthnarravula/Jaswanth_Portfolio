/**
 * "Who's watching?" profiles — plans/03-netflix-page.md (`NFLX-PROF-01`). Pure data: a name, an avatar and a
 * `PersonaId`. Every profile behaves identically (`NFLX-PROF-02`, `KRN-PERSONA-01`): nothing here may carry a
 * behaviour, destination, badge or content difference.
 */
import type { PersonaId } from '@/lib/kernel/ids';

export interface Profile {
  readonly id: PersonaId;
  readonly name: string;
  /** Manifest id: official avatar or the original geometric face, identical boxes in both modes. */
  readonly avatar: `avatar.${PersonaId}`;
}

export const PROFILES: readonly Profile[] = [
  { id: 'recruiter', name: 'Recruiter', avatar: 'avatar.recruiter' },
  { id: 'developer', name: 'Developer', avatar: 'avatar.developer' },
  { id: 'adventurer', name: 'Adventurer', avatar: 'avatar.adventurer' },
  { id: 'designer', name: 'Designer', avatar: 'avatar.designer' },
  { id: 'guest', name: 'Guest', avatar: 'avatar.guest' },
];
