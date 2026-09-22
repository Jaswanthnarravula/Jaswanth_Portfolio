/**
 * Pre-paint welcome hint — plans/02-hello-page.md "Returning visitor" (`HELLO-RETURN-01`, `NFLX-RETURN-01`).
 * Inlined on `/` only, before the welcome markup: a returning visitor (`prefs.introSeen`) is marked
 * `data-welcome="profiles"` so the first paint already shows "Who's watching?" (no flash of Hello), the last profile
 * is marked `data-persona` ("Last time"), and a muted visitor is marked `data-sound="off"` so the Sound toggle paints
 * in its real state. The island reads the same attributes after hydration. Never throws.
 */
import { PREFS_KEY } from './persist/prefs';

export const WELCOME_SCRIPT =
  `{try{let p=JSON.parse(localStorage['${PREFS_KEY}']).state,d=document.documentElement.dataset;` +
  "/^[a-z]{1,12}$/.test(p.persona||'')&&(d.persona=p.persona);" +
  "p.sound?.enabled===false&&(d.sound='off')}catch{}}";
