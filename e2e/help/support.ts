import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRequestContext, Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { DEMO_PERSONAS, type DemoKey } from '../../apps/api/src/database/help-demo-personas';
import { HELP_AUTH_DIR } from './global-setup';

export { DEMO_PERSONAS, type DemoKey };

export const IMAGES = path.join(__dirname, '..', '..', 'docs', 'help', 'images');
export const DEMO_FILES = path.join(__dirname, 'files');

export async function pageAs(browser: Browser, key: DemoKey, opts: Parameters<Browser['newContext']>[0] = {}) {
  const context: BrowserContext = await browser.newContext({ ...opts, storageState: path.join(HELP_AUTH_DIR, `${key}.json`) });
  const page: Page = await context.newPage();
  return { context, page };
}

export async function apiAs(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }, key: DemoKey, baseURL: string) {
  return playwright.request.newContext({ baseURL, storageState: path.join(HELP_AUTH_DIR, `${key}.json`) });
}

/** Hide moving parts (spinners, toasts, carets) so screenshots are stable. */
async function settle(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }
      [data-sonner-toaster] { display: none !important; } nextjs-portal { display: none !important; }`,
  });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
}

// sharp ships with Next (apps/web); reuse it rather than adding an image library to e2e.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require(require.resolve('sharp', { paths: [path.join(__dirname, '..', '..', 'apps', 'web')] })) as (
  input: Buffer,
) => { resize: (o: object) => { webp: (o: object) => { toBuffer: () => Promise<Buffer> } } };

/** Screenshots are stored as WebP (≈⅓ the size of PNG), at most 2000 px wide. */
async function save(file: string, png: Buffer): Promise<void> {
  const webp = await sharp(png).resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  await writeFile(file, webp);
}

/**
 * Save a screenshot to docs/help/images/<name>.webp. `target` is a page (viewport) or a locator
 * (element crop, padded). Names are `<category>/<what>`.
 */
export async function shot(target: Page | Locator, name: string, opts: { pad?: number; fullPage?: boolean } = {}): Promise<void> {
  const file = path.join(IMAGES, `${name}.webp`);
  await mkdir(path.dirname(file), { recursive: true });
  const page = 'page' in target && typeof (target as Locator).page === 'function' ? (target as Locator).page() : (target as Page);
  await settle(page);
  if (page === target) {
    await save(file, await page.screenshot({ fullPage: opts.fullPage ?? false }));
    return;
  }
  await (target as Locator).scrollIntoViewIfNeeded();
  const box = await (target as Locator).boundingBox();
  if (!box) throw new Error(`Nothing to screenshot for ${name}`);
  const pad = opts.pad ?? 12;
  const vp = page.viewportSize()!;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const png = await page.screenshot({
    clip: { x, y, width: Math.min(vp.width - x, box.width + pad * 2), height: Math.min(Math.max(vp.height, box.y + box.height + pad) - y, box.height + pad * 2) },
  });
  await save(file, png);
}

/** Open a searchable combobox (by its current text), search, and pick an option. */
export async function combo(scope: Locator | Page, trigger: string | RegExp, search: string, option?: string | RegExp): Promise<void> {
  const page = 'page' in scope && typeof (scope as Locator).page === 'function' ? (scope as Locator).page() : (scope as Page);
  await scope.getByRole('combobox').filter({ hasText: trigger }).first().click();
  const input = page.locator('[cmdk-input]').last();
  await input.fill(search);
  await page.getByRole('option', { name: option ?? search }).first().click();
}

/** Radix select (AppSelect): open by its current text and pick an option. */
export async function choose(scope: Locator | Page, trigger: string | RegExp, option: string | RegExp): Promise<void> {
  const page = 'page' in scope && typeof (scope as Locator).page === 'function' ? (scope as Locator).page() : (scope as Page);
  await scope.getByRole('combobox').filter({ hasText: trigger }).first().click();
  await page.getByRole('option', { name: option }).first().click();
}
