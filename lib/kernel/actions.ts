/**
 * Kernel actions — shared/04 "Actions". Every action returns `{ state, focusTarget, routeIntent }`.
 * The clock is injected once through the reducer's `deps.now`, never carried by actions.
 */
import type { ContentRef } from '@/data/schema';
import type { AppRole, OsId, PersonaId } from './ids';
import type { PointerKind } from './geometry';
import type {
  AppLocation,
  CapabilityProfile,
  Epoch,
  Onboarding,
  PersistedSessionsV1,
  PxRect,
  SnapZone,
  TransitionFailure,
  UserPreferences,
  WindowId,
} from './types';

export type NavigationType = 'navigate' | 'reload' | 'back_forward' | 'prerender';

/** How an OS switch was requested — feeds `arrival` and the `os_entered` event. */
export type SwitchVia = 'chooser' | 'switch' | 'history';

export type KernelAction =
  | {
      readonly type: 'BOOT';
      readonly url: string;
      readonly navType: NavigationType;
      readonly viewport: { readonly w: number; readonly h: number; readonly pointer: PointerKind };
      readonly persisted: PersistedSessionsV1 | null;
      readonly capabilities: CapabilityProfile;
    }
  | { readonly type: 'ROUTE_CHANGED'; readonly url: string }
  | { readonly type: 'VIEWPORT_CHANGED'; readonly w: number; readonly h: number; readonly pointer: PointerKind }
  | {
      readonly type: 'OPEN_APP';
      readonly role: AppRole;
      readonly os?: OsId;
      readonly location?: AppLocation;
      readonly originId?: string | null;
      readonly invoker?: string | null;
    }
  | { readonly type: 'CLOSE_WINDOW'; readonly id: WindowId }
  /** addition (plans/macos/02 `MAC-WM-07`): Quit closes the app's window (if any) and stops the app — its Dock dot goes. */
  | { readonly type: 'QUIT_APP'; readonly role: AppRole; readonly os?: OsId }
  /** addition (`MAC-WM-12`): Hide Others — every other window goes to the Dock at once. */
  | { readonly type: 'HIDE_OTHERS'; readonly id: WindowId }
  /** addition (`MAC-WM-12`): Show All — every minimized window comes back; focus stays where it is. */
  | { readonly type: 'SHOW_ALL'; readonly os?: OsId }
  | {
      readonly type: 'FOCUS_WINDOW';
      readonly id: WindowId;
      /** addition: a press inside the window focused it; the browser already put focus where the press landed. */
      readonly via?: 'pointer';
    }
  | { readonly type: 'MINIMIZE'; readonly id: WindowId }
  | { readonly type: 'RESTORE'; readonly id: WindowId }
  | { readonly type: 'TOGGLE_MAXIMIZE'; readonly id: WindowId }
  | { readonly type: 'COMMIT_RECT'; readonly id: WindowId; readonly rect: PxRect }
  /** addition (plans/windows/02 Snap): snap a window into a zone, or `null` to leave it floating where it shows. */
  | { readonly type: 'SNAP_WINDOW'; readonly id: WindowId; readonly zone: SnapZone | null }
  /** addition: move the shared edge of ½ + ½ snapped windows (paired resize), as a fraction of the workspace. */
  | { readonly type: 'SET_SNAP_SPLIT'; readonly os: OsId; readonly split: number }
  | { readonly type: 'NAVIGATE_IN_APP'; readonly id: WindowId; readonly location: AppLocation }
  | { readonly type: 'APP_BACK'; readonly id: WindowId }
  | { readonly type: 'APP_FORWARD'; readonly id: WindowId }
  | { readonly type: 'SET_SCROLL'; readonly id: WindowId; readonly top: number }
  | { readonly type: 'SET_DRAFT'; readonly id: WindowId; readonly draft: string }
  | { readonly type: 'GO_HOME' }
  | { readonly type: 'SWITCH_OS'; readonly to: OsId | null; readonly via: SwitchVia }
  | {
      readonly type: 'PHASE_DONE';
      readonly target:
        { readonly kind: 'os'; readonly epoch: Epoch } | { readonly kind: 'window'; readonly id: WindowId };
    }
  | { readonly type: 'TRANSITION_FAILED'; readonly epoch: Epoch; readonly reason: TransitionFailure }
  | { readonly type: 'RETRY_TRANSITION' }
  | { readonly type: 'ONBOARDING_ADVANCE'; readonly to?: Onboarding }
  | { readonly type: 'SELECT_PERSONA'; readonly id: PersonaId }
  | { readonly type: 'SET_PREF'; readonly patch: Partial<Omit<UserPreferences, 'v'>> }
  | { readonly type: 'TERMINAL_SET_CWD'; readonly os: OsId; readonly cwd: readonly string[] }
  | {
      readonly type: 'TERMINAL_RECORD';
      readonly os: OsId;
      readonly command: string;
      readonly output: readonly string[];
    }
  /** `history` is an addition: `history -c` drops the persisted history (the scrollback stays). */
  | { readonly type: 'TERMINAL_CLEAR'; readonly os: OsId; readonly history?: true }
  | { readonly type: 'CONTINUITY_CAPTURE'; readonly ref: ContentRef; readonly os: OsId }
  | { readonly type: 'CONTINUITY_DISMISS' }
  | { readonly type: 'MARK_BOOT_SEEN'; readonly os: OsId }
  | { readonly type: 'MARK_LOCK_SEEN'; readonly os: OsId };

export type KernelActionType = KernelAction['type'];
export type ActionOf<T extends KernelActionType> = Extract<KernelAction, { type: T }>;
