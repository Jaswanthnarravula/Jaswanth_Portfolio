import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const eslint = new ESLint();
beforeAll(async () => {
  await eslint.calculateConfigForFile('components/os/macos/test.ts');
}, 180_000);
const errors = async (code: string, filePath: string) =>
  (await eslint.lintText(code, { filePath }))[0]?.messages.map((message) => message.ruleId) ?? [];

describe('ARCH-LINT-01 / DATA-SEL-01 / ANL-LINT-01 architecture boundaries', { timeout: 120_000 }, () => {
  it.each([
    ['components/os/macos/test.ts', "import '@/components/os/windows/window';"],
    ['components/os/ios/apps/test.ts', "export * from '../../android/window';"],
    ['components/os/android/test.ts', "const x = import('@/components/os/ios/window'); void x;"],
    ['components/content/test.ts', "import '@/data/portfolio';"],
    ['lib/kernel/test.ts', "import 'react';"],
    ['lib/terminal/test.ts', "import 'react-dom/client';"],
    ['components/shell/test.ts', "import '@vercel/analytics';"],
  ])('rejects forbidden import in %s', async (file, code) => {
    expect(await errors(code, file)).toContain('architecture/boundaries');
  });
  it.each([
    'history.back();',
    'localStorage.clear();',
    'requestAnimationFrame(() => {});',
    'window.sessionStorage.clear();',
  ])('rejects scattered browser effects: %s', async (code) => {
    const result = await errors(code, 'components/shell/test.ts');
    expect(result.some((rule) => rule?.startsWith('no-restricted-'))).toBe(true);
  });
  it('allows headless sharing, selectors and effects in their owners', async () => {
    expect(
      await errors("import '@/components/os/shared/window'; import '@/data/selectors';", 'components/os/macos/test.ts'),
    ).not.toContain('architecture/boundaries');
    expect(await errors('window.history.back();', 'lib/kernel/history/test.ts')).toEqual([]);
  });
});
