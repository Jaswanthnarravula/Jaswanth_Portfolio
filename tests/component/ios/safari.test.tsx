/**
 * iOS Safari in jsdom through the iOS harness (plans/ios/apps/safari.md):
 * IOS-SAF-01 bottom address capsule + toolbar; collapse / expand by scroll direction with a 12 pt hysteresis, written
 * as transform / opacity only · IOS-SAF-02 the page is the shared `AboutOverview` from data · IOS-SAF-03 native scroll,
 * IntersectionObserver reveals (none under reduced motion), no Lenis / ScrollTrigger · IOS-SAF-04 share, bookmarks and
 * the tab overview · IOS-SAF-05 phone landscape top bar, pad toolbar + sidebar · IOS-SAF-06 toolbar semantics, focus
 * never under the bar, axe clean.
 */
import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hrefFor } from '@/components/shell/KernelLink';
import Safari, { SITE_HOST } from '@/components/os/ios/apps/Safari';
import { iosId } from '@/components/os/ios/model';
import { IosShellProvider } from '@/components/os/ios/shell-context';
import { SheetHostContext } from '@/components/os/ios/ui/Sheet';
import { getFeaturedProjects, getPerson } from '@/data/selectors';
import { publicEnv } from '@/lib/config/environment';
import { dispatch, getKernel } from '@/stores/kernel-store';
import { bootIos, closeAllIos, fakeServices, renderIosApp, settle } from './harness';

const person = getPerson();
const ID = iosId('browser');
const AXE = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };

/** A controllable IntersectionObserver (jsdom has none). */
class FakeObserver {
  static instances: FakeObserver[] = [];
  readonly targets = new Set<Element>();
  constructor(readonly callback: IntersectionObserverCallback) {
    FakeObserver.instances.push(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
  }
  takeRecords() {
    return [];
  }
  /** Everything observed scrolls into view. */
  showAll() {
    const entries = [...this.targets].map(
      (target) => ({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry,
    );
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

beforeEach(() => {
  closeAllIos();
  delete document.documentElement.dataset.motion;
  FakeObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.motion;
});

const page = () => document.querySelector<HTMLElement>('[data-page]')!;
const bar = () => document.querySelector<HTMLElement>('[data-bar]')!;
const root = () => page().closest<HTMLElement>('[data-bar-at]')!;

/** Give the page a scrollable geometry and a writable scrollTop. */
function scrollable(el: HTMLElement, height = 4000, viewport = 800) {
  let top = 0;
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => height });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => viewport });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = value;
    },
  });
  return (y: number) => {
    top = y;
    fireEvent.scroll(el);
  };
}

const LANDSCAPE_PROPS = {
  id: ID,
  role: 'browser',
  active: true,
  layout: 'phone',
  landscape: true,
  headingId: 'ios-app-browser',
} as const;

/** Render Safari in phone landscape (the harness renders portrait). */
function renderLandscape() {
  bootIos(844, 390);
  dispatch({ type: 'OPEN_APP', os: 'ios', role: 'browser' });
  dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: ID } });
  const { services } = fakeServices('phone');
  function Host() {
    const [layer, setLayer] = useState<HTMLDivElement | null>(null);
    return (
      <IosShellProvider value={{ ...services, landscape: true }}>
        <div data-os="ios">
          <section aria-labelledby="ios-app-browser">
            <h2 id="ios-app-browser">Safari</h2>
            <SheetHostContext.Provider value={{ layer, setOpen: () => undefined }}>
              <Safari {...LANDSCAPE_PROPS} />
            </SheetHostContext.Provider>
            <div ref={setLayer} />
          </section>
        </div>
      </IosShellProvider>
    );
  }
  return render(<Host />);
}

describe('iOS Safari', () => {
  it('IOS-SAF-01 bottom address capsule + toolbar; collapses on scroll down, expands on scroll up (transform only)', async () => {
    renderIosApp(Safari, 'browser');
    expect(root()).toHaveAttribute('data-bar-at', 'bottom');
    // The capsule: AA page menu · read-only labelled address (the site's own host) · Reload; a thin loading line.
    const address = screen.getByRole('textbox', { name: 'Address' });
    expect(address).toHaveAttribute('readonly');
    expect(address).toHaveAttribute('inputmode', 'none');
    expect(address).toHaveValue(new URL(publicEnv.siteUrl).host);
    expect(SITE_HOST).toBe(new URL(publicEnv.siteUrl).host);
    expect(screen.getByRole('button', { name: 'Page menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    const toolbar = screen.getByRole('toolbar', { name: 'Safari' });
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Back', 'Forward', 'Share', 'Bookmarks', 'Tabs']);
    // The toolbar sits under the capsule in the same bottom bar.
    expect(bar().contains(address)).toBe(true);
    expect(bar().contains(toolbar)).toBe(true);

    const mini = document.querySelector<HTMLButtonElement>(`button[aria-label="Show toolbar, ${SITE_HOST}"]`)!;
    expect(mini).not.toBeNull();
    expect(mini).toHaveAttribute('aria-hidden', 'true');
    expect(mini.tabIndex).toBe(-1);
    const scrollTo = scrollable(page());
    scrollTo(8); // under the hysteresis: nothing changes
    expect(bar().style.transform).toBe('');
    scrollTo(40); // down past 12 pt: collapses
    expect(bar().style.transform).toBe('translateY(100%)');
    expect(mini.style.opacity).toBe('1');
    expect(mini).toHaveAttribute('aria-hidden', 'false');
    expect(root()).toHaveAttribute('data-collapsed');
    scrollTo(900);
    scrollTo(892); // up 8 pt: still collapsed
    expect(bar().style.transform).toBe('translateY(100%)');
    scrollTo(870); // up past 12 pt: expands
    expect(bar().style.transform).toBe('');
    expect(mini.style.opacity).toBe('0');
    // Only transform / opacity are ever written.
    for (const el of [bar(), mini]) {
      const written = Array.from({ length: el.style.length }, (_, index) => el.style.item(index)).filter(
        (property) => property !== 'transform' && property !== 'opacity',
      );
      expect(written).toEqual([]);
    }
    // Tap the slim address to restore the bar.
    scrollTo(1400);
    expect(bar().style.transform).toBe('translateY(100%)');
    fireEvent.click(mini);
    expect(bar().style.transform).toBe('');
  });

  it('IOS-SAF-01 short content keeps the bar expanded', async () => {
    renderIosApp(Safari, 'browser');
    const scrollTo = scrollable(page(), 820, 800);
    scrollTo(20);
    expect(bar().style.transform).toBe('');
  });

  it('IOS-SAF-02 renders the shared AboutOverview from the data (mobile composition, h3-rooted)', () => {
    renderIosApp(Safari, 'browser');
    const article = page().querySelector('article.cv-about');
    expect(article).not.toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: person.name })).toBeInTheDocument();
    expect(page()).toHaveTextContent(person.headline);
    expect(page()).toHaveTextContent(person.openTo);
    for (const project of getFeaturedProjects()) {
      const link = screen.getByRole('link', { name: project.name });
      expect(link).toHaveAttribute('href', hrefFor({ os: 'ios', ref: { section: 'projects', slug: project.slug } }));
    }
    const source = readFileSync('components/os/ios/apps/Safari.tsx', 'utf8');
    expect(source).toMatch(/import \{[^}]*\bAboutOverview\b[^}]*\} from '@\/components\/content'/);
    expect(source).toMatch(/<AboutOverview\b/);
    expect(source).not.toMatch(/data\/portfolio/);
    expect(source).not.toContain(person.headline);
  });

  it('IOS-SAF-03 native scroll only (no Lenis / ScrollTrigger); IntersectionObserver reveals once; Reload re-runs them', () => {
    const source = readFileSync('components/os/ios/apps/Safari.tsx', 'utf8');
    const imports = source.match(/^import[^;]+;/gm) ?? [];
    expect(imports.length).toBeGreaterThan(5);
    for (const line of imports) {
      expect(line).not.toMatch(/lenis/i);
      expect(line).not.toMatch(/ScrollTrigger|gsap/);
    }
    renderIosApp(Safari, 'browser');
    const targets = [...page().querySelectorAll('[data-reveal]')];
    expect(targets.length).toBeGreaterThanOrEqual(3);
    expect(targets.every((target) => target.getAttribute('data-reveal') === 'pending')).toBe(true);
    const observer = FakeObserver.instances.at(-1)!;
    act(() => observer.showAll());
    expect(targets.every((target) => target.getAttribute('data-reveal') === 'shown')).toBe(true);
    expect(observer.targets.size).toBe(0); // added once, then unobserved
    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(targets.every((target) => target.getAttribute('data-reveal') === 'pending')).toBe(true);
  });

  it('IOS-SAF-03 reduced motion: no reveals (content shown at once, no observer)', () => {
    document.documentElement.dataset.motion = 'reduced';
    renderIosApp(Safari, 'browser');
    const targets = [...page().querySelectorAll('[data-reveal]')];
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((target) => target.getAttribute('data-reveal') === 'shown')).toBe(true);
    expect(FakeObserver.instances).toHaveLength(0);
  });

  it('IOS-SAF-04 share sheet (medium detent): Copy Link · Open Plain Version · Download Résumé', async () => {
    const view = renderIosApp(Safari, 'browser');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await settle();
    const sheet = screen.getByRole('dialog', { name: 'Share' });
    expect(sheet).toHaveAttribute('data-detent', 'medium');
    expect(within(sheet).getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(sheet).toHaveTextContent(SITE_HOST);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Copy Link' }));
    await settle();
    expect(view.calls.copyLink?.[0]).toEqual([{ section: 'about' }, 'Link']);

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await settle();
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Share' })).getByRole('button', { name: 'Download Résumé' }),
    );
    await settle();
    expect(view.calls.downloadResume).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await settle();
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Share' })).getByRole('button', { name: 'Open Plain Version' }),
    );
    await settle();
    expect(JSON.parse(getKernel().sessions.ios.windows[ID]!.ui!.hist!)).toEqual({ e: ['about', 'plain'], i: 1 });
    expect(screen.getByRole('heading', { level: 4, name: 'Projects' })).toBeInTheDocument();
    // Copy Link on the plain page copies its own URL; blocked → the link shown selectable in the sheet.
    view.unmount();
  });

  it('IOS-SAF-04 copy blocked → the link is offered as selectable text', async () => {
    const blocked = fakeServices('phone', { copyLink: async () => false });
    renderIosApp(Safari, 'browser', { services: blocked.services });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await settle();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Share' })).getByRole('button', { name: 'Copy Link' }));
    await settle();
    const field = document.querySelector<HTMLInputElement>('[data-manual-copy]');
    expect(field?.value).toBe(new URL('/go/about', publicEnv.siteUrl).href);
    expect(document.activeElement).toBe(field);
  });

  it('IOS-SAF-04 bookmarks sheet: GitHub · Résumé · Mail · Messages open the apps from the pressed row', async () => {
    const view = renderIosApp(Safari, 'browser');
    const open = async (name: string) => {
      fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
      await settle();
      const sheet = screen.getByRole('dialog', { name: 'Bookmarks' });
      const row = within(sheet).getByRole('link', { name });
      fireEvent.click(row);
      await settle();
      return row;
    };
    const github = await open('GitHub');
    expect(view.calls.openApp?.[0]).toEqual(['github', undefined, github]);
    const resume = await open('Résumé');
    expect(view.calls.openContent?.[0]).toEqual([{ section: 'resume' }, resume]);
    const mail = await open('Mail');
    expect(view.calls.openContent?.[1]).toEqual([{ section: 'contact' }, mail]);
    const messages = await open('Messages');
    expect(view.calls.openApp?.[1]).toEqual(['messages', undefined, messages]);
    expect(github).toHaveAttribute('href', '/ios/github');
    expect(resume).toHaveAttribute('href', hrefFor({ os: 'ios', ref: { section: 'resume' } }));
  });

  it('IOS-SAF-04 tab overview: 2 cards switch tabs; Back / Forward walk the tab history', async () => {
    renderIosApp(Safari, 'browser');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tabs' }));
    await settle();
    const overview = screen.getByRole('dialog', { name: 'Tabs' });
    const cards = within(overview)
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-tab-card'));
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('About'),
      expect.stringContaining('Plain version'),
    ]);
    expect(cards[0]).toHaveAttribute('aria-current', 'page');
    expect(document.activeElement).toBe(cards[0]);
    fireEvent.click(cards[1]!);
    await settle();
    expect(screen.queryByRole('dialog', { name: 'Tabs' })).toBeNull();
    expect(screen.getByRole('heading', { level: 4, name: 'Experience' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await settle();
    expect(screen.getByRole('heading', { level: 3, name: person.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forward' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    await settle();
    expect(screen.getByRole('heading', { level: 4, name: 'Experience' })).toBeInTheDocument();
    // Esc = Done.
    fireEvent.click(screen.getByRole('button', { name: 'Tabs' }));
    await settle();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Tabs' }), { key: 'Escape' });
    await settle();
    expect(screen.queryByRole('dialog', { name: 'Tabs' })).toBeNull();
  });

  it('IOS-SAF-05 phone landscape: the bar moves to the top (compact toolbar)', () => {
    renderLandscape();
    expect(root()).toHaveAttribute('data-bar-at', 'top');
    expect(screen.getByRole('toolbar', { name: 'Navigation' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Page' })).toBeInTheDocument();
    const scrollTo = scrollable(page());
    scrollTo(60);
    expect(bar().style.transform).toBe('translateY(-100%)');
    scrollTo(20);
    expect(bar().style.transform).toBe('');
  });

  it('IOS-SAF-05 pad: top toolbar with a centred address and a sidebar button (bookmarks + tabs as a sidebar)', async () => {
    const view = renderIosApp(Safari, 'browser', { layout: 'pad' });
    expect(root()).toHaveAttribute('data-bar-at', 'pad');
    const sidebarButton = screen.getByRole('button', { name: 'Sidebar' });
    expect(sidebarButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Bookmarks' })).toBeNull();
    fireEvent.click(sidebarButton);
    await settle();
    const sidebar = screen.getByRole('navigation', { name: 'Sidebar' });
    fireEvent.click(within(sidebar).getByRole('link', { name: 'GitHub' }));
    expect(view.calls.openApp?.[0]?.[0]).toBe('github');
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Plain version' }));
    await settle();
    expect(screen.getByRole('heading', { level: 4, name: 'Skills' })).toBeInTheDocument();
    // Pad never collapses the bar.
    const scrollTo = scrollable(page());
    scrollTo(300);
    expect(bar().style.transform).toBe('');
    const results = await axe.run(view.container, AXE);
    expect(
      results.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`,
      ),
    ).toEqual([]);
  });

  it('IOS-SAF-06 toolbar semantics: named buttons, arrow keys move focus; focus inside the bar brings it back', () => {
    renderIosApp(Safari, 'browser');
    const toolbar = screen.getByRole('toolbar', { name: 'Safari' });
    const share = within(toolbar).getByRole('button', { name: 'Share' });
    share.focus();
    fireEvent.keyDown(share, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(within(toolbar).getByRole('button', { name: 'Bookmarks' }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(within(toolbar).getByRole('button', { name: 'Tabs' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(share); // wraps, skipping the disabled Back / Forward
    // Collapsed bar + keyboard focus into it → it expands (focus is never hidden).
    const scrollTo = scrollable(page());
    scrollTo(200);
    expect(bar().style.transform).toBe('translateY(100%)');
    fireEvent.focus(share);
    expect(bar().style.transform).toBe('');
    // The page keeps focused content clear of the bar (scroll-padding in the stylesheet).
    const css = readFileSync('components/os/ios/apps/safari.module.css', 'utf8');
    expect(css).toMatch(/scroll-padding-bottom:\s*calc\(var\(--saf-bottom\)/);
    expect(css).toMatch(/--saf-bottom:\s*calc\([^;]*var\(--sa-b/);
  });

  it('IOS-SAF-06 axe clean: page, share sheet, tab overview', async () => {
    const view = renderIosApp(Safari, 'browser');
    let results = await axe.run(view.container, AXE);
    expect(
      results.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`,
      ),
    ).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await settle();
    results = await axe.run(view.container, AXE);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Share' })).getByRole('button', { name: 'Done' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Tabs' }));
    await settle();
    results = await axe.run(view.container, AXE);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
