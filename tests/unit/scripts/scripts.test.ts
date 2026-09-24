/**
 * DATA-GUARD-01 (placeholder guard), GH-FETCH-01, GH-SAFE-01, GH-TOKEN-01, PERF-3D-01, DATA-RESUME-01 (freshness,
 * ingestion of the owner's Resume.pdf), VIEW-RESUME-01 (page text extraction), DEPLOY-STATIC-01 (post-build audit).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditClientSecrets, auditStaticOutput } from '../../../scripts/check-build.mjs';
import { OWNER_RESUME, pdfPageCount, resolveResume } from '../../../scripts/build-resume.mjs';
import { blocksFromLines, linesFromItems } from '../../../scripts/resume-pages.mjs';
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

describe('DATA-RESUME-01 (freshness) the committed PDF, its pages and text are current', () => {
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
    if (contents !== null) writeFileSync(join(root, OWNER_RESUME), contents, 'latin1');
    return root;
  };

  it('the owner file is Resume.pdf at the repository root', () => {
    expect(OWNER_RESUME).toBe('Resume.pdf');
  });
  it('without Resume.pdf the PDF is generated from the data', async () => {
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
  it('the page counter agrees with the renderer on the published résumé', () => {
    const published = readFileSync(join('public', portfolio.resume.file));
    expect(pdfPageCount(published)).toBe(JSON.parse(readFileSync('data/generated/resume.json', 'utf8')).pages);
  });
  it("compressed object streams hide page objects: the page tree's /Count is the fallback", () => {
    expect(pdfPageCount(Buffer.from('%PDF-1.7\n1 0 obj <</Type /Pages /Kids [3 0 R] /Count 2>>', 'latin1'))).toBe(2);
    expect(pdfPageCount(Buffer.from('%PDF-1.7\n1 0 obj <</Type /ObjStm>>', 'latin1'))).toBe(1);
  });
  it('the published résumé is the owner file, byte for byte, with one image set per page', () => {
    const meta = JSON.parse(readFileSync('data/generated/resume.json', 'utf8'));
    const published = readFileSync(join('public', portfolio.resume.file));
    if (meta.source === 'owner') expect(published.equals(readFileSync(OWNER_RESUME))).toBe(true);
    expect(meta.images).toHaveLength(meta.pages);
    for (const page of meta.images) {
      expect(page.srcset.map(([, width]: [string, number]) => width)).toEqual([816, 1224, 1632, 2448]);
      for (const [src] of page.srcset) expect(statSync(join('public', src)).size).toBeGreaterThan(1000);
    }
    expect(meta.text.length).toBeGreaterThan(0);
  });
});

describe("VIEW-RESUME-01 the text version is the PDF's own text, in reading blocks", () => {
  /** A positioned text item as pdf.js reports it (x/y in points, y grows upwards). */
  const item = (str: string, x: number, y: number, options: { size?: number; bold?: boolean; width?: number } = {}) => {
    const { size = 9, bold = false } = options;
    return { page: 1, str, x, y, width: options.width ?? str.length * size * 0.45, size, bold };
  };
  const text = (runs: { text: string }[]) => runs.map((run) => run.text).join('');

  it('lines read top to bottom; a far-right part (a wide space before it) becomes the aside', () => {
    const lines = linesFromItems([
      item('Engineer', 40, 700, { bold: true, width: 40 }),
      item(' ', 80, 700, { width: 300 }),
      item('Jun 2025 - Present', 500, 700, { bold: true, width: 70 }),
      item('NAME', 200, 760, { size: 16, bold: true }),
    ]);
    expect(lines.map((line) => text(line.runs))).toEqual(['NAME', 'Engineer']);
    expect(lines[1]!.aside).toBe('Jun 2025 - Present');
  });
  it('adjacent items join without a space; a gap inserts one; bold runs stay separate', () => {
    const [line] = linesFromItems([
      item('Languages:', 40, 600, { bold: true, width: 44 }),
      item('Java, Go', 86.5, 600, { width: 40 }),
      item('205', 140, 600, { width: 14 }),
      item('-580', 154, 600, { width: 18 }),
    ]);
    expect(line!.runs).toEqual([{ text: 'Languages:', bold: true }, { text: ' Java, Go 205-580' }]);
  });
  it('blocks: title, headings, dated rows, bullets with wrapped lines, wrapped paragraphs, labelled lines', () => {
    const blocks = blocksFromLines(
      linesFromItems([
        item('ADA LOVELACE', 200, 760, { size: 16, bold: true }),
        item('SUMMARY', 40, 730, { bold: true }),
        item('Engineer building platforms and a long line that reaches the right edge of the page', 40, 715, {
          width: 530,
        }),
        item('services, with more words.', 40, 704, { width: 120 }),
        item('SKILLS', 40, 680, { bold: true }),
        item('Systems:', 40, 665, { bold: true, width: 38 }),
        item('Concurrency, Idempotency, Retry/Backoff, Horizontal Scaling, and a long list to the edge,', 80, 665, {
          width: 490,
        }),
        item('Fault Tolerance', 40, 654, { width: 60 }),
        item('Security:', 40, 640, { bold: true, width: 40 }),
        item('OAuth 2.1, OpenID Connect and another long list of protocols that runs to the edge CSRF', 82, 640, {
          width: 488,
        }),
        item('Tools:', 40, 626, { bold: true, width: 28 }),
        item('Maven, Git', 70, 626, { width: 50 }),
        item('EXPERIENCE', 40, 600, { bold: true }),
        item('IBM: Software Engineer', 40, 585, { bold: true, width: 100 }),
        item('May 2022 - Dec 2023', 500, 585, { bold: true, width: 70 }),
        item('• Tuned plans, indexes and reporting tables, reducing report-', 44, 572, { width: 526 }),
        item('generation time by 60%.', 52, 561, { width: 110 }),
        item('• Second bullet.', 44, 548, { width: 70 }),
      ]),
    );
    expect(blocks.map((block) => [block.kind, text(block.runs), block.aside ?? null])).toEqual([
      ['title', 'ADA LOVELACE', null],
      ['heading', 'SUMMARY', null],
      [
        'text',
        'Engineer building platforms and a long line that reaches the right edge of the page services, with more words.',
        null,
      ],
      ['heading', 'SKILLS', null],
      [
        'text',
        'Systems: Concurrency, Idempotency, Retry/Backoff, Horizontal Scaling, and a long list to the edge, Fault Tolerance',
        null,
      ],
      [
        'text',
        'Security: OAuth 2.1, OpenID Connect and another long list of protocols that runs to the edge CSRF',
        null,
      ],
      ['text', 'Tools: Maven, Git', null],
      ['heading', 'EXPERIENCE', null],
      ['text', 'IBM: Software Engineer', 'May 2022 - Dec 2023'],
      ['item', 'Tuned plans, indexes and reporting tables, reducing report-generation time by 60%.', null],
      ['item', 'Second bullet.', null],
    ]);
  });
  it("the committed text is the owner's résumé (every section, every role)", () => {
    const meta = JSON.parse(readFileSync('data/generated/resume.json', 'utf8'));
    if (meta.source !== 'owner') return;
    const words = (meta.text as { runs: { text: string }[] }[]).map((block) => text(block.runs)).join('\n');
    for (const heading of ['SUMMARY', 'SKILLS', 'PROFESSIONAL EXPERIENCE', 'EDUCATION'])
      expect(words).toContain(heading);
    for (const company of ['Xclusive Trading Inc.', 'IBM']) expect(words).toContain(company);
  });
});
