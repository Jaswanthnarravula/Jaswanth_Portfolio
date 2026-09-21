import { describe, expect, it } from 'vitest';
import { OS_IDS } from '@/lib/kernel/ids';
import { OS_REGISTRY, visibleOses } from '@/lib/kernel/registry';
import { createRouteCodec, routeOf } from '@/lib/kernel/route/codec';
import {
  canonicalPaths,
  enumerateGoRoutes,
  enumerateOsRoutes,
  goStaticParams,
  osStaticParams,
} from '@/lib/kernel/route/static-params';
import { titleFor } from '@/lib/kernel/route/title';
import type { OsRegistry } from '@/lib/kernel/types';
import { fixtureCatalog, fixtureCodec } from '../../fixtures/portfolio';

const deps = { registry: OS_REGISTRY, catalog: fixtureCatalog, visible: OS_IDS };
const osPaths = canonicalPaths(enumerateOsRoutes(deps), fixtureCodec);
const goPaths = canonicalPaths(enumerateGoRoutes(fixtureCatalog), fixtureCodec);

describe('ROUTE-CODEC-01 encode/decode + canonical forms', () => {
  it.each([...osPaths, ...goPaths, '/', '/plain'])('format∘parse is identity for %s', (path) => {
    const decoded = fixtureCodec.decode(path);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.canonical).toBe(path);
    expect(fixtureCodec.encode(decoded.route)).toBe(path);
  });

  it('covers every registry app and every slug', () => {
    for (const os of OS_IDS)
      for (const binding of OS_REGISTRY[os].apps)
        expect(
          osPaths.some((path) => path === `/${os}/${binding.slug}` || path.startsWith(`/${os}/${binding.slug}/`)) ||
            (os === 'linux' && binding.role === 'terminal'),
        ).toBe(true);
    for (const slug of fixtureCatalog.slugs('projects')) expect(osPaths).toContain(`/macos/github/${slug}`);
    for (const slug of fixtureCatalog.slugs('experience'))
      expect(osPaths).toContain(`/windows/explorer/experience/${slug}`);
    expect(osPaths).toContain('/linux/viewer/resume');
    expect(osPaths).toContain('/linux/terminal/projects');
    expect(osPaths).toContain('/linux');
  });

  it('matches the documented examples', () => {
    const route = (path: string) => routeOf(fixtureCodec.decode(path));
    expect(route('/macos/finder/experience/acme')).toEqual({
      kind: 'os',
      os: 'macos',
      focus: { role: 'files', location: { kind: 'content', ref: { section: 'experience', slug: 'acme' } } },
    });
    expect(route('/macos/preview')).toEqual({
      kind: 'os',
      os: 'macos',
      focus: { role: 'viewer', location: { kind: 'content', ref: { section: 'resume' } } },
    });
    expect(route('/windows/edge/resume')).toMatchObject({
      focus: { role: 'browser', location: { kind: 'content', ref: { section: 'resume' } } },
    });
    expect(route('/ios/github/portfolio-os')).toMatchObject({
      focus: { role: 'github', location: { kind: 'content', ref: { section: 'projects', slug: 'portfolio-os' } } },
    });
    expect(route('/android/files/experience/acme')).toMatchObject({ os: 'android', focus: { role: 'files' } });
    expect(route('/linux/terminal/projects')).toMatchObject({
      focus: { role: 'terminal', location: { kind: 'vfs', path: ['projects'] } },
    });
    expect(route('/linux/viewer/projects/portfolio-os')).toMatchObject({
      focus: { role: 'viewer', location: { kind: 'vfs', path: ['projects', 'portfolio-os'] } },
    });
    expect(route('/linux')).toMatchObject({ focus: { role: 'terminal', location: { kind: 'vfs', path: [] } } });
  });

  it('accepts the long form of single-section apps and canonicalizes it', () => {
    const decoded = fixtureCodec.decode('/ios/github/projects/portfolio-os');
    expect(decoded).toMatchObject({ ok: true, canonical: '/ios/github/portfolio-os' });
    expect(fixtureCodec.decode('/macos/preview/resume')).toMatchObject({ ok: true, canonical: '/macos/preview' });
  });

  it('no slug collides with a section id (the long form stays unambiguous)', () => {
    for (const section of ['projects', 'experience', 'education'] as const)
      for (const slug of fixtureCatalog.slugs(section))
        expect(['about', 'projects', 'experience', 'skills', 'education', 'resume', 'contact']).not.toContain(slug);
  });
});

describe('ROUTE-CODEC-02 invalid input → nearest valid', () => {
  it.each([
    ['/macos/nope', 'unknown-app', '/macos'],
    ['/macos/finder/experience/nope', 'unknown-slug', '/macos/finder/experience'],
    ['/macos/github/nope', 'unknown-slug', '/macos/github'],
    ['/macos/finder/skills', 'unknown-slug', '/macos/finder'],
    ['/beos', 'unknown-os', '/'],
    ['/linux/terminal/etc', 'bad-vfs-path', '/linux'],
    ['/linux/viewer/projects/nope', 'bad-vfs-path', '/linux'],
    ['/go/projects/nope', 'unknown-slug', '/go/projects'],
    ['/go/nope', 'unknown-slug', '/'],
    ['/macos/settings/extra', 'unknown-slug', '/macos/settings'],
  ])('%s → %s → %s', (path, reason, nearest) => {
    const decoded = fixtureCodec.decode(path);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.reason).toBe(reason);
    expect(fixtureCodec.encode(decoded.nearest)).toBe(nearest);
  });

  it('an unreleased OS URL repairs to the chooser', () => {
    const codec = createRouteCodec({ registry: OS_REGISTRY, catalog: fixtureCatalog, visible: ['macos'] });
    expect(codec.decode('/android/chrome')).toMatchObject({
      ok: false,
      reason: 'unreleased-os',
      nearest: { kind: 'welcome' },
    });
  });

  it('never throws on malformed escapes, queries or hashes', () => {
    expect(fixtureCodec.decode('/macos/%E0%A4%A')).toMatchObject({ ok: false });
    expect(fixtureCodec.decode('/macos/finder/experience?x=1#y')).toMatchObject({
      ok: true,
      canonical: '/macos/finder/experience',
    });
    expect(fixtureCodec.decode('/macos/finder/experience/')).toMatchObject({
      ok: true,
      canonical: '/macos/finder/experience',
    });
  });
});

describe('ARCH-STATIC-01 static params = registry enumeration', () => {
  it('generateStaticParams equals the registry enumeration', () => {
    const params = osStaticParams(deps, fixtureCodec);
    expect(params.map(({ os, path }) => `/${[os, ...path].join('/')}`)).toEqual(osPaths);
    expect(new Set(params.map((p) => p.os))).toEqual(new Set(OS_IDS));
    expect(goStaticParams(fixtureCatalog, fixtureCodec).map(({ target }) => `/go/${target.join('/')}`)).toEqual(
      goPaths,
    );
  });
});

describe('ARCH-REL-01 only released OSes are visible', () => {
  const released: OsRegistry = { ...OS_REGISTRY, macos: { ...OS_REGISTRY.macos, released: true } };
  it('visibility = released set (+ explicit preview list)', () => {
    expect(visibleOses([], OS_REGISTRY)).toEqual([]);
    expect(visibleOses([], released)).toEqual(['macos']);
    expect(visibleOses(['linux'], released)).toEqual(['macos', 'linux']);
  });
  it('static params and the codec only see the released set', () => {
    const visible = visibleOses([], released);
    const codec = createRouteCodec({ registry: released, catalog: fixtureCatalog, visible });
    const params = osStaticParams({ registry: released, catalog: fixtureCatalog, visible }, codec);
    expect(new Set(params.map((p) => p.os))).toEqual(new Set(['macos']));
    expect(codec.decode('/windows').ok).toBe(false);
  });
});

describe('ROUTE-TITLE-01 shared title function', () => {
  it('titles are unique per route', () => {
    const titles = [...osPaths, ...goPaths, '/', '/plain'].map((path) =>
      titleFor(routeOf(fixtureCodec.decode(path)), { catalog: fixtureCatalog }),
    );
    const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
    expect(duplicates).toEqual([]);
  });
  it('follows the `{Content} · {App} · {OS} — Jaswanth` shape and keeps marks out of the site title', () => {
    const title = (path: string) => titleFor(routeOf(fixtureCodec.decode(path)), { catalog: fixtureCatalog });
    expect(title('/macos/finder/experience/acme')).toBe('Engineer · Acme · Finder · macOS — Jaswanth');
    expect(title('/go/projects')).toBe('Projects — Jaswanth');
    expect(title('/linux/terminal/projects')).toBe('~/projects · Terminal · Linux — Jaswanth');
    expect(title('/')).not.toMatch(/macOS|Windows|iOS|Android|Netflix/);
  });
});
