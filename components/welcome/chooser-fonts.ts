/**
 * The storyboard faces — shared/06 `DS-FONT-01`, plans/02–04 "Visual target": IBM Plex Sans (all welcome and chooser
 * text) and Bricolage Grotesque 700 (the chooser heading), both OFL, self-hosted under /assets/fonts (immutable,
 * hashed). Plex is declared and preloaded by the welcome page (`Welcome.tsx`), so Hello's first paint already sets it.
 * Bricolage is registered through the FontFace API when the chooser mounts — never declared in a stylesheet — so no
 * page before the chooser fetches it. The chooser registers Plex too (same URL, served from cache) for the entries
 * that reach it without the welcome page.
 */
export const TEXT_FACE = {
  family: 'IBM Plex Sans',
  src: '/assets/fonts/ibm-plex-sans-latin-var.e2291e842c.woff2',
  weight: '100 700',
} as const;

export const CHOOSER_FONTS = [
  {
    family: 'Bricolage Grotesque',
    src: '/assets/fonts/bricolage-grotesque-700-latin.5dfb913640.woff2',
    weight: '700',
  },
  TEXT_FACE,
] as const;

let loading: Promise<void> | null = null;

/** Adds both faces once per document and loads them; never rejects (the system fallback keeps rendering). */
export function loadChooserFonts(): Promise<void> {
  if (loading) return loading;
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts)
    return (loading = Promise.resolve());
  loading = Promise.all(
    CHOOSER_FONTS.map(({ family, src, weight }) => {
      const face = new FontFace(family, `url(${src}) format('woff2')`, { weight, style: 'normal', display: 'swap' });
      document.fonts.add(face);
      return face.load();
    }),
  ).then(
    () => undefined,
    () => undefined,
  );
  return loading;
}

/** Both faces are ready, or `capMs` has passed — whichever comes first. The reveal never waits longer than the cap. */
export function chooserFontsReady(capMs = 300): Promise<void> {
  return Promise.race([loadChooserFonts(), new Promise<void>((resolve) => setTimeout(resolve, capMs))]);
}
