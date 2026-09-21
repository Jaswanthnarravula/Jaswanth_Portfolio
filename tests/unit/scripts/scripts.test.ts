/**
 * DATA-GUARD-01 (placeholder guard), GH-FETCH-01, GH-SAFE-01, GH-TOKEN-01, PERF-3D-01, DATA-RESUME-01 (freshness),
 * DEPLOY-STATIC-01 (post-build audit).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditClientSecrets, auditStaticOutput } from '../../../scripts/check-build.mjs';
import { OWNER_RESUME, pdfPageCount, resolveResume } from '../../../scripts/build-resume.mjs';
import { findPlaceholders, shouldCheck } from '../../../scripts/check-content.mjs';
import { run } from '../../../scripts/fetch-github.mjs';
import {
  EMPTY_SNAPSHOT,
  fetchGithubSnapshot,
  serializeSnapshot,
  validateSnapshot,
} from '../../../scripts/lib/github-snapshot.mjs';
import { portfolio } from '@/data/portfolio';
import { fixturePortfolio } from '../../fixtures/portfolio';

describe('DATA-GUARD-01 placeholder guard blocks production', () => {
  it('lists every placeholder entry with the missing facts', () => {
    expect(findPlaceholders(fixturePortfolio)).toEqual([]);
    expect(
      findPlaceholders({
        ...fixturePortfolio,
        experience: [{ ...fixturePortfolio.experience[0]!, placeholder: true, start: null }],
      }),
    ).toEqual(['experience/acme (missing: start)']);
  });
  it('runs only for production or when forced', () => {
    expect(shouldCheck({ VERCEL_ENV: 'production' })).toBe(true);
    expect(shouldCheck({ CHECK_CONTENT: '1' })).toBe(true);
    expect(shouldCheck({ VERCEL_ENV: 'preview' })).toBe(false);
  });
  it('check-content exits non-zero with a placeholder present (the real data still has unconfirmed facts)', () => {
    expect(findPlaceholders(portfolio).length).toBeGreaterThan(0);
    let code = 0;
    try {
      execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/check-content.mjs'], {
        env: { ...process.env, CHECK_CONTENT: '1' },
        stdio: 'pipe',
      });
    } catch (error) {
      code = (error as { status: number }).status;
    }
    expect(code).toBe(1);
  }, 30_000);
});

const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;
const USER = { login: 'ada', name: 'Ada', followers: 3, public_repos: 2, html_url: 'https://github.com/ada' };
const REPOS = [
  {
    name: 'one',
    html_url: 'https://github.com/ada/one',
    description: 'x',
    stargazers_count: 5,
    forks_count: 1,
    language: 'Go',
    topics: ['a'],
    pushed_at: '2026-01-01T00:00:00Z',
    archived: false,
    fork: false,
    private: false,
  },
  {
    name: 'forked',
    html_url: 'https://github.com/ada/forked',
    description: null,
    stargazers_count: 0,
    forks_count: 0,
    language: null,
    topics: [],
    pushed_at: '2025-01-01T00:00:00Z',
    archived: false,
    fork: true,
    private: false,
  },
];

describe('GH-FETCH-01 build-time fetch script', () => {
  it('successful responses produce a schema-valid snapshot (forks excluded unless referenced)', async () => {
    const fetchMock = (async (url: string) =>
      String(url).includes('/repos') ? response(REPOS) : response(USER)) as unknown as typeof fetch;
    const snapshot = await fetchGithubSnapshot({
      username: 'ada',
      fetch: fetchMock,
      now: () => new Date('2026-09-21T00:00:00Z'),
    });
    expect(validateSnapshot(snapshot)).toEqual([]);
    expect(snapshot.repos.map((repo) => repo.name)).toEqual(['one']);
    const withFork = await fetchGithubSnapshot({
      username: 'ada',
      fetch: fetchMock,
      referencedRepos: ['https://github.com/ada/forked'],
    });
    expect(withFork.repos.map((repo) => repo.name)).toEqual(['one', 'forked']);
  });
  it('serializes with a stable key order', () => {
    expect(serializeSnapshot({ b: 1, a: { d: 1, c: 2 } })).toBe(
      '{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}\n',
    );
  });
  it('the committed snapshot is schema-valid', () => {
    expect(validateSnapshot(JSON.parse(readFileSync('data/generated/github.json', 'utf8')))).toEqual([]);
    expect(validateSnapshot(EMPTY_SNAPSHOT)).toEqual([]);
  });
});

describe('GH-SAFE-01 failure keeps the snapshot and exits 0', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'gh-'));
    const file = join(dir, 'github.json');
    writeFileSync(file, serializeSnapshot(EMPTY_SNAPSHOT));
    return { file, before: readFileSync(file, 'utf8') };
  };
  it.each([
    [
      'network error',
      (async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch,
    ],
    ['403 rate limit', (async () => response({ message: 'rate limit' }, 403)) as unknown as typeof fetch],
    [
      'bad schema',
      (async (url: string) =>
        String(url).includes('/repos') ? response([{ name: 3 }]) : response(USER)) as unknown as typeof fetch,
    ],
  ])('%s leaves the file untouched', async (_name, fetchImpl) => {
    const { file, before } = setup();
    const outcome = await run({ env: { GITHUB_USERNAME: 'ada' }, fetch: fetchImpl, file, log: () => undefined });
    expect(outcome).toBe('kept');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
  it('no username → skipped', async () => {
    const { file } = setup();
    expect(await run({ env: {}, fetch: globalThis.fetch, file, log: () => undefined })).toBe('skipped');
  });
  it('a timeout aborts and keeps the file', async () => {
    const { file, before } = setup();
    const hang = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) =>
        init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      )) as unknown as typeof fetch;
    const snapshotPromise = fetchGithubSnapshot({ username: 'ada', fetch: hang, timeoutMs: 20 });
    await expect(snapshotPromise).rejects.toThrow('aborted');
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' || name.startsWith('.') ? [] : sourceFiles(path);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [path] : [];
  });
}
const APP_CODE = ['app', 'components', 'lib', 'stores', 'hooks', 'data'].flatMap((dir) => sourceFiles(dir));

describe('GH-TOKEN-01 the token never reaches the client', () => {
  it('no GITHUB_TOKEN reference outside scripts/', () => {
    for (const file of APP_CODE) expect(readFileSync(file, 'utf8'), file).not.toContain('GITHUB_TOKEN');
  });
  it('no NEXT_PUBLIC_ token variable exists', () => {
    expect(readFileSync('.env.example', 'utf8')).not.toMatch(/NEXT_PUBLIC_\w*TOKEN/);
  });
});

describe('PERF-3D-01 dormant 3D pipeline', () => {
  it('no import of @react-three/* or useGLTF in v1 code', () => {
    for (const file of APP_CODE)
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/@react-three\/|useGLTF|GLTFLoader/);
  });
});

describe('DATA-RESUME-01 (freshness) the committed PDF matches the data', () => {
  it('build-resume --check passes', () => {
    const output = execFileSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings', 'scripts/build-resume.mjs', '--check'],
      { encoding: 'utf8' },
    );
    expect(output).toContain('is current');
  }, 30_000);
});

describe('DEPLOY-STATIC-01 the post-build audit fails any dynamic route', () => {
  const page = (srcRoute: string) => ({ srcRoute, initialRevalidateSeconds: false as const, compute: 'static' });
  const appRoutes = {
    '/page': '/',
    '/[os]/[[...path]]/page': '/[os]/[[...path]]',
    '/og/[...card]/route': '/og/[...card]',
  };
  const routes = { '/': page('/'), '/macos': page('/[os]/[[...path]]'), '/og/site': page('/og/[...card]') };
  const dynamicRoutes = { '/[os]/[[...path]]': { fallback: false }, '/og/[...card]': { fallback: false } };

  it('a fully prerendered build passes', () => {
    expect(auditStaticOutput(appRoutes, { routes, dynamicRoutes })).toEqual({ problems: [], staticPaths: 3 });
  });
  it('a fallback:false segment with no paths is static (all 404) — e.g. no OS released yet', () => {
    expect(
      auditStaticOutput(appRoutes, { routes: { '/': page('/'), '/og/site': page('/og/[...card]') }, dynamicRoutes })
        .problems,
    ).toEqual([]);
  });
  it('on-demand fallback, missing output and ISR are each reported', () => {
    const { problems } = auditStaticOutput(
      { ...appRoutes, '/api/page': '/api' },
      {
        routes: { ...routes, '/': { ...page('/'), initialRevalidateSeconds: 60 } },
        dynamicRoutes: { ...dynamicRoutes, '/og/[...card]': { fallback: null } },
      },
    );
    expect(problems).toEqual([
      '/ revalidates (60)',
      '/og/[...card] renders unknown paths on demand',
      '/api has no prerendered output (dynamic at request time)',
    ]);
  });
});

describe('GH-TOKEN-01 (bundle grep) no client asset carries the token', () => {
  it('flags the variable name and the literal value, never short or absent tokens', () => {
    const assets = [
      { path: 'a.js', text: 'const x = process.env.GITHUB_TOKEN' },
      { path: 'b.js', text: 'Authorization: "Bearer ghp_secretvalue123"' },
      { path: 'c.js', text: 'nothing here' },
    ];
    expect(auditClientSecrets(assets, 'ghp_secretvalue123')).toEqual([
      'a.js mentions GITHUB_TOKEN',
      'b.js contains the GitHub token',
    ]);
    expect(auditClientSecrets(assets.slice(2), undefined)).toEqual([]);
    expect(auditClientSecrets([{ path: 'd.js', text: 'abc' }], 'abc')).toEqual([]); // too short to be a real token
  });
});

describe('DATA-RESUME-01 (ingestion) the owner file wins over the generated PDF', () => {
  const generated = { bytes: new Uint8Array([37, 80, 68, 70]), pages: 2 };
  const generate = () => generated;
  const withOwnerFile = (contents: string | null) => {
    const root = mkdtempSync(join(tmpdir(), 'resume-'));
    if (contents !== null) {
      mkdirSync(join(root, 'content'));
      writeFileSync(join(root, OWNER_RESUME), contents, 'latin1');
    }
    return root;
  };

  it('without content/resume.pdf the PDF is generated from the data', async () => {
    const result = await resolveResume({ root: withOwnerFile(null), portfolio, generate });
    expect(result).toEqual({ ...generated, source: 'generated' });
  });
  it("the owner's PDF is published as-is, pages counted from its page objects", async () => {
    const pdf =
      '%PDF-1.7\n1 0 obj <</Type /Pages /Count 3>>\n2 0 obj <</Type/Page>>\n3 0 obj <</Type /Page>>\n4 0 obj <</Type /Page /Parent 1 0 R>>';
    const result = await resolveResume({ root: withOwnerFile(pdf), portfolio, generate });
    expect(result.source).toBe('owner');
    expect(result.pages).toBe(3);
    expect(Buffer.from(result.bytes).toString('latin1')).toBe(pdf);
  });
  it('a file that is not a PDF fails the build instead of shipping', async () => {
    await expect(resolveResume({ root: withOwnerFile('PK\u0003\u0004 docx'), portfolio, generate })).rejects.toThrow(
      'is not a PDF',
    );
  });
  it('the page counter agrees with the generator on the real résumé', () => {
    const published = readFileSync(join('public', portfolio.resume.file));
    expect(pdfPageCount(published)).toBe(JSON.parse(readFileSync('data/generated/resume.json', 'utf8')).pages);
  });
});
