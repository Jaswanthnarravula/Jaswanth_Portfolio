'use client';
/**
 * One iOS app on screen (plans/ios/02 "Model"): a fixed, full-page layer — never a window, never a frame. It is the
 * element the icon ↔ app flight moves (`surfaceMotion`); the shell orchestrates when it opens and where it returns.
 *   · the **launch layer** (the app's launch colour + its icon, centred) is there from the first frame of the flight, so
 *     feedback never waits for the app's chunk; it crossfades away between 15 % and 50 % of the way;
 *   · the app body mounts when the flight passes 90 % or lands (warm apps are already mounted → instant);
 *   · warm apps (the three most recent backgrounded) stay mounted under `<Activity mode="hidden">` with their state,
 *     scroll and nav stack intact (`IOS-FLIGHT-05`); `content-visibility` keeps a hidden surface free to render;
 *   · the sheet layer hosts the app's sheets (they fly with it; the app content scales back to 0.94 behind them);
 *   · a visually hidden `h2` names the region and takes focus on open (`IOS-FLIGHT-09`); screens' titles are `h3`+.
 * A chunk that cannot load leaves "Couldn't open {App}" with Retry and Home on the launch colour (plans/ios/06 E18).
 */
import {
  Activity,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { focusKeys, type WindowId } from '@/lib/kernel/types';
import { iconAsset, iosBinding, LAUNCH_COLOR, type IosLayout, type IosRole } from './model';
import { surfaceMotion, type SurfaceMotion } from './motion';
import { loadApp, loadedApp, type IosAppProps } from './apps/registry';
import { SheetHostContext, type SheetHost } from './ui/Sheet';
import styles from './ios.module.css';

/** foreground: in front, at rest · opening / closing: flying · background: warm, hidden · switcher: a live card. */
export type SurfaceState = 'foreground' | 'opening' | 'closing' | 'background' | 'switcher';

export interface SurfaceHandle {
  readonly element: HTMLElement;
  readonly motion: SurfaceMotion;
}

export interface AppSurfaceProps {
  readonly id: WindowId;
  readonly role: IosRole;
  readonly state: SurfaceState;
  readonly layout: IosLayout;
  readonly landscape: boolean;
  readonly dark: boolean;
  readonly register: (role: IosRole, handle: SurfaceHandle | null) => void;
  readonly onHome: () => void;
  /** A modal system menu (quick actions) sits over it: the app is inert behind it. */
  readonly covered?: boolean;
}

export function AppSurface({
  id,
  role,
  state,
  layout,
  landscape,
  dark,
  register,
  onHome,
  covered = false,
}: AppSurfaceProps) {
  const binding = iosBinding(role);
  const section = useRef<HTMLElement>(null);
  const launch = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(() => state === 'foreground' || state === 'background');
  const [Body, setBody] = useState<ComponentType<IosAppProps> | null>(() => loadedApp(role));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sheets, setSheets] = useState(0);
  const readyRef = useRef(ready);
  const markReady = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    // The body mounts at 90 % of the flight (plans/ios/02 step 4): that mount lays out, the flight itself never does,
    // so the perf test (IOS-MOTION-04) attributes the layout to this mark rather than to the animation.
    try {
      performance.mark(`pf-app-mount:${role}`);
    } catch {
      // marks are diagnostics only
    }
    setReady(true);
  }, [role]);

  // The flight's motion lives as long as the surface; the shell drives it through the registered handle. The body
  // mounts once the flight passes 90 % of the way (plans/ios/02 step 4).
  useLayoutEffect(() => {
    const el = section.current;
    if (!el) return;
    const motion = surfaceMotion(el, {
      id,
      launch: () => launch.current,
      onOpenness: (open) => {
        if (open > 0.9) markReady();
      },
    });
    register(role, { element: el, motion });
    return () => {
      register(role, null);
      motion.dispose();
    };
  }, [id, role, register, markReady]);

  // Load the app's chunk as soon as the surface exists (it overlaps the flight).
  useEffect(() => {
    if (Body) return;
    let alive = true;
    loadApp(role).then(
      (body) => alive && setBody(() => body),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [role, Body, attempt]);

  const sheetHost: SheetHost = useMemo(
    () => ({
      layer,
      setOpen: (_sheetId: string, open: boolean) => setSheets((count) => Math.max(0, count + (open ? 1 : -1))),
    }),
    [layer],
  );

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);
  // At rest in front, or as a live switcher card, the body is there.
  const bodyReady = ready || state === 'foreground' || state === 'switcher';
  const visible = state !== 'background';
  const headingId = `ios-app-${role}`;
  const colour = LAUNCH_COLOR[role][dark ? 'dark' : 'light'];

  return (
    <section
      ref={section}
      className={styles.surface}
      data-app-surface={role}
      data-state={state}
      data-sheet={sheets > 0 || undefined}
      aria-labelledby={headingId}
      inert={state === 'background' || state === 'closing' || state === 'switcher' || covered || undefined}
      aria-hidden={state === 'background' || undefined}
      style={{ ['--launch' as string]: colour }}
    >
      {/* Focus redirection only (no activation): the heading stays a plain programmatic focus target. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <h2
        id={headingId}
        className="sr-only"
        tabIndex={-1}
        data-focus-key={focusKeys.window(id)}
        // A modal open inside the app (Quick Look, a sheet) keeps focus: a later arrival focus on the app lands in it.
        // (A task later, so the kernel's focus request completes on the heading and does not fall back past it.)
        onFocus={(event) => {
          const heading = event.currentTarget;
          setTimeout(() => {
            if (document.activeElement !== heading) return;
            heading.parentElement
              ?.querySelector<HTMLElement>('[aria-modal="true"]')
              ?.querySelector<HTMLElement>('button:not([disabled]), a[href], input, textarea, [tabindex="0"]')
              ?.focus({ preventScroll: true });
          }, 0);
        }}
      >
        {binding.title}
      </h2>
      <div ref={launch} className={styles.launch} aria-hidden="true" data-launch="">
        <span className={styles.launchIcon}>
          <AssetIcon id={iconAsset(role)} size={180} fluid />
        </span>
      </div>
      <div className={styles.appContent} data-app-content="" data-layout={layout}>
        {failed ? (
          <div className={styles.appFailure} role="alert">
            <p>Couldn&rsquo;t open {binding.title}.</p>
            <p className={styles.appFailureActions}>
              <button type="button" onClick={retry}>
                Retry
              </button>
              <button type="button" onClick={onHome}>
                Home
              </button>
            </p>
            <p>
              <a href="/plain">Read the plain portfolio</a>
            </p>
          </div>
        ) : Body && bodyReady ? (
          <SheetHostContext.Provider value={sheetHost}>
            <Activity mode={visible ? 'visible' : 'hidden'}>
              <Body
                id={id}
                role={role}
                active={state === 'foreground'}
                layout={layout}
                landscape={landscape}
                headingId={headingId}
              />
            </Activity>
          </SheetHostContext.Provider>
        ) : (
          <div className={styles.appLoading} aria-busy="true" data-app-loading="" />
        )}
      </div>
      <div ref={setLayer} className={styles.sheetHost} data-sheet-layer="" />
    </section>
  );
}
