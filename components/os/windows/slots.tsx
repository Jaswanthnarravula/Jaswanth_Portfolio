'use client';
/**
 * The Windows content slots (shared/03 `VIEW-SLOT-01`): content views link through the kernel (in-OS, shallow), the
 * résumé's Download is a real `<a download>` that records `resume_downloaded` and raises the Windows toast
 * "Résumé.pdf — Download complete" (shared/14 `RES-DL-01`, plans/windows/surfaces/notification-center), and Copy uses
 * the clipboard with the "Copied to clipboard" toast (a blocked clipboard falls back to a selected field).
 */
import type { ActionSlotProps, LinkSlotProps, ViewSlots } from '@/components/content';
import { KernelLink } from '@/components/shell/KernelLink';
import { analytics } from '@/lib/analytics/loader';
import { dispatchSoon } from '@/stores/kernel-store';
import { useWinShell, type ToastSpec } from './shell-context';

function WinLink({ to, children, ...rest }: LinkSlotProps) {
  return (
    <KernelLink to={{ os: 'windows', ref: to }} {...rest}>
      {children}
    </KernelLink>
  );
}

function WinAction({ action, children, className }: ActionSlotProps) {
  const shell = useWinShell();
  if (action.kind === 'download')
    return (
      <a
        className={className}
        href={action.href}
        download={action.filename}
        type="application/pdf"
        data-resume-download=""
        onClick={() => {
          analytics.track({ name: 'resume_downloaded', os: 'windows' });
          shell.notify(downloadToast(action.filename));
        }}
      >
        {children}
      </a>
    );
  if (action.kind === 'copy')
    return (
      <button type="button" className={className} onClick={() => shell.copyText(action.text, 'Copied to clipboard')}>
        {children}
      </button>
    );
  return null;
}

/** "Résumé.pdf — Download complete" · Open file · Show in folder (plans/windows/surfaces/notification-center). */
export const downloadToast = (_filename: string): ToastSpec => ({
  id: 'download-resume',
  app: 'browser',
  appName: 'Microsoft Edge',
  title: 'Résumé.pdf',
  body: 'Download complete',
  attention: 'browser',
  actions: [
    {
      label: 'Open file',
      primary: true,
      run: () =>
        dispatchSoon({
          type: 'OPEN_APP',
          os: 'windows',
          role: 'browser',
          location: { kind: 'content', ref: { section: 'resume' } },
        }),
    },
    {
      label: 'Show in folder',
      run: () => dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: 'files', location: { kind: 'root' } }),
    },
  ],
});

export const WIN_SLOTS: Partial<ViewSlots> = { Link: WinLink, Action: WinAction };
