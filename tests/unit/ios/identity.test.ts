/**
 * iOS identity (plans/ios/01-identity.md) and the Lock Screen's profile independence (plans/ios/surfaces/lock-screen):
 * IOS-ID-01 every semantic token is defined for `[data-os='ios']` — light, and both dark blocks (the
 * `prefers-color-scheme` block and the explicit `data-theme='dark'` block) — and every `--ios-*` token the iOS
 * stylesheets read is declared · IOS-LOCK-05 the Lock Screen content takes no persona and is identical for every
 * "Who's watching?" profile.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lockNotifications, type LockData } from '@/components/os/ios/model';
import { getFeaturedProjects, getPerson, getProjectsWithGithub, getResume } from '@/data/selectors';
import { PERSONA_IDS } from '@/lib/kernel/ids';

/** The shared semantic token list (the same list `tests/unit/design/tokens.test.ts` checks for every OS). */
const SEMANTIC_TOKENS = [
  '--surface-base',
  '--surface-raised',
  '--surface-overlay',
  '--surface-chrome',
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--text-on-accent',
  '--border-subtle',
  '--border-strong',
  '--accent',
  '--focus-ring',
  '--scrim-light',
  '--scrim-dark',
  '--radius-control',
  '--radius-card',
  '--radius-window',
  '--radius-icon',
  '--radius-sheet',
  '--target-min',
  '--font-ui',
  '--font-display',
  '--font-mono',
  '--font-size-caption',
  '--font-size-body',
  '--font-size-title',
  '--font-size-large',
  '--elevation-1',
  '--elevation-2',
  '--elevation-3',
  '--elevation-4',
  '--elevation-5',
  '--material-thin',
  '--material-regular',
  '--material-thick',
  '--material-chrome',
] as const;

/** Colour tokens that must change with the theme (the rest — radii, type, targets, scrims — are theme-invariant). */
const THEMED = [
  '--surface-base',
  '--surface-raised',
  '--surface-overlay',
  '--surface-chrome',
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--border-subtle',
  '--border-strong',
  '--accent',
  '--focus-ring',
  '--material-thin',
  '--material-regular',
  '--material-thick',
  '--material-chrome',
] as const;

const IOS_CSS = readFileSync('styles/os/ios.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Declarations of the first `selector { … }` block in the iOS skin. */
function blockScope(selector: string): Map<string, string> {
  const start = IOS_CSS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No block for ${selector}`);
  const open = IOS_CSS.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let index = open; index < IOS_CSS.length; index++) {
    if (IOS_CSS[index] === '{') depth++;
    if (IOS_CSS[index] === '}') depth--;
    if (depth === 0) {
      end = index;
      break;
    }
  }
  const declarations = new Map<string, string>();
  for (const match of IOS_CSS.slice(open + 1, end).matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g))
    declarations.set(match[1]!, match[2]!.trim().replace(/\s+/g, ' '));
  return declarations;
}

const light = () => blockScope("[data-os='ios']");
const systemDark = () => blockScope(":root:not([data-theme='light']) [data-os='ios']");
const explicitDark = () => blockScope(":root[data-theme='dark'] [data-os='ios']");

describe('IOS-ID-01 iOS token scope complete (light and both dark blocks)', () => {
  it('IOS-ID-01 data-os=ios (light) defines every semantic token', () => {
    const scope = light();
    expect(SEMANTIC_TOKENS.filter((token) => !scope.has(token))).toEqual([]);
  });

  it('IOS-ID-01 the system-dark block sits inside prefers-color-scheme: dark and is guarded by data-theme≠light', () => {
    expect(IOS_CSS).toMatch(
      /@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme='light'\]\) \[data-os='ios'\]\s*{/,
    );
  });

  it.each([
    ['system dark', systemDark],
    ['explicit dark', explicitDark],
  ] as const)('IOS-ID-01 %s: every semantic token resolves, every themed colour is re-declared', (_name, dark) => {
    const scope = dark();
    const merged = new Map([...light(), ...scope]);
    expect(SEMANTIC_TOKENS.filter((token) => !merged.has(token))).toEqual([]);
    expect(THEMED.filter((token) => !scope.has(token))).toEqual([]);
    // A dark block only re-themes: it never introduces a token the light scope lacks.
    const base = light();
    expect([...scope.keys()].filter((token) => token !== 'color-scheme' && !base.has(token))).toEqual([]);
    expect(scope.get('color-scheme')).toBe('dark');
    // Dark really is dark: the base surface and primary text flip.
    expect(scope.get('--surface-base')).not.toBe(base.get('--surface-base'));
    expect(scope.get('--text-primary')).not.toBe(base.get('--text-primary'));
  });

  it('IOS-ID-01 the two dark blocks are identical (system dark = explicit dark)', () => {
    expect(Object.fromEntries(systemDark())).toEqual(Object.fromEntries(explicitDark()));
  });

  it('IOS-ID-01 every --ios-* token the iOS stylesheets read without a fallback is declared by the skin', () => {
    const base = light();
    const used = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith('.module.css'))
          for (const match of readFileSync(path, 'utf8').matchAll(/var\((--ios-[\w-]+)\s*\)/g)) used.add(match[1]!);
      }
    };
    walk('components/os/ios');
    expect(used.size).toBeGreaterThan(20);
    expect([...used].filter((token) => !base.has(token))).toEqual([]);
  });
});

describe('IOS-LOCK-05 Lock Screen content is identical for every profile', () => {
  /** The data the shell feeds the Lock Screen — built exactly as `components/os/ios/Shell.tsx` builds it. */
  const shellData = (): LockData => {
    const featured = getFeaturedProjects()[0];
    return {
      updatedLabel: getResume().updated,
      projects: getProjectsWithGithub().length,
      featuredName: featured?.name ?? null,
      openTo: getPerson().openTo,
      continuity: null,
    };
  };

  it('IOS-LOCK-05 the content function takes one argument and its input type has no persona field', () => {
    expect(lockNotifications.length).toBe(1);
    expect(Object.keys(shellData()).sort()).toEqual([
      'continuity',
      'featuredName',
      'openTo',
      'projects',
      'updatedLabel',
    ]);
    // Neither the model's lock section nor the Lock Screen surface reads a persona.
    const model = readFileSync('components/os/ios/model.ts', 'utf8');
    const lockSection = model.slice(model.indexOf('// --- Lock Screen notifications'), model.indexOf('// --- Banners'));
    expect(lockSection.length).toBeGreaterThan(200);
    expect(lockSection).not.toMatch(/persona/i);
    expect(readFileSync('components/os/ios/surfaces/LockScreen.tsx', 'utf8')).not.toMatch(/persona/i);
  });

  it('IOS-LOCK-05 the iOS shell never reads the persona, so every profile builds the same lock data', () => {
    // The shell is where a persona could leak in (it assembles `LockData`); it must not even mention one.
    expect(readFileSync('components/os/ios/Shell.tsx', 'utf8')).not.toMatch(/persona/i);
    const outputs = PERSONA_IDS.map(() => JSON.stringify(lockNotifications(shellData())));
    expect(new Set(outputs).size).toBe(1);
    expect((JSON.parse(outputs[0]!) as { id: string }[]).map((item) => item.id)).toEqual(['resume', 'github', 'mail']);
  });
});
