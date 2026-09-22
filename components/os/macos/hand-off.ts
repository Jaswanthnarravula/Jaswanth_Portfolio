/**
 * Leaving the page on purpose — the `mailto:` hand-off to the visitor's own email app (`VIEW-CONTACT-01`) and the plain
 * portfolio. One place, so tests can observe the destination without navigating the test page.
 */
export function openMailto(url: string): void {
  window.location.href = url;
}

export function openPlain(): void {
  window.location.assign(new URL('/plain', window.location.origin));
}
