'use client';
/**
 * One iOS app on screen (plans/ios/02 "Model"): a fixed, full-page layer — never a window, never a frame. It is the
 * element the icon ↔ app flight moves (`surfaceMotion`); the shell orchestrates when it opens and where it returns.
 *   · the **launch layer** (the app's launch colour + its icon, centred) is there from the first frame of the flight, so
 *     feedback never waits for the app's chunk; it crossfades away between 15 % and 50 % of the way;
 *   · the app body starts rendering on the flight's first frame as a background (time-sliced) update, so it is laid out
 *     — still unpainted — long before it is revealed near the landing (warm apps are already mounted → instant). The
 *     press's own task stays light: mounting there could not be sliced and held the first frame back 90–130 ms;
 *   · the surface is memoized, and so is its body element: a shell update (a phase, a banner, the kernel) never
 *     re-renders the apps it does not concern;
 *   · warm apps (the three most recent backgrounded) stay mounted under `<Activity mode="hidden">` with their state,
 *     scroll and nav stack intact (`IOS-FLIGHT-05`); `content-visibility` keeps a hidden surface free to render;
 *   · the sheet layer hosts the app's sheets (they fly with it; the app content scales back to 0.94 behind them);
 *   · a visually hidden `h2` names the region and takes focus on open (`IOS-FLIGHT-09`); screens' titles are `h3`+.
 * A chunk that cannot load leaves "Couldn't open {App}" with Retry and Home on the launch colour (plans/ios/06 E18).
 */
import {
  Activity,
  memo,
  startTransition,
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

/** A modal open inside the app (Quick Look, a sheet) keeps focus: focus resting on the app's heading moves into it. */
function focusOpenModal(heading: HTMLElement) {
  if (document.activeElement !== heading) return;
  heading.parentElement
    ?.querySelector<HTMLElement>('[aria-modal="true"]')
    ?.querySelector<HTMLElement>('button:not([disabled]), a[href], input, textarea, [tabindex="0"]')
    ?.focus({ preventScroll: true });
}

/**
 * Marks the body's commit before the body's own layout effects run (siblings run in order): one of them may read
 * layout, and the perf test (IOS-MOTION-04) attributes that one mount layout to this mark, not to the animation.
 */
function MountMark({ role }: { role: IosRole }) {
  useLayoutEffect(() => {
    try {
      performance.mark(`pf-app-mount:${role}`);
    } catch {
      // marks are diagnostics only
    }
  }, [role]);
  return null;
}

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

export const AppSurface = memo(function AppSurface({
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
  const heading = useRef<HTMLHeadingElement>(null);
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
    // A background render: React slices it between the flight's frames instead of stalling one of them.
    startTransition(() => setReady(true));
  }, []);

  // The flight's motion lives as long as the surface; the shell drives it through the registered handle. The body
  // starts rendering on the flight's first frame: `surfaceMotion` keeps it unpainted until near the landing, so the
  // mount costs one layout while the surface is still small, and the app is there when it is revealed.
  useLayoutEffect(() => {
    const el = section.current;
    if (!el) return;
    const motion = surfaceMotion(el, {
      id,
      launch: () => launch.current,
      onOpenness: (open) => {
        if (open > 0) markReady();
      },
    });
    register(role, { element: el, motion });
    return () => {
      register(role, null);
      motion.dispose();
    };
  }, [id, role, register, markReady]);

  // Load the app's chunk as soon as the surface exists (it overlaps the flight); a late chunk renders in the background.
  useEffect(() => {
    if (Body) return;
    let alive = true;
    loadApp(role).then(
      (body) => alive && startTransition(() => setBody(() => body)),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [role, Body, attempt]);

  // A modal that opened while the body was still unpainted mid-flight could not take focus then; on landing, focus
  // still on the heading moves into it (the heading was focused at the flight's start, so it gets no new focus event).
  useEffect(() => {
    if (state === 'foreground' && heading.current) focusOpenModal(heading.current);
  }, [state]);

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
  const visible = state !== 'background';
  const headingId = `ios-app-${role}`;
  const colour = LAUNCH_COLOR[role][dark ? 'dark' : 'light'];
  const active = state === 'foreground';
  // At rest in front, or as a live switcher card.
  const mounted = Body !== null && (ready || state === 'foreground' || state === 'switcher');
  // The same element while the app's own props hold: React skips the app's whole tree on a surface re-render.
  const body = useMemo(
    () =>
      Body ? (
        <Body id={id} role={role} active={active} layout={layout} landscape={landscape} headingId={headingId} />
      ) : null,
    [Body, id, role, active, layout, landscape, headingId],
  );

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
        ref={heading}
        id={headingId}
        className="sr-only"
        tabIndex={-1}
        data-focus-key={focusKeys.window(id)}
        // A modal open inside the app (Quick Look, a sheet) keeps focus: a later arrival focus on the app lands in it.
        // (A task later, so the kernel's focus request completes on the heading and does not fall back past it.)
        onFocus={(event) => {
          const target = event.currentTarget;
          setTimeout(() => focusOpenModal(target), 0);
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
        ) : mounted ? (
          <SheetHostContext.Provider value={sheetHost}>
            <MountMark role={role} />
            <Activity mode={visible ? 'visible' : 'hidden'}>{body}</Activity>
          </SheetHostContext.Provider>
        ) : (
          <div className={styles.appLoading} aria-busy="true" data-app-loading="" />
        )}
      </div>
      <div ref={setLayer} className={styles.sheetHost} data-sheet-layer="" />
    </section>
  );
});
