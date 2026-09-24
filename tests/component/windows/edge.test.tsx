/**
 * Microsoft Edge in jsdom, through the real Windows window frame (plans/windows/apps/edge.md):
 * WIN-EDGE-01 chrome (tabs in the title bar, "+" opens the Plain version tab, the read-only labelled address field,
 * the sidebar strip opens apps; medium hides it) · WIN-EDGE-02 the Overview is the shared `AboutOverview` ·
 * WIN-EDGE-03 routed tabs (about ↔ résumé, toolbar Back, arrow keys, deep link) · WIN-EDGE-04 the PDF viewer (Save is a
 * real download with the toast + event, text version first in DOM, no-PDF phase) · WIN-EDGE-06 compact.
 */
import { readFileSync } from 'node:fs';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { goHref, resumeFileLabel } from '@/components/content';
import Edge from '@/components/os/windows/apps/Edge';
import { WinShellProvider, type WinShellServices } from '@/components/os/windows/shell-context';
import { WinWindow } from '@/components/os/windows/window/Window';
import { getFeaturedProjects, getPerson, getResume, getResumeFileMeta } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { publicEnv } from '@/lib/config/environment';
import { currentLocation, DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import type { AppLocation, WindowId } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';

/** The placeholder phase (no PDF built yet) is simulated by hiding the file meta. */
const pdf = vi.hoisted(() => ({ missing: false }));

/** The Overview's scroll-effects port: jsdom always declines the gate; WIN-EDGE-05 drives it explicitly. */
const scroll = vi.hoisted(() => ({
  allowed: false,
  attach: vi.fn(
    async (_scroller: Element, ..._rest: unknown[]) =>
      () =>
        undefined,
  ),
  refresh: vi.fn(async () => undefined),
}));
vi.mock('@/lib/motion/overview-scroll', () => ({
  overviewScrollAllowed: () => scroll.allowed,
  attachOverviewScroll: scroll.attach,
  refreshOverviewScroll: scroll.refresh,
}));
vi.mock('@/data/selectors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/selectors')>();
  return { ...actual, getResumeFileMeta: () => (pdf.missing ? null : actual.getResumeFileMeta()) };
});

const ID = 'windows:browser' as WindowId;
const RESUME: AppLocation = { kind: 'content', ref: { section: 'resume' } };

let booted = false;
function boot(w = 1440, h = 900) {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/windows',
      navType: 'navigate',
      viewport: { w, h, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    booted = true;
  } else dispatch({ type: 'VIEWPORT_CHANGED', w, h, pointer: 'fine' });
}

function closeAll() {
  for (const id of Object.keys(getKernel().sessions.windows.windows) as WindowId[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}

function openEdge(location?: AppLocation) {
  act(() => {
    dispatch({ type: 'OPEN_APP', os: 'windows', role: 'browser', location });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: ID } });
  });
}

const edgeWindow = () => getKernel().sessions.windows.windows[ID]!;

/** The shell's services: the given spies, a no-op for everything else. */
function shellWith(overrides: Partial<WinShellServices> = {}): WinShellServices {
  const base: Record<string, unknown> = {
    peek: null,
    pendingTerminalInsert: () => null,
    snapPreview: { show: () => undefined, hide: () => undefined },
    ...overrides,
  };
  return new Proxy(base, {
    get: (target, key) =>
      typeof key === 'symbol' || key === 'then' ? undefined : key in target ? target[key] : () => undefined,
  }) as unknown as WinShellServices;
}

function renderEdge({ compact = false, shell = shellWith() }: { compact?: boolean; shell?: WinShellServices } = {}) {
  return render(
    <WinShellProvider value={shell}>
      <WinWindow
        id={ID}
        zIndex={100}
        focused
        compact={compact}
        touch={false}
        shownInCompact
        dimmed={false}
        body={(props) => <Edge {...props} />}
      />
    </WinShellProvider>,
  );
}

const flush = () =>
  act(() => {
    flushQueued();
  });

beforeEach(() => {
  pdf.missing = false;
  scroll.allowed = false;
  scroll.attach.mockClear();
  scroll.refresh.mockClear();
  boot();
  act(() => closeAll());
});

describe('WIN-EDGE-01 browser chrome: tabs in the title bar, address field, sidebar strip', () => {
  it('puts the tabs in the title bar, keeps the address read-only and labelled, and the strip opens apps', async () => {
    const user = userEvent.setup();
    openEdge();
    const { container } = renderEdge();
    const window = screen.getByRole('region', { name: /^Microsoft Edge/ });
    const titleBar = window.querySelector<HTMLElement>('header[data-drag-region]')!;
    const tablist = within(titleBar).getByRole('tablist', { name: 'Tabs' });
    expect(within(tablist).getAllByRole('tab')).toHaveLength(2);
    expect(within(tablist).getByRole('tab', { name: `About ${getPerson().givenName}` })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(tablist).getByRole('tab', { name: 'Résumé.pdf' })).toHaveAttribute('aria-selected', 'false');

    const address = screen.getByRole('textbox', { name: 'Address' });
    expect(address).toHaveAttribute('readonly');
    expect(address).toHaveValue(new URL(goHref({ section: 'about' }), publicEnv.siteUrl).href);
    await user.click(address);
    expect(screen.getByRole('button', { name: /Copy link/ })).toBeInTheDocument();

    // "+" opens the preset Plain version tab (session state, not a route), then disables.
    await user.click(within(titleBar).getByRole('button', { name: /^New tab/ }));
    expect(within(tablist).getByRole('tab', { name: 'Plain version' })).toHaveAttribute('aria-selected', 'true');
    expect(within(titleBar).getByRole('button', { name: /^New tab/ })).toBeDisabled();
    expect(document.activeElement).toBe(within(tablist).getByRole('tab', { name: 'Plain version' }));
    expect(currentLocation(edgeWindow())).toEqual({ kind: 'root' });
    expect(address).toHaveValue(new URL('/plain', publicEnv.siteUrl).href);

    const strip = screen.getByRole('toolbar', { name: 'Sidebar' });
    expect(strip).toHaveAttribute('aria-orientation', 'vertical');
    expect(
      within(strip)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['GitHub', 'Outlook', 'Search']);
    await user.click(within(strip).getByRole('button', { name: 'GitHub' }));
    flush();
    expect(getKernel().sessions.windows.windows['windows:github' as WindowId]).toBeDefined();

    const results = await axe.run(container, {
      runOnly: {
        type: 'rule',
        values: [
          'aria-required-children',
          'aria-required-parent',
          'aria-allowed-attr',
          'aria-valid-attr-value',
          'button-name',
          'duplicate-id-aria',
        ],
      },
    });
    expect(results.violations).toEqual([]);
  });

  it('opens Search from the strip and hides the strip on medium', async () => {
    const user = userEvent.setup();
    const openSearch = vi.fn();
    openEdge();
    const view = renderEdge({ shell: shellWith({ openSearch }) });
    await user.click(within(screen.getByRole('toolbar', { name: 'Sidebar' })).getByRole('button', { name: 'Search' }));
    expect(openSearch).toHaveBeenCalledTimes(1);
    view.unmount();

    boot(1000, 800);
    renderEdge();
    expect(screen.queryByRole('toolbar', { name: 'Sidebar' })).toBeNull();
  });
});

describe('WIN-EDGE-02 the Overview tab is the shared Overview component', () => {
  it('imports AboutOverview from the shared content views (as macOS Safari does) and renders it from the data', () => {
    const shared = /import\s*\{[^}]*\bAboutOverview\b[^}]*\}\s*from\s*'@\/components\/content'/;
    expect(readFileSync('components/os/windows/apps/Edge.tsx', 'utf8')).toMatch(shared);
    expect(readFileSync('components/os/macos/apps/Safari.tsx', 'utf8')).toMatch(shared);

    openEdge();
    renderEdge();
    const panel = screen.getByRole('tabpanel', { name: `About ${getPerson().givenName}` });
    expect(within(panel).getByRole('heading', { level: 3, name: getPerson().name })).toBeInTheDocument();
    expect(within(panel).getByText(getPerson().headline)).toBeInTheDocument();
    for (const project of getFeaturedProjects())
      expect(within(panel).getByRole('link', { name: new RegExp(project.name) })).toHaveAttribute(
        'href',
        expect.stringContaining(project.slug),
      );
  });
});

describe('WIN-EDGE-03 routed tabs: about ↔ résumé', () => {
  it('selecting Résumé.pdf moves the window to the résumé location; Back and the About tab bring it back', async () => {
    const user = userEvent.setup();
    openEdge();
    renderEdge();
    await user.click(screen.getByRole('tab', { name: 'Résumé.pdf' }));
    flush();
    expect(currentLocation(edgeWindow())).toEqual(RESUME);
    expect(screen.getByRole('tab', { name: 'Résumé.pdf' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue(
      `file:///C:/Users/${getPerson().givenName}/Résumé.pdf`,
    );

    await user.click(screen.getByRole('button', { name: 'Back' }));
    flush();
    expect(currentLocation(edgeWindow())).toEqual({ kind: 'root' });
    const about = screen.getByRole('tab', { name: `About ${getPerson().givenName}` });
    expect(about).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute('aria-disabled', 'true');

    // APG tablist: arrow keys move and select (automatic activation); focus follows.
    about.focus();
    await user.keyboard('{ArrowRight}');
    flush();
    expect(currentLocation(edgeWindow())).toEqual(RESUME);
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Résumé.pdf' }));
    await user.keyboard('{Home}');
    flush();
    expect(currentLocation(edgeWindow())).toEqual({ kind: 'root' });
  });

  it('a deep link to /windows/edge/resume opens on the PDF tab', () => {
    openEdge(RESUME);
    renderEdge();
    expect(screen.getByRole('tab', { name: 'Résumé.pdf' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('toolbar', { name: 'PDF tools' })).toBeInTheDocument();
  });
});

describe('WIN-EDGE-04 the PDF viewer: page, zoom, Save, Print; text version first', () => {
  it('Save is a real download named downloadName (+ event and toast); the text version precedes the PDF', async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    const announce = vi.fn();
    const track = vi.spyOn(analytics, 'track');
    openEdge(RESUME);
    renderEdge({ shell: shellWith({ notify, announce }) });
    const file = getResumeFileMeta()!;
    const toolbar = screen.getByRole('toolbar', { name: 'PDF tools' });

    const save = within(toolbar).getByRole('link', { name: /^Save/ });
    expect(save).toHaveAttribute('download', getResume().downloadName);
    expect(save).toHaveAttribute('href', getResume().file);
    expect(save).toHaveAttribute('type', 'application/pdf');
    expect(save).toHaveAttribute('data-resume-download');
    save.addEventListener('click', (event) => event.preventDefault()); // jsdom cannot download
    await user.click(save);
    expect(track).toHaveBeenCalledWith({ name: 'resume_downloaded', os: 'windows' });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'download-resume', title: 'Résumé.pdf', body: 'Download complete' }),
    );

    expect(within(toolbar).getByText(`Page 1 of ${file.pages}`)).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Rotate' })).toBeDisabled();
    expect(within(toolbar).getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Fit to width' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(toolbar).getByRole('button', { name: 'Zoom in' }));
    expect(within(toolbar).getByRole('button', { name: 'Fit to width' })).toHaveAttribute('aria-pressed', 'false');
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Zoom \d+%$/));

    // The text version (the PDF's own text) comes first; then the published PDF's pages as images.
    const text = screen.getByRole('region', { name: 'Résumé — text version' });
    const pages = document.querySelectorAll<HTMLImageElement>('[data-resume-pages] img');
    expect(pages).toHaveLength(file.pages);
    expect(pages[0]!.getAttribute('srcset')).toContain('/resume/pages/');
    expect(document.querySelector('object')).toBeNull();
    expect(text.compareDocumentPosition(pages[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      within(text).getByRole('heading', { level: 3, name: new RegExp(`^${getPerson().name}$`, 'i') }),
    ).toBeInTheDocument();
  });

  it('with no PDF yet (placeholder phase) shows the text version only and hides Save', () => {
    pdf.missing = true;
    openEdge(RESUME);
    renderEdge();
    const toolbar = screen.getByRole('toolbar', { name: 'PDF tools' });
    expect(within(toolbar).queryByRole('link', { name: /^Save/ })).toBeNull();
    expect(within(toolbar).queryByText(/^Page 1 of/)).toBeNull();
    expect(document.querySelector('[data-resume-pages]')).toBeNull();
    const text = screen.getByRole('region', { name: 'Résumé — text version' });
    expect(
      within(text).getByRole('heading', { level: 3, name: new RegExp(`^${getPerson().name}$`, 'i') }),
    ).toBeInTheDocument();
  });
});

describe('WIN-EDGE-05 Lenis / ScrollTrigger gating and cleanup', () => {
  /** A ResizeObserver that reports once on observe (as browsers do); the refresh is debounced 150 ms. */
  function observeOnce() {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: () => void) {}
        observe() {
          this.callback();
        }
        disconnect() {}
      },
    );
  }

  it('declined gate (reduced motion, touch, tier 0): nothing attaches and a resize never loads ScrollTrigger', async () => {
    vi.useFakeTimers();
    try {
      observeOnce();
      openEdge();
      renderEdge();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(scroll.attach).not.toHaveBeenCalled();
      expect(scroll.refresh).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('open gate: the About scroller attaches, a resize re-measures, and the effects are disposed on tab change', async () => {
    const dispose = vi.fn();
    scroll.allowed = true;
    scroll.attach.mockImplementation(async () => dispose);
    vi.useFakeTimers();
    try {
      observeOnce();
      openEdge();
      renderEdge();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(scroll.attach).toHaveBeenCalledTimes(1);
      expect(scroll.attach.mock.calls[0]![0]).toBe(screen.getByRole('tabpanel').firstElementChild);
      expect(scroll.refresh).toHaveBeenCalledTimes(1);
      act(() => {
        dispatch({ type: 'NAVIGATE_IN_APP', id: ID, location: RESUME });
      });
      expect(dispose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});

describe('WIN-EDGE-06 compact layout', () => {
  it('tabs become a row under a compact title, the PDF toolbar is Save · ⋯ and there is no sidebar strip', async () => {
    const user = userEvent.setup();
    const openMenu = vi.fn();
    boot(390, 844);
    openEdge(RESUME);
    renderEdge({ compact: true, shell: shellWith({ openMenu }) });
    const window = screen.getByRole('region', { name: /^Microsoft Edge/ });
    const titleBar = window.querySelector<HTMLElement>('header[data-drag-region]')!;
    expect(within(titleBar).queryByRole('tablist')).toBeNull();
    expect(within(titleBar).getByRole('heading', { level: 2 })).toHaveTextContent('Microsoft Edge — Résumé.pdf');
    const tablist = screen.getByRole('tablist', { name: 'Tabs' });
    expect(titleBar.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const toolbar = screen.getByRole('toolbar', { name: 'PDF tools' });
    const controls = [...toolbar.querySelectorAll('a, button')].map((el) => el.getAttribute('aria-label'));
    expect(controls).toEqual([`Save (${resumeFileLabel(getResumeFileMeta())})`, 'More PDF tools']);
    await user.click(within(toolbar).getByRole('button', { name: 'More PDF tools' }));
    expect(openMenu).toHaveBeenCalledTimes(1);
    const spec = openMenu.mock.calls[0]![0] as { items: { kind: string; label?: string }[] };
    expect(spec.items.filter((item) => item.kind === 'item').map((item) => item.label)).toEqual([
      'Zoom in',
      'Zoom out',
      'Fit to width',
      'Print',
    ]);
    expect(screen.queryByRole('toolbar', { name: 'Sidebar' })).toBeNull();
  });
});
