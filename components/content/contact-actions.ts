/**
 * Contact hand-off actions — shared/03 `VIEW-CONTACT-01`. Typed, dependency-free, no network calls:
 *   mailto(subject, body) → builds a correctly encoded `mailto:` URL
 *   copy(text)            → Clipboard API, with a select-the-text fallback when it is blocked
 *   open(link)            → new tab with `rel="noopener noreferrer"` (rendered as a plain anchor)
 */
export function mailtoUrl({ email, subject, body }: { email: string; subject?: string; body?: string }): string {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`);
  return `mailto:${email}${params.length ? `?${params.join('&')}` : ''}`;
}

export type CopyOutcome = 'copied' | 'fallback';

/** Resolves `fallback` when the Clipboard API is missing or rejects; the caller then shows the selectable field. */
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined,
): Promise<CopyOutcome> {
  if (!clipboard) return 'fallback';
  try {
    await clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'fallback';
  }
}
