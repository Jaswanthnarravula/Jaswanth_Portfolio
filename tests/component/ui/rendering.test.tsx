/**
 * DS-ICONBOX-01 / ASSET-BOX-01 (component level): identical boxes across asset modes; original art renders for every
 * source kind. ContentFor + SemanticFallback render every section; OSHost + TransitionDriver drive the switch machine.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContentFor, LegalNotice, PrivacyNotice } from '@/components/content';
import { OSHost } from '@/components/shell/OSHost';
import { SemanticFallback } from '@/components/shell/SemanticFallback';
import { TransitionDriver } from '@/components/shell/TransitionDriver';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { contentIndex } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import { ASSET_MANIFEST } from '@/lib/assets/manifest';
import { routeCodec } from '@/lib/kernel/route';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { dispatch, getKernel } from '@/stores/kernel-store';

describe('AssetIcon', () => {
  const ids = ASSET_MANIFEST.filter(
    (entry) => entry.kind !== 'audio' && entry.kind !== 'wallpaper' && entry.kind !== 'device-frame',
  ).map((entry) => entry.id);

  it.each(ids)('%s has the same box in both modes', (id) => {
    const { container, unmount } = render(
      <>
        <AssetIcon id={id} size={48} mode="official" />
        <AssetIcon id={id} size={48} mode="original" />
      </>,
    );
    const [official, original] = [...container.children] as HTMLElement[];
    expect(official!.style.width).toBe(original!.style.width);
    expect(official!.style.height).toBe(original!.style.height);
    expect(original!.getAttribute('data-asset-mode')).toBe('original');
    unmount();
  });

  it('official raster icons are decorative, sized and responsive', () => {
    const { container } = render(<AssetIcon id="app.macos.finder" size={48} mode="official" priority />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('width', '48');
    expect(img.getAttribute('srcset')).toMatch(/64w, .* 128w/);
    expect(img).toHaveAttribute('loading', 'eager');
  });

  it('monochrome marks render as a colour-following mask', () => {
    const { container } = render(<AssetIcon id="app.windows.github" size={24} mode="official" />);
    expect((container.firstChild as HTMLElement).style.backgroundColor).toBe('currentcolor');
  });

  it('original art: tiles for every shape, free-form glyphs, faces and the site monogram', () => {
    for (const id of [
      'app.macos.safari',
      'app.android.chrome',
      'app.windows.edge',
      'app.linux.terminal',
      'avatar.guest',
      'system.apple-logo',
    ]) {
      const { container, unmount } = render(<AssetIcon id={id} size={40} mode="original" />);
      expect(container.querySelector('svg')).not.toBeNull();
      expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
      unmount();
    }
    expect(render(<AssetIcon id="audio.intro" size={10} mode="official" />).container.innerHTML).toBe('');
  });
});

describe('ContentFor renders every section', () => {
  it.each(contentIndex.entries.map((entry) => [entry.key, entry.ref] as const))('%s', (_key, ref) => {
    const { container } = render(<ContentFor target={ref as ContentRef} headingLevel={2} />);
    expect(container.textContent?.length).toBeGreaterThan(10);
  });
  it('legal and privacy notices', () => {
    render(
      <>
        <LegalNotice
          data={{
            credits: [
              {
                label: 'Finder',
                owner: 'Apple Inc.',
                sourceUrl: 'https://example.com',
                retrieved: '2026-09-21',
                terms: 't',
                derived: true,
              },
            ],
            contactEmail: 'a@b.c',
            glyphCredit: 'Lucide',
            assetMode: 'official',
          }}
        />
        <PrivacyNotice data={{ counted: ['Page views'] }} />
      </>,
    );
    expect(screen.getByText(/colour variant pending/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Privacy' })).toBeInTheDocument();
  });
});

describe('SemanticFallback', () => {
  const route = (path: string) => {
    const decoded = routeCodec.decode(path);
    if (!decoded.ok || (decoded.route.kind !== 'go' && decoded.route.kind !== 'os')) throw new Error(path);
    return decoded.route;
  };
  it('a /go detail page has one h1 (the view title), a breadcrumb, and a résumé link to the PDF', () => {
    render(<SemanticFallback route={route('/go/projects/enterprise-sso')} />);
    expect(screen.getAllByRole('heading', { level: 1 }).map((heading) => heading.textContent)).toEqual([
      'Enterprise SSO Identity Provider',
    ]);
    expect(screen.getByRole('link', { name: '← Projects' })).toHaveAttribute('href', '/go/projects');
    const resumeLinks = screen.getAllByRole('link', { name: 'Résumé (PDF)' });
    expect(resumeLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of resumeLinks) expect(link).toHaveAttribute('href', '/resume/jaswanth-narravula-resume.pdf');
  });
  it('an OS page links within that OS and names it', () => {
    render(<SemanticFallback route={route('/macos/github')} />);
    expect(screen.getAllByRole('heading', { level: 1 }).map((heading) => heading.textContent)).toEqual(['Projects']);
    expect(screen.getByText(/GitHub in macOS/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enterprise SSO Identity Provider' })).toHaveAttribute(
      'href',
      '/macos/github/enterprise-sso',
    );
  });
  it('an app without content (Settings) still renders a titled page', () => {
    render(<SemanticFallback route={route('/macos/settings')} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('System Settings');
  });
});

describe('OSHost + TransitionDriver', () => {
  it('drives exiting → loading → entering → idle and mounts the OS chunk', async () => {
    dispatch({
      type: 'BOOT',
      url: '/',
      navType: 'navigate',
      viewport: { w: 1280, h: 800, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    render(<TransitionDriver />);
    act(() => {
      dispatch({ type: 'SWITCH_OS', to: 'windows', via: 'chooser' });
    });
    await waitFor(() => expect(getKernel().transition.phase).toBe('idle'), { timeout: 5000 });
    expect(getKernel().activeOs).toBe('windows');
    render(<OSHost os="windows" />);
    expect(await screen.findByText('Windows 11 · preview')).toBeInTheDocument();
  });
});
