'use client';
/**
 * `KernelLink` — launchers are real links (shared/09): a real `href` (works without JS, crawlable, middle-click opens
 * a new tab) whose plain left click is intercepted and turned into one kernel action (no RSC round trip).
 */
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import type { ContentRef } from '@/data/schema';
import type { AppRole, OsId } from '@/lib/kernel/ids';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { routeCodec } from '@/lib/kernel/route';
import { linuxLocationFor } from '@/lib/kernel/route/codec';
import type { AppLocation, RouteState } from '@/lib/kernel/types';
import { dispatchSoon } from '@/stores/kernel-store';

export type KernelTarget =
  | { readonly os: OsId; readonly role: AppRole; readonly location?: AppLocation }
  | { readonly os: OsId; readonly ref: ContentRef };

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>;

export interface KernelLinkProps extends AnchorProps {
  readonly to: KernelTarget;
  readonly children: ReactNode;
  /** Launcher element id — the motion layer measures it for the open flight. */
  readonly originId?: string;
  /** Focus key to return to when the opened window closes. */
  readonly invoker?: string;
  readonly onActivate?: () => void;
}

export function resolveTarget(to: KernelTarget): { role: AppRole; location?: AppLocation } {
  if ('ref' in to) {
    if (to.os === 'linux') return linuxLocationFor(to.ref);
    return { role: OS_REGISTRY[to.os].sectionOwner[to.ref.section], location: { kind: 'content', ref: to.ref } };
  }
  return { role: to.role, location: to.location };
}

export function hrefFor(to: KernelTarget): string {
  const { role, location } = resolveTarget(to);
  const route: RouteState = { kind: 'os', os: to.os, focus: { role, location: location ?? { kind: 'root' } } };
  return routeCodec.encode(route);
}

const isPlainClick = (event: MouseEvent<HTMLAnchorElement>) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export function KernelLink({ to, children, originId, invoker, onActivate, ...rest }: KernelLinkProps) {
  const href = hrefFor(to);
  return (
    <a
      {...rest}
      href={href}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        const { role, location } = resolveTarget(to);
        // The press paints first; the kernel commits in the next task (shared/10 INP: handlers stay O(1)).
        dispatchSoon({
          type: 'OPEN_APP',
          os: to.os,
          role,
          location,
          originId: originId ?? null,
          invoker: invoker ?? null,
        });
        onActivate?.();
      }}
    >
      {children}
    </a>
  );
}
