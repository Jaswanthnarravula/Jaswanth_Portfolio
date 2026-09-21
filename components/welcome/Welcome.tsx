/**
 * The welcome layer on `/` — plans/02-hello-page.md (Hello) and plans/03-netflix-page.md (intro + "Who's watching?").
 * Server-rendered and complete without JavaScript: the `<h1>` is the LCP element and never starts hidden, the Hello
 * draws itself in CSS from first paint, the pill jumps to real links. `WelcomeRoot` (client) only switches screens.
 * Personal copy comes from the data layer; nothing here is typed career content.
 */
import { AssetIcon } from '@/components/ui/AssetIcon';
import { getPerson } from '@/data/selectors';
import { resolveAsset } from '@/lib/assets/manifest';
import { OS_NAMES } from '@/lib/kernel/ids';
import { VISIBLE_OSES } from '@/lib/kernel/route';
import { focusKeys } from '@/lib/kernel/types';
import { WELCOME_SCRIPT } from '@/lib/kernel/welcome-script';
import { CHOOSER_HEADING, OS_CHARACTER } from '@/lib/welcome/chooser';
import helloPaths from '@/lib/welcome/hello-paths.generated.json';
import { PROFILES } from '@/lib/welcome/profiles';
import wordmark from '@/lib/welcome/wordmark.generated.json';
import { ProfileButton, ReplayIntro, SkipIntro, SoundToggle, TapToBegin, WelcomeRoot } from './WelcomeRoot';
import styles from './welcome.module.css';

const RESUME_PAGE = '/go/resume';
const PLAIN = '/plain';

function Wordmark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={wordmark.viewBox.join(' ')} aria-hidden="true" focusable="false" data-wordmark>
      <path d={wordmark.d} />
    </svg>
  );
}

/**
 * The storyboard's glass ink for the greeting stroke (view box 0 0 1000 320): a blue → lilac → pink body, a soft drop
 * shadow, a navy hairline, depth on the lower edge, a specular highlight and a white rim with chromatic fringes.
 */
function GlassInk() {
  return (
    <defs>
      <linearGradient id="hello-ink" gradientUnits="userSpaceOnUse" x1="80" y1="0" x2="920" y2="0">
        <stop offset="0" stopColor="#8fb0ff" stopOpacity=".62" />
        <stop offset=".5" stopColor="#d9d2ff" stopOpacity=".5" />
        <stop offset="1" stopColor="#ffb3d9" stopOpacity=".62" />
      </linearGradient>
      <filter
        id="hello-glass"
        filterUnits="userSpaceOnUse"
        x="-40"
        y="-40"
        width="1080"
        height="400"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="sb" />
        <feOffset in="sb" dy="12" result="so" />
        <feFlood floodColor="#23306e" floodOpacity=".3" />
        <feComposite in2="so" operator="in" result="shadow" />
        <feMorphology in="SourceAlpha" operator="dilate" radius="1.4" result="dl" />
        <feComposite in="dl" in2="SourceAlpha" operator="out" result="ol" />
        <feFlood floodColor="#1b2347" floodOpacity=".3" />
        <feComposite in2="ol" operator="in" result="hair" />
        <feOffset in="SourceAlpha" dy="-9" result="up" />
        <feComposite in="SourceAlpha" in2="up" operator="out" result="low" />
        <feGaussianBlur in="low" stdDeviation="4" result="lowb" />
        <feFlood floodColor="#3f4fc4" floodOpacity=".6" />
        <feComposite in2="lowb" operator="in" />
        <feComposite in2="SourceAlpha" operator="in" result="depth" />
        <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="bump" />
        <feSpecularLighting
          in="bump"
          surfaceScale="8"
          specularConstant="1.15"
          specularExponent="30"
          lightingColor="#fff"
          result="sp"
        >
          <feDistantLight azimuth="235" elevation="55" />
        </feSpecularLighting>
        <feComposite in="sp" in2="SourceAlpha" operator="in" result="spec" />
        <feMorphology in="SourceAlpha" operator="erode" radius="3" result="er" />
        <feComposite in="SourceAlpha" in2="er" operator="out" result="ring" />
        <feGaussianBlur in="ring" stdDeviation=".9" result="ringb" />
        <feFlood floodColor="#fff" floodOpacity=".95" />
        <feComposite in2="ringb" operator="in" result="rim" />
        <feOffset in="ringb" dx="2" dy="1" result="rr" />
        <feFlood floodColor="#ff8fcf" floodOpacity=".45" />
        <feComposite in2="rr" operator="in" />
        <feComposite in2="SourceAlpha" operator="in" result="fr" />
        <feOffset in="ringb" dx="-2" dy="-1" result="rb" />
        <feFlood floodColor="#7fa8ff" floodOpacity=".5" />
        <feComposite in2="rb" operator="in" />
        <feComposite in2="SourceAlpha" operator="in" result="fb" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="hair" />
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="depth" />
          <feMergeNode in="fr" />
          <feMergeNode in="fb" />
          <feMergeNode in="spec" />
          <feMergeNode in="rim" />
        </feMerge>
      </filter>
    </defs>
  );
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  reader: 'M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z M12 6v13.5',
  resume: 'M7 3h7l4 4v14H7z M14 3v4h4 M10 12h5 M10 16h5',
  soundOn: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4.2 4.2 0 0 1 0 6 M18 6.5a7.8 7.8 0 0 1 0 11',
  soundOff: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z M16 9.5l5 5 M21 9.5l-5 5',
  arrow: 'M5 12h13 M13 7l5 5-5 5',
} as const;

export function Welcome() {
  const person = getPerson();
  const hello = helloPaths.greetings[0]!;
  const audio = resolveAsset('audio.intro');
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: WELCOME_SCRIPT }} />
      <WelcomeRoot
        className={styles.root}
        stalledClassName={styles.stalled}
        audioSrc={audio.render === 'audio' ? audio.src : null}
      >
        <div className={styles.field} aria-hidden="true" />
        <header className={styles.bar} data-welcome-bar>
          <a className={styles.barLink} href={PLAIN}>
            <Icon d={ICONS.reader} className={styles.barIcon} />
            <span className={styles.barText}>Skip the OS</span>
          </a>
          <nav className={styles.barEnd} aria-label="Welcome">
            <a className={styles.barLink} href={RESUME_PAGE}>
              <Icon d={ICONS.resume} className={styles.barIcon} />
              <span className={styles.barText}>Résumé</span>
            </a>
            <SoundToggle className={`${styles.sound} ${styles.jsOnly}`}>
              <Icon d={ICONS.soundOn} className={styles.soundOn} />
              <Icon d={ICONS.soundOff} className={styles.soundOff} />
              <span className="sr-only">Sound</span>
            </SoundToggle>
          </nav>
        </header>

        <main id="main" className={styles.screens}>
          <section className={`${styles.screen} ${styles.hello}`} aria-labelledby="hello-title">
            <div className={`${styles.lens} ${styles.glass}`} data-lens>
              <svg className={styles.glyph} viewBox={helloPaths.viewBox.join(' ')} aria-hidden="true" focusable="false">
                <GlassInk />
                <path className={styles.glyphPath} d={hello.d} pathLength={1} data-glyph />
                <path className={styles.glyphAlt} data-glyph-alt />
              </svg>
              <p className="sr-only">Hello</p>
              <h1 id="hello-title" className={styles.title}>
                <span className={styles.name}>{person.givenName}</span>
                <span className="sr-only"> — </span>
                <span className={styles.headline}>{person.headline}</span>
              </h1>
              <TapToBegin className={`${styles.pill} ${styles.jsOnly}`}>
                <span className={styles.pillLabel}>Tap to begin</span>
                <Icon d={ICONS.arrow} className={styles.pillIcon} />
              </TapToBegin>
              <a className={`${styles.pill} ${styles.noJs}`} href="#begin">
                <span className={styles.pillLabel}>Tap to begin</span>
                <Icon d={ICONS.arrow} className={styles.pillIcon} />
              </a>
            </div>
          </section>

          <section className={`${styles.screen} ${styles.intro}`} aria-label="Intro" data-intro>
            <p className="sr-only">{person.givenName}</p>
            <Wordmark className={styles.wordmark} />
            <SkipIntro className={styles.skip} />
          </section>

          <section className={`${styles.screen} ${styles.profiles}`} aria-labelledby="profiles-heading">
            <ReplayIntro className={styles.replay}>
              <Wordmark />
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
