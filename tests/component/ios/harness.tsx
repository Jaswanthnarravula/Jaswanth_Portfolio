/**
 * iOS component-test harness: boots the kernel on `/ios`, opens an app window and renders the app body the way its
 * surface does — inside the iOS shell services (recorded, so tests can assert what the app asked for) and a sheet
 * layer. Presses commit after paint (`dispatchSoon`), so tests call `settle()` after an interaction.
 */
import { act, render, type RenderResult } from '@testing-library/react';
import { useState, type ComponentType } from 'react';
import { vi } from 'vitest';
import type { IosAppProps } from '@/components/os/ios/apps/registry';
import { iosId, type IosLayout, type IosRole } from '@/components/os/ios/model';
import { IosShellProvider, type IosServices } from '@/components/os/ios/shell-context';
import { SheetHostContext } from '@/components/os/ios/ui/Sheet';
import type { AppLocation } from '@/lib/kernel/types';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';

let booted = false;

/** Boot once per test file; later calls only resize. */
export function bootIos(w = 390, h = 844, pointer: 'fine' | 'coarse' = 'coarse') {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/ios',
      navType: 'navigate',
      viewport: { w, h, pointer },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    booted = true;
  } else dispatch({ type: 'VIEWPORT_CHANGED', w, h, pointer });
}

/** Close every iOS app (a clean slate between tests). */
export function closeAllIos() {
  for (const id of Object.keys(getKernel().sessions.ios.windows)) {
    dispatch({ type: 'CLOSE_WINDOW', id: id as never });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: id as never } });
  }
}

/** Let queued presses commit and React render them. */
export async function settle() {
  await act(async () => {
    flushQueued();
    await Promise.resolve();
  });
  await act(async () => {
    flushQueued();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export type ServiceCalls = { [K in keyof IosServices]?: unknown[][] };

export function fakeServices(layout: IosLayout = 'phone', overrides: Partial<IosServices> = {}) {
  const calls: ServiceCalls = {};
  const record =
    <K extends keyof IosServices>(key: K, result?: unknown) =>
    (...args: unknown[]) => {
      ((calls[key] ??= []) as unknown[][]).push(args);
      return result;
    };
  const services: IosServices = {
    layout,
    landscape: false,
    notify: record('notify') as IosServices['notify'],
    copy: vi.fn(async (...args: unknown[]) => {
      (calls.copy ??= []).push(args);
      return true;
    }) as IosServices['copy'],
    copyLink: vi.fn(async (...args: unknown[]) => {
      (calls.copyLink ??= []).push(args);
      return true;
    }) as IosServices['copyLink'],
    openApp: (role, location, origin) => {
      (calls.openApp ??= []).push([role, location, origin]);
      dispatch({ type: 'OPEN_APP', os: 'ios', role, location });
    },
    openContent: (ref, origin) => {
      (calls.openContent ??= []).push([ref, origin]);
    },
    goHome: record('goHome') as IosServices['goHome'],
    preview: record('preview') as IosServices['preview'],
    quickActions: record('quickActions') as IosServices['quickActions'],
    openSwitchOs: record('openSwitchOs') as IosServices['openSwitchOs'],
    switchOs: record('switchOs') as IosServices['switchOs'],
    startTour: record('startTour') as IosServices['startTour'],
    openSpotlight: record('openSpotlight') as IosServices['openSpotlight'],
    downloadResume: record('downloadResume') as IosServices['downloadResume'],
    onScrollToTop: record('onScrollToTop') as IosServices['onScrollToTop'],
    announce: record('announce') as IosServices['announce'],
    ...overrides,
  };
  return { services, calls };
}

function Host({
  App,
  role,
  layout,
  services,
}: {
  App: ComponentType<IosAppProps>;
  role: IosRole;
  layout: IosLayout;
  services: IosServices;
}) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  return (
    <IosShellProvider value={services}>
      <div data-os="ios" data-ios-layout={layout}>
        <section aria-labelledby={`ios-app-${role}`} data-app-surface={role}>
          <h2 id={`ios-app-${role}`}>{role}</h2>
          <SheetHostContext.Provider value={{ layer, setOpen: () => undefined }}>
            <App id={iosId(role)} role={role} active layout={layout} landscape={false} headingId={`ios-app-${role}`} />
          </SheetHostContext.Provider>
          <div ref={setLayer} data-sheet-layer="" />
        </section>
      </div>
    </IosShellProvider>
  );
}

/** Open `role` at `location` in the kernel and render its body. */
export function renderIosApp(
  App: ComponentType<IosAppProps>,
  role: IosRole,
  options: { location?: AppLocation; layout?: IosLayout; services?: IosServices } = {},
): RenderResult & { calls: ServiceCalls; services: IosServices } {
  const layout = options.layout ?? 'phone';
  if (layout === 'pad') bootIos(1440, 900, 'fine');
  else bootIos();
  dispatch({ type: 'OPEN_APP', os: 'ios', role, location: options.location });
  dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: iosId(role) } });
  const fake = options.services ? { services: options.services, calls: {} } : fakeServices(layout);
  const result = render(<Host App={App} role={role} layout={layout} services={fake.services} />);
  return Object.assign(result, { calls: fake.calls, services: fake.services });
}
