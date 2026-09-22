'use client';
/**
 * The macOS content slots (shared/03 `VIEW-SLOT-01`): content views link through the kernel (in-OS, shallow) and the
 * résumé's Download is a real `<a download>` that records `resume_downloaded` (shared/14 `RES-DL-01`).
 */
import type { ActionSlotProps, LinkSlotProps, ViewSlots } from '@/components/content';
import { KernelLink } from '@/components/shell/KernelLink';
import { analytics } from '@/lib/analytics/loader';

function MacLink({ to, children, ...rest }: LinkSlotProps) {
  return (
    <KernelLink to={{ os: 'macos', ref: to }} {...rest}>
      {children}
    </KernelLink>
  );
}

function MacAction({ action, children, className }: ActionSlotProps) {
  if (action.kind === 'download')
    return (
      <a
        className={className}
        href={action.href}
        download={action.filename}
        type="application/pdf"
        onClick={() => analytics.track({ name: 'resume_downloaded', os: 'macos' })}
      >
        {children}
      </a>
    );
  return null;
}

export const MAC_SLOTS: Partial<ViewSlots> = { Link: MacLink, Action: MacAction };
