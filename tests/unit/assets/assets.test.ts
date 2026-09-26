/**
 * ASSET-MAN-01 (every entry resolves in both modes), ASSET-ORIG-01 (every binding has an original), ASSET-BUDGET-01
 * (size audit), ASSET-MARK-01 (no third-party marks in title/favicon/manifest/OG), ASSET-INBOX-01 (ingest validates and
 * writes hashed files + manifest fields).
 */
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST, assetCredits, getAsset, resolveAsset } from '@/lib/assets/manifest';
import { TECH_LOGOS, techAssetId } from '@/lib/assets/tech';
import { ORG_LOGOS, orgAssetFor, orgAssetId } from '@/lib/assets/orgs';
import { getCredentials, getEducation, getExperience, getSkills } from '@/data/selectors';
import { OS_IDS } from '@/lib/kernel/ids';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { BUDGETS, GUEST_GREEN, cssHueSaturate, ingestAssets } from '../../../scripts/ingest-assets.mjs';

describe('the derived green avatar is the storyboard’s CSS filter, baked in (plans/03 "Visual target")', () => {
  const apply = (m: number[][], v: number[]) => m.map((row) => row.reduce((sum, k, i) => sum + k * v[i]!, 0));
  it('hue-rotate(0) saturate(1) is the identity', () => {
    const identity = cssHueSaturate(0, 1);
    identity.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(i === j ? 1 : 0, 10)));
  });
  it('GUEST_GREEN is hue-rotate(-62deg) then saturate(1.15), as Filter Effects defines them', () => {
    expect(GUEST_GREEN).toEqual(cssHueSaturate(-62, 1.15));
    // Grey stays grey (both matrices preserve luminance-weighted neutrals) …
    apply(GUEST_GREEN, [0.5, 0.5, 0.5]).forEach((v) => expect(v).toBeCloseTo(0.5, 6));
    // … and the blue avatar's cyan fur turns green: the green channel dominates.
    const [r, g, b] = apply(GUEST_GREEN, [0.1, 0.7, 0.85]);
    expect(g).toBeGreaterThan(r!);
    expect(g).toBeGreaterThan(b!);
  });
});

describe('ASSET-MAN-01 typed manifest + resolver', () => {
  it('every manifest entry resolves in both modes', () => {
    for (const entry of ASSET_MANIFEST) {
      const original = resolveAsset(entry.id, 'original');
      expect(original.render).toBe('original');
      const official = resolveAsset(entry.id, 'official');
      expect(['image', 'audio', 'original']).toContain(official.render);
      if (official.render === 'image') expect(existsSync(join('public', official.src))).toBe(true);
    }
  });
  it('boxes are identical in both modes (no layout shift)', () => {
    for (const entry of ASSET_MANIFEST)
      expect(resolveAsset(entry.id, 'official').box).toEqual(resolveAsset(entry.id, 'original').box);
  });
  it('icons are decorative (alt="")', () => {
    for (const entry of ASSET_MANIFEST) expect(entry.alt).toBe('');
  });
  it('the iOS wallpaper: the iPhone 16 artwork in official mode, the CSS gradient in original mode', () => {
    const official = resolveAsset('wallpaper.ios', 'official');
    expect(official.render).toBe('image');
    if (official.render === 'image')
      expect(official.src).toMatch(/^\/assets\/official\/wallpaper\.ios\.[0-9a-f]{10}\.avif$/);
    const original = resolveAsset('wallpaper.ios', 'original');
    expect(original.render === 'original' && original.source).toEqual({ css: 'var(--wallpaper-ios)' });
  });
  it('unknown ids throw (typos are caught)', () => {
    expect(() => resolveAsset('app.macos.nope')).toThrow();
  });
});

describe('ASSET-ORIG-01 parametric original for every app', () => {
  it('every OsAppBinding.icon has an original', () => {
    for (const os of OS_IDS)
      for (const binding of OS_REGISTRY[os].apps) {
        const entry = getAsset(binding.icon);
        expect(entry, binding.icon).toBeDefined();
        expect('parametric' in entry!.original).toBe(true);
      }
  });
});

describe('ROUTE-PLAIN-01 reader Toolbox logos', () => {
  it('every logo names a published skill and has a manifest entry with an original', () => {
    const skills = new Set(getSkills().flatMap((group) => group.items.map((skill) => skill.name)));
    for (const logo of TECH_LOGOS) {
      expect(skills.has(logo.skill), logo.skill).toBe(true);
      const entry = getAsset(techAssetId(logo.slug));
      expect(entry?.kind).toBe('tech-logo');
      expect('parametric' in entry!.original).toBe(true);
    }
  });
});

describe('ROUTE-PLAIN-01 reader organisation logos', () => {
  it('every employer, client, school and issuer in the data has a logo entry with a monogram original', () => {
    const names = [
      ...getExperience().flatMap((role) => [role.company, ...(role.client ? [role.client] : [])]),
      ...getEducation().map((school) => school.school),
      ...getCredentials().map((credential) => credential.issuer),
    ];
    for (const name of names) {
      const id = orgAssetFor(name);
      expect(id, name).toBeDefined();
      expect(getAsset(id!), name).toBeDefined();
    }
    for (const logo of ORG_LOGOS) expect('monogram' in getAsset(orgAssetId(logo.slug))!.original).toBe(true);
  });
});

describe('ASSET-BUDGET-01 size budgets', () => {
  it('every official file is within its budget', () => {
    for (const entry of ASSET_MANIFEST) {
      if (!entry.official) continue;
      const budget = BUDGETS[entry.kind as keyof typeof BUDGETS] ?? 12 * 1024;
      for (const bytes of entry.official.bytes) expect(bytes, entry.id).toBeLessThanOrEqual(budget);
    }
  });
  it('the files on disk match the recorded sizes', () => {
    for (const entry of ASSET_MANIFEST) {
      if (!entry.official) continue;
      const files = entry.official.srcSet
        ? entry.official.srcSet.split(', ').map((part) => part.split(' ')[0]!)
        : [entry.official.src];
      files.forEach((file, index) => expect(statSync(join('public', file)).size).toBe(entry.official!.bytes[index]));
    }
  });
  it('credits exist for every official asset', () => {
    expect(assetCredits().length).toBe(ASSET_MANIFEST.filter((entry) => entry.official).length);
  });
});

describe('ASSET-MARK-01 no third-party marks in site branding', () => {
  const MARKS = /apple|macos|windows|microsoft|android|google|netflix|github|ios\b|safari|chrome|edge|finder/i;
  it('the favicon and manifest use only original artwork', () => {
    const icon = readFileSync('app/icon.svg', 'utf8');
    expect(icon).not.toMatch(/assets\/official/);
    const manifest = readFileSync('app/manifest.ts', 'utf8');
    expect(manifest).not.toMatch(/assets\/official/);
    expect(manifest.match(/name: '([^']+)'/)?.[1]).not.toMatch(MARKS);
  });
  it('the site title and OG card template reference no official asset or mark', () => {
    const og = readFileSync('lib/seo/og.tsx', 'utf8');
    expect(og).not.toMatch(/assets\/official|resolveAsset|AssetIcon/);
    const title = readFileSync('lib/kernel/route/title.ts', 'utf8').match(/SITE_TITLE = '([^']+)'/)?.[1];
    expect(title).toBeDefined();
    expect(title).not.toMatch(MARKS);
  });
});

describe('ASSET-INBOX-01 assets-inbox ingestion', () => {
  const require = createRequire(join(process.cwd(), 'package.json'));
  const sharp = require('sharp');

  it('validates size/format, writes hashed files and manifest fields; bad files fall back', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ingest-'));
    const inbox = join(dir, 'inbox');
    mkdirSync(join(inbox, 'icons'), { recursive: true });
    const png = await sharp({
      create: { width: 256, height: 256, channels: 4, background: { r: 30, g: 120, b: 250, alpha: 1 } },
    })
      .png()
      .toBuffer();
    writeFileSync(join(inbox, 'icons/good.png'), png);
    writeFileSync(
      join(inbox, 'icons/tiny.png'),
      await sharp({ create: { width: 16, height: 16, channels: 4, background: '#fff' } })
        .png()
        .toBuffer(),
    );
    writeFileSync(join(inbox, 'icons/fake.png'), 'not an image');
    // A phone-sized wallpaper (smooth artwork, as real wallpapers are) and one too small for a phone screen.
    const gradient = (width: number, height: number) =>
      sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#2a3aa8"/><stop offset="1" stop-color="#b9b3ff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
        ),
      )
        .jpeg({ quality: 92 })
        .toBuffer();
    writeFileSync(join(inbox, 'icons/wall.jpg'), await gradient(1290, 2796));
    writeFileSync(join(inbox, 'icons/wall-small.jpg'), await gradient(600, 1300));
    writeFileSync(
      join(inbox, 'icons/mark.svg'),
      '<?xml version="1.0"?><!-- c --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
    );
    const common = { owner: 'Owner', terms: 'terms', sourceUrl: 'https://example.com', retrieved: '2026-09-21' };
    const manifestPath = join(dir, 'official.json');
    const logs: string[] = [];
    const { entries, warnings } = await ingestAssets({
      inboxDir: inbox,
      publicDir: join(dir, 'public'),
      manifestPath,
      sharp,
      log: (message: string) => logs.push(message),
      sources: [
        { id: 'app.test.good', file: 'icons/good.png', kind: 'app-icon', sizes: [64, 128], label: 'Good', ...common },
        { id: 'app.test.tiny', file: 'icons/tiny.png', kind: 'app-icon', sizes: [64, 128], label: 'Tiny', ...common },
        { id: 'app.test.fake', file: 'icons/fake.png', kind: 'app-icon', sizes: [64], label: 'Fake', ...common },
        { id: 'app.test.mark', file: 'icons/mark.svg', kind: 'system-icon', label: 'Mark', ...common },
        { id: 'app.test.missing', file: 'icons/missing.png', kind: 'app-icon', label: 'Missing', ...common },
        { id: 'wallpaper.test', file: 'icons/wall.jpg', kind: 'wallpaper', label: 'Wall', ...common },
        { id: 'wallpaper.small', file: 'icons/wall-small.jpg', kind: 'wallpaper', label: 'Small', ...common },
      ],
    });
    expect(Object.keys(entries).sort()).toEqual(['app.test.good', 'app.test.mark', 'wallpaper.test']);
    // A wallpaper is one AVIF at its own size, within its budget.
    expect(entries['wallpaper.test'].src).toMatch(/^\/assets\/official\/wallpaper\.test\.[0-9a-f]{10}\.avif$/);
    expect([entries['wallpaper.test'].width, entries['wallpaper.test'].height]).toEqual([1290, 2796]);
    expect(entries['wallpaper.test'].bytes[0]).toBeLessThanOrEqual(BUDGETS.wallpaper);
    expect(warnings.join('\n')).toMatch(/wallpaper\.small: too small/);
    expect(entries['app.test.good'].srcSet).toMatch(
      /app\.test\.good\.64\.[0-9a-f]{10}\.webp 64w, .*\.128\.[0-9a-f]{10}\.webp 128w/,
    );
    expect(entries['app.test.good'].owner).toBe('Owner');
    expect(readFileSync(join(dir, 'public', entries['app.test.mark'].src), 'utf8')).not.toMatch(/<\?xml|<!--/);
    expect(warnings.join('\n')).toMatch(/app\.test\.tiny: too small/);
    expect(warnings.join('\n')).toMatch(/app\.test\.fake/);
    expect(warnings.join('\n')).toMatch(/app\.test\.missing: missing/);
    expect(JSON.parse(readFileSync(manifestPath, 'utf8')).entries['app.test.good']).toBeDefined();
    expect(
      readdirSync(join(dir, 'public/assets/official')).every((name) => /\.[0-9a-f]{10}\.(webp|svg|avif)$/.test(name)),
    ).toBe(true);
  }, 30_000);
});
