/**
 * Pre-paint tier script — shared/10 `PERF-TIER-01`. Inlined in `<head>`, synchronous, ≤ 600 B raw. It only sets
 * `data-tier`, `data-motion`, `data-glass` (and `data-theme` when the visitor chose one) on `<html>`; tiers change
 * paint, never layout.
 *   T0 if: Save-Data / prefers-reduced-data · deviceMemory ≤ 2 · hardwareConcurrency ≤ 2 · no backdrop-filter ·
 *          forced-colors. Otherwise T1. A persisted governor demotion caps the tier until it expires.
 *   T2 is never decided here: it is evaluated in idle time after `load` (lib/webgl).
 * The in-app motion / transparency settings win over the system preference, so they apply before paint on reload.
 * Hand-minified (ES2020: arrow functions, optional catch binding and chaining). A top-level block keeps every `let`
 * out of the global scope; `(a),(b)` is a media-query list, i.e. OR.
 */
export const TIER_SCRIPT =
  "{let{dataset:d,style:s}=document.documentElement,n=navigator,o='(prefers-reduced-',F='full',R='reduced'," +
  "S='solid',m=q=>matchMedia(q).matches,p,z,r,g,t;" +
  "try{p=JSON.parse(localStorage['pf.prefs.v1']).state||{}}catch{p={}}r=p.motion;g=p.glass;z=p.demotion;" +
  't=n.connection?.saveData||n.deviceMemory<3||n.hardwareConcurrency<3||' +
  "!('backdropFilter'in s||'webkitBackdropFilter'in s)||m(o+'data),(forced-colors)')?0:1;" +
  'd.tier=z?.exp>Date.now()&&z.tier<t?z.tier:t;' +
  "d.motion=r==R||r!=F&&m(o+'motion)')?R:F;" +
  "d.glass=g==S||g!=F&&m(o+'transparency),(prefers-contrast:more)')?S:F;" +
  "(r=p.theme)&&r!='system'&&(d.theme=r)}";

/** Server-rendered defaults, used if the script cannot run. */
export const TIER_DEFAULTS = { 'data-tier': '1', 'data-motion': 'full', 'data-glass': 'full' } as const;
