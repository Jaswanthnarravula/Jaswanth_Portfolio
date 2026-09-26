/**
 * The welcome layer on `/` — plans/02-hello-page.md (Hello) and plans/03-netflix-page.md (intro + "Who's watching?").
 * Each screen is the owner's storyboard frame (plans/visual-targets/{hello,intro,profiles}.png; each plan's "Visual
 * target"): the frame's markup, units and colours, with real data in its slots.
 * Server-rendered and complete without JavaScript: the accessible `<h1>` identifies the surface, the visible Hello
 * draws itself in CSS from first paint, and the pill jumps to real links. `WelcomeRoot` (client) only switches screens.
 * The opening stays deliberately generic; portfolio facts begin after the welcome flow.
 */
import { preload } from 'react-dom';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { resolveAsset } from '@/lib/assets/manifest';
import { OS_NAMES } from '@/lib/kernel/ids';
import { VISIBLE_OSES } from '@/lib/kernel/route';
import { focusKeys } from '@/lib/kernel/types';
import { WELCOME_SCRIPT } from '@/lib/kernel/welcome-script';
import { CHOOSER_HEADING, OS_CHARACTER } from '@/lib/welcome/chooser';
import helloPaths from '@/lib/welcome/hello-paths.generated.json';
import { PROFILES } from '@/lib/welcome/profiles';
import wordmark from '@/lib/welcome/wordmark.generated.json';
import { TEXT_FACE } from './chooser-fonts';
import { LENS_REFRACTION } from './refraction';
import {
  ProfileButton,
  ReplayIntro,
  RestartWelcome,
  SkipIntro,
  SoundToggle,
  TapToBegin,
  WelcomeRoot,
} from './WelcomeRoot';
import styles from './welcome.module.css';

const RESUME_PAGE = '/go/resume';
const PLAIN = '/plain';

/** The storyboard's text face (DS-FONT-01), declared and preloaded on `/` so the first paint already sets it. */
const FACE_CSS = `@font-face{font-family:'${TEXT_FACE.family}';src:url(${TEXT_FACE.src}) format('woff2');font-weight:${TEXT_FACE.weight};font-style:normal;font-display:swap}`;

/**
 * The intro label, set as the frame's `.mark` box (scripts/build-wordmark.mjs): glyphs on the box's baseline and the
 * frame's ellipse trimming their feet. `cutId` keeps the mask id unique per instance.
 */
function Wordmark({ className, cutId }: { className?: string; cutId: string }) {
  const [, , width, height] = wordmark.viewBox;
  const { cx, cy, rx, ry } = wordmark.cut;
  return (
    <svg
      className={className}
      viewBox={wordmark.viewBox.join(' ')}
      aria-hidden="true"
      focusable="false"
      data-wordmark
      style={{ ['--mark-em' as string]: wordmark.widthEm }}
    >
      <mask id={cutId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
        <rect width={width} height={height} fill="#fff" />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" />
      </mask>
      <path d={wordmark.d} mask={`url(#${cutId})`} />
    </svg>
  );
}

// The greeting box shows exactly the frame's view of the opening "hello" (hello-paths `frame`); the frame's ink is
// authored in its own units, so every length below is converted with `unit`.
const { box: FRAME_BOX, viewBox: FRAME_VIEW, unit: FRAME_UNIT } = helloPaths.frame;
const r2 = (n: number) => Math.round(n * 100) / 100;
const fx = (x: number) => r2(FRAME_VIEW[0]! + (x - FRAME_BOX[0]!) * FRAME_UNIT);
const fy = (y: number) => r2(FRAME_VIEW[1]! + (y - FRAME_BOX[1]!) * FRAME_UNIT);
const fl = (length: number) => r2(length * FRAME_UNIT);
/** The band the greetings sit in (frame units): the rod's light runs from its top to its bottom. */
const LIGHT = { x1: 0, y1: fy(235), x2: 0, y2: fy(495) } as const;
const ACROSS = { x1: fx(240), y1: 0, x2: fx(1040), y2: 0 } as const;

/**
 * Liquid-glass ink (owner decision 2026-09-21, plans/06 Deviations log): each greeting is a clear glass rod, drawn as
 * layered strokes of one path, bottom to top — a contact shadow, a hairline, the refracting edge in the field's colours,
 * a rim light, a clear body with the field seen flipped through it, light pooling on the lower inner edge, and a
 * specular line on the upper left that is hot on the tops of the loops and fades down the strokes. The highlight copies
 * are the path moved by less than half the rod's width minus their own, so they always stay inside the rod.
 * Entries: stroke, opacity, width, dx, dy (frame units).
 */
const ROD = [
  ['#2a3a8f', 0.16, 32, 0, 16],
  ['#1b2347', 0.2, 38, 0, 0],
  ['url(#hello-edge)', 0.66, 36, 0, 0],
  ['#fff', 0.62, 31, 0, 0],
  ['url(#hello-body)', 0.62, 27, 0, 0],
  ['url(#hello-flip)', 0.5, 27, 0, 0],
  ['url(#hello-caustic)', 1, 7, 3, 9],
  ['url(#hello-spec)', 1, 5, -4, -9],
  ['url(#hello-spec)', 1, 1.8, -5, -11],
] as const;

function GlassDefs() {
  return (
    <defs>
      <linearGradient id="hello-edge" gradientUnits="userSpaceOnUse" {...ACROSS}>
        <stop offset="0" stopColor="#5f7fff" />
        <stop offset=".5" stopColor="#9a86ff" />
        <stop offset="1" stopColor="#ff7fbf" />
      </linearGradient>
      <linearGradient id="hello-body" gradientUnits="userSpaceOnUse" {...ACROSS}>
        <stop offset="0" stopColor="#fdf3fb" />
        <stop offset=".5" stopColor="#f4f3ff" />
        <stop offset="1" stopColor="#eef4ff" />
      </linearGradient>
      {/* A cylinder flips what is behind it: the warm field below shows at the top, the blue above at the bottom. */}
      <linearGradient id="hello-flip" gradientUnits="userSpaceOnUse" {...LIGHT}>
        <stop offset="0" stopColor="#ffd6b8" />
        <stop offset=".55" stopColor="#f1e8ff" stopOpacity="0" />
        <stop offset="1" stopColor="#b9ccff" />
      </linearGradient>
      <linearGradient id="hello-caustic" gradientUnits="userSpaceOnUse" {...LIGHT}>
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".5" stopColor="#fff" stopOpacity=".2" />
        <stop offset="1" stopColor="#fff" stopOpacity=".95" />
      </linearGradient>
      <linearGradient id="hello-spec" gradientUnits="userSpaceOnUse" {...LIGHT}>
        <stop offset="0" stopColor="#fff" />
        <stop offset=".4" stopColor="#fff" stopOpacity=".9" />
        <stop offset="1" stopColor="#fff" stopOpacity=".12" />
      </linearGradient>
      {/* The only filter: the shadow's blur, over the whole greeting box so no greeting is ever clipped. */}
      <filter id="hello-soft" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1200" height="520">
        <feGaussianBlur stdDeviation={fl(8)} />
      </filter>
      {/* The lens's edge refraction (Chromium only, used from CSS `backdrop-filter`). refraction.ts inserts the map's
          <feImage> once it is painted: an feImage without an href would be fetched as an empty URL. */}
      <filter id="hello-refract" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB" data-refract-filter>
        <feDisplacementMap
          in="SourceGraphic"
          in2="map"
          scale={LENS_REFRACTION.scale}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  );
}

function Rod({ href }: { href: string }) {
  return ROD.map(([stroke, opacity, width, dx, dy], i) => (
    <use
      key={i}
      href={href}
      className={i === 0 ? styles.inkShadow : undefined}
      stroke={stroke}
      strokeOpacity={opacity}
      strokeWidth={fl(width)}
      transform={dx || dy ? `translate(${fl(dx)} ${fl(dy)})` : undefined}
    />
  ));
}

export function Welcome() {
  const hello = helloPaths.greetings[0]!;
  const audio = resolveAsset('audio.intro');
  preload(TEXT_FACE.src, { as: 'font', type: 'font/woff2', crossOrigin: '' });
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: WELCOME_SCRIPT }} />
      <style href="welcome-face" precedence="default">
        {FACE_CSS}
      </style>
      <WelcomeRoot
        className={styles.root}
        stalledClassName={styles.stalled}
        audioSrc={audio.render === 'audio' ? audio.src : null}
      >
        <div className={styles.field} aria-hidden="true" />
        {/* The frame's `.top`: "Skip the OS" left; "Résumé  ·  Sound on" right. */}
        <header className={styles.bar} data-welcome-bar>
          <a className={styles.barLink} href={PLAIN}>
            Skip the OS
          </a>
          <nav className={styles.barEnd} aria-label="Welcome">
            <a className={styles.barLink} href={RESUME_PAGE}>
              Résumé
            </a>
            <span className={styles.jsOnly}>
              <span className={styles.barDot} aria-hidden="true">
                {' \u00a0·\u00a0 '}
              </span>
              <SoundToggle className={`${styles.barLink} ${styles.sound}`}>
                Sound
                <span aria-hidden="true">
                  {'\u00a0'}
                  <span className={styles.soundOn}>on</span>
                  <span className={styles.soundOff}>off</span>
                </span>
              </SoundToggle>
            </span>
          </nav>
        </header>

        <main id="main" className={styles.screens}>
          <section className={`${styles.screen} ${styles.hello}`} aria-labelledby="hello-title">
            <div className={styles.lens} data-lens>
              {/* The glass's backdrop: blur everywhere; edge refraction where refraction.ts turns it on. */}
              <span className={styles.lensBackdrop} aria-hidden="true" />
              <svg className={styles.glyph} viewBox={FRAME_VIEW.join(' ')} aria-hidden="true" focusable="false">
                <GlassDefs />
                {/* Geometry only: the greeting loop morphs these; the rods below draw them. */}
                <defs>
                  <path id="hello-glyph" d={hello.d} pathLength={1} data-glyph />
                  <path id="hello-glyph-alt" pathLength={1} data-glyph-alt />
                </defs>
                <g className={styles.ink} data-ink>
                  <Rod href="#hello-glyph" />
                </g>
                <g className={styles.inkAlt} data-ink-alt>
                  <Rod href="#hello-glyph-alt" />
                </g>
              </svg>
              <h1 id="hello-title" className="sr-only">
                Hello
              </h1>
              <TapToBegin className={`${styles.pill} ${styles.jsOnly}`}>
                <span>Tap to begin</span>
              </TapToBegin>
              <a className={`${styles.pill} ${styles.noJs}`} href="#begin">
                <span>Tap to begin</span>
              </a>
            </div>
          </section>

          <section className={`${styles.screen} ${styles.intro}`} aria-label="Intro" data-intro>
            <p className="sr-only">{wordmark.text}</p>
            <Wordmark className={styles.wordmark} cutId="wordmark-cut-intro" />
            <SkipIntro className={styles.skip} />
          </section>

          <section className={`${styles.screen} ${styles.profiles}`} aria-labelledby="profiles-heading">
            <ReplayIntro className={styles.replay}>
              <Wordmark cutId="wordmark-cut-replay" />
            </ReplayIntro>
            <div className={styles.profilesMain}>
              <h1
                id="profiles-heading"
                className={styles.who}
                tabIndex={-1}
                data-focus-key={focusKeys.profilesHeading}
                data-profiles-heading
                data-profiles-fade
              >
                Who&rsquo;s watching?
              </h1>
              <div role="group" aria-labelledby="profiles-heading" className={styles.grid}>
                {PROFILES.map((profile) => (
                  <ProfileButton key={profile.id} id={profile.id} className={styles.card}>
                    <span className={styles.avatar} data-avatar>
                      <AssetIcon id={profile.avatar} size={200} className={styles.avatarArt} fluid />
                    </span>
                    <span className={styles.profileName} data-profile-name>
                      {profile.name}
                    </span>
                    <span className={styles.last} data-last-time>
                      Last time
                    </span>
                  </ProfileButton>
                ))}
              </div>
            </div>
            <footer className={styles.footer} data-profiles-fade>
              <RestartWelcome className={styles.restart}>Start at Hello</RestartWelcome>
              <a href={RESUME_PAGE}>Résumé</a>
              <a href={PLAIN}>Skip the OS</a>
            </footer>
          </section>
        </main>
      </WelcomeRoot>

      <noscript>
        <section id="begin" className={styles.fallback} aria-labelledby="begin-title">
          <h2 id="begin-title">{CHOOSER_HEADING}</h2>
          {VISIBLE_OSES.length > 0 ? (
            <nav aria-label="Operating systems">
              <ul>
                {VISIBLE_OSES.map((os) => (
                  <li key={os}>
                    <a href={`/${os}`}>
                      <strong>{OS_NAMES[os]}</strong> <span>{OS_CHARACTER[os]}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : (
            <p>The operating systems open here as each one is finished.</p>
          )}
          <p>
            <a href={PLAIN}>Read the plain portfolio</a> · <a href={RESUME_PAGE}>Résumé</a>
          </p>
        </section>
      </noscript>
    </>
  );
}
