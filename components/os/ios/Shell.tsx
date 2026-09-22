'use client';
/**
 * The ios chunk entry (shared/01 `ARCH-SPLIT-01`: one lazy chunk per OS). Until the real shell is built in its
 * phase, the chunk renders the preview stub; the OS stays unreleased (`OS_REGISTRY.ios.released === false`).
 * The marker string identifies this chunk in the "visiting one OS requests no other OS's chunk" check.
 */
import StubOs from '@/components/shell/StubOs';
import type { OsShellProps } from '@/lib/os-loaders';

export const OS_CHUNK_MARKER = 'pf-os-chunk:ios';

export default function IosShell(props: OsShellProps) {
  return <StubOs {...props} chunk={OS_CHUNK_MARKER} />;
}
