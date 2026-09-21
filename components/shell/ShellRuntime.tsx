'use client';
/**
 * Shell runtime (lazy `os-kernel` chunk). One idempotent boot effect wires the kernel to the browser:
 * capabilities → prefs → sessions → BOOT → RouteSync (next frame) → FocusManager → viewport → analytics.
 * OS trees mount only when `boot === 'ready'`; the OS layer fades in above the semantic page (no layout change).
 */
import { useRouter } from 'next/navigation';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { contentIndex } from '@/data/content-index';
import { analyticsPath, createPageviewTracker } from '@/lib/analytics';
import { analytics, startAnalytics } from '@/lib/analytics/loader';
import { bootAction, markShellInstance, watchViewport } from '@/lib/kernel/boot';
import { focusIsOnBody, moveFocusOutOf } from '@/lib/kernel/focus';
import { startFocusManager } from '@/lib/kernel/focus-manager';
import { createNativeHistory, createNextRouterHistory } from '@/lib/kernel/history/adapters';
import { OS_NAMES } from '@/lib/kernel/ids';
import { historyAdapterOverride } from '@/lib/kernel/persist/storage';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { routeCodec, routeTitle } from '@/lib/kernel/route';
import { startRouteSync } from '@/lib/kernel/route-sync';
import { chooserShown, targetOs } from '@/lib/kernel/state';
import { focusKeys } from '@/lib/kernel/types';
import { useKernel } from '@/stores/kernel-context';
import { dispatch, getKernel, subscribeEffects } from '@/stores/kernel-store';
import { attachKernel } from '@/stores/kernel-bridge';
import { getPrefs, prefsStore } from '@/stores/prefs-store';
import { OSHost } from './OSHost';
import { TransitionDriver } from './TransitionDriver';

const loadChooser = () => import('@/components/welcome/Chooser');
const Chooser = lazy(loadChooser);

export function ShellRuntime() {
  const router = useRouter();
  const routerRef = useRef(router);
  const boot = useKernel((state) => state.boot);
  const os = useKernel(targetOs);
  const chooser = useKernel(chooserShown);
  const welcome = useKernel((state) => state.route.kind === 'welcome');

  useEffect(() => {
    markShellInstance();
    void prefsStore.persist.rehydrate();
    dispatch(bootAction());
    // The welcome island on `/` queued its onboarding actions until now; they flush in order.
    const detachBridge = attachKernel({ dispatch, prefs: getPrefs });

    const port =
      historyAdapterOverride() === 'next-router' ? createNextRouterHistory(routerRef.current) : createNativeHistory();
    const pageviews = createPageviewTracker(() => analytics);
    const stops = [
      startRouteSync({
        port,
        getState: getKernel,
        dispatch,
        subscribe: (listener) =>
          subscribeEffects((effect) =>
            listener({ state: effect.state, previous: effect.previous, routeIntent: effect.routeIntent }),
          ),
        encode: routeCodec.encode,
        title: routeTitle,
        onRoute: (route) => pageviews.record(analyticsPath(route, OS_REGISTRY)),
      }),
      startFocusManager(subscribeEffects, () => {
        if (process.env.NODE_ENV !== 'production')
          console.warn('[focus] focus fell to <body> — a focus target was missing.');
      }),
      watchViewport(dispatch),
      subscribeEffects((effect) => {
        for (const event of effect.events) analytics.track(event);
      }),
      () => pageviews.dispose(),
      detachBridge,
    ];
    startAnalytics();
    return () => {
      for (const stop of stops) stop();
    };
  }, []);

  // On `/` the chooser follows the profiles: warm its chunk in idle time so the hand-off never waits on the network.
  useEffect(() => {
    if (!welcome) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const warm = () => void loadChooser().catch(() => undefined);
    if (w.requestIdleCallback) w.requestIdleCallback(warm);
    else setTimeout(warm, 800);
  }, [welcome]);

  // The semantic page underneath becomes inert (focus moved out first) while an OS or the chooser is on screen.
  const covering = boot === 'ready' && (os !== null || chooser);
  useEffect(() => {
    const page = document.getElementById('page-layer');
    const root = document.documentElement;
    if (!page) return;
    if (covering) {
      moveFocusOutOf(page, { candidates: chooser ? [focusKeys.chooserHeading] : [focusKeys.osHeading] });
      page.inert = true;
      page.setAttribute('aria-hidden', 'true');
      root.dataset.shell = 'os';
    } else {
      page.inert = false;
      page.removeAttribute('aria-hidden');
      delete root.dataset.shell;
      if (focusIsOnBody()) return;
    }
    // `chooser` only picks the focus candidate; covering is what toggles the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [covering]);

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" id="system-status" />
      <TransitionDriver />
      {chooser ? (
        <Suspense fallback={null}>
          <Chooser />
        </Suspense>
      ) : null}
      {boot === 'ready' && os !== null ? (
        <div className="os-root" data-os={os}>
          <h1 className="sr-only" tabIndex={-1} data-focus-key={focusKeys.osHeading}>
            {OS_NAMES[os]} — {contentIndex.get({ section: 'about' })?.title ?? 'Portfolio'}
          </h1>
          <OSHost os={os} />
        </div>
      ) : null}
    </>
  );
}
