/**
 * Notification triggers → banners (plans/macos/surfaces/notifications.md `MAC-NOTIF-02`). Deterministic and identical
 * for every visitor: the input is the trigger and portfolio facts, never a persona. Notifications are useful shortcuts,
 * never noise; each one lands in the Notification Center too, however its banner was dismissed (WCAG 2.2.1).
 */
import type { AppRole, OsId } from '@/lib/kernel/ids';
import { OS_NAMES } from '@/lib/kernel/ids';
import type { MacCommand } from './commands';

export interface NotificationAction {
  readonly label: string;
  readonly command: MacCommand;
}

export interface MacNotificationSpec {
  /** Which app's badge and group it carries (`system` = the OS itself). */
  readonly app: AppRole | 'system';
  readonly appName: string;
  readonly title: string;
  readonly body: string;
  /** Clicking the banner body runs the primary action. */
  readonly action?: NotificationAction;
  readonly secondary?: NotificationAction;
  /** One per session (the welcome banner): a repeat trigger is dropped. */
  readonly once?: string;
}

export interface MacNotification extends MacNotificationSpec {
  readonly id: string;
  readonly at: number;
}

export type Trigger =
  | { readonly kind: 'welcome' }
  | { readonly kind: 'tour-offer' }
  | { readonly kind: 'continuity'; readonly title: string; readonly from: OsId; readonly command: MacCommand }
  | { readonly kind: 'resume-downloaded' }
  | { readonly kind: 'email-copied' }
  | { readonly kind: 'link-copied' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'online' }
  | { readonly kind: 'app-failed'; readonly role: AppRole; readonly name: string }
  | { readonly kind: 'konami' }
  | { readonly kind: 'storage-off' };

export function notificationFor(trigger: Trigger): MacNotificationSpec {
  switch (trigger.kind) {
    case 'welcome':
      return {
        app: 'system',
        appName: 'macOS',
        title: 'Welcome — everything here is an app.',
        body: 'Try Spotlight (Ctrl/Cmd+K).',
        action: { label: 'Open Spotlight', command: { kind: 'spotlight' } },
        once: 'welcome',
      };
    case 'tour-offer':
      return {
        app: 'system',
        appName: 'Tips',
        title: 'New here?',
        body: 'Take a 20-second tour.',
        action: { label: 'Start', command: { kind: 'tour' } },
        secondary: { label: 'Not now', command: { kind: 'tour-dismiss' } },
        once: 'tour-offer',
      };
    case 'continuity':
      return {
        app: 'system',
        appName: 'Handoff',
        title: `Continue: ${trigger.title}`,
        body: `From ${OS_NAMES[trigger.from]}`,
        action: { label: 'Open', command: trigger.command },
      };
    case 'resume-downloaded':
      return {
        app: 'viewer',
        appName: 'Preview',
        title: 'Résumé.pdf downloaded',
        body: 'Your browser saved it with your downloads.',
        action: { label: 'Show in Finder', command: { kind: 'open', role: 'files' } },
      };
    case 'email-copied':
      return { app: 'mail', appName: 'Mail', title: 'Email address copied', body: 'Paste it into any mail app.' };
    case 'link-copied':
      return { app: 'system', appName: 'macOS', title: 'Link copied', body: 'A link that opens this in any OS.' };
    case 'offline':
      return { app: 'system', appName: 'Network', title: 'You’re offline', body: 'Content still works.' };
    case 'online':
      return { app: 'system', appName: 'Network', title: 'Back online', body: 'Everything is reachable again.' };
    case 'app-failed':
      return {
        app: trigger.role,
        appName: trigger.name,
        title: `Couldn’t open ${trigger.name}`,
        body: 'Its content is also in the plain portfolio.',
        action: { label: 'Retry', command: { kind: 'open', role: trigger.role } },
        secondary: { label: 'Plain portfolio', command: { kind: 'plain' } },
      };
    case 'konami':
      return {
        app: 'system',
        appName: 'macOS',
        title: 'Cheat code accepted',
        body: 'Nothing unlocked — you already have full access.',
      };
    case 'storage-off':
      return {
        app: 'settings',
        appName: 'System Settings',
        title: 'Settings last for this visit',
        body: 'This browser is not saving site data, so preferences reset when you leave.',
      };
    default: {
      const exhaustive: never = trigger;
      return exhaustive;
    }
  }
}

export const BANNER_DWELL_MS = 6000;
export const BANNER_QUEUE_MAX = 3;

/**
 * Queue a banner (1 visible, at most 3 queued in all — the oldest waiting one drops silently into the Center, where every
 * notification already is). Returns the new queue.
 */
export function enqueue(queue: readonly MacNotification[], next: MacNotification): readonly MacNotification[] {
  const merged = [...queue, next];
  while (merged.length > BANNER_QUEUE_MAX) merged.splice(1, 1);
  return merged;
}
