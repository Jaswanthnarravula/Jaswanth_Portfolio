/** Shared e2e helpers (shared/12): wait on end states, never sleep; focus is never on <body>. */
import { expect, type Page, type TestInfo } from '@playwright/test';

/** The OS layer is mounted and the kernel booted (the stub or a real shell renders `[data-os]`). */
export async function waitForOs(page: Page, os: string): Promise<void> {
  await expect(page.locator(`.os-root[data-os="${os}"] [data-os-shell="${os}"]`)).toBeAttached();
}

/** Focus never rests on <body> after an interaction (shared/09). */
export async function expectFocusNotOnBody(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null))
    .toBe(true);
}

export const shellInstance = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.shellInstance ?? null);

/** A sentinel on `window` survives only while the document is not reloaded. */
export const plantSentinel = (page: Page) =>
  page.evaluate(() => ((window as unknown as { __sentinel: string }).__sentinel = 'alive'));
export const sentinel = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sentinel?: string }).__sentinel ?? null);

export const isOriginalMode = (info: TestInfo) => info.project.name === 'asset-original';
export const isTouchProject = (info: TestInfo) =>
  ['iphone', 'pixel', 'ipad-portrait', 'ipad-landscape', 'iphone-landscape'].includes(info.project.name);
