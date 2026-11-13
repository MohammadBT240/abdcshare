import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { createItem, destroyItem, unique } from '../support/library';

/**
 * D23: iOS Safari shows only the first page of a PDF in an iframe; PDF.js renders every page.
 * Runs in the `mobile` project (iPhone 13 viewport; Chromium engine in this environment).
 */
test('a 30-page PDF scrolls through every page at phone width', async ({ browser, playwright, baseURL }) => {
  const audit = await apiAs(playwright, 'audit', baseURL!);
  const item = await createItem(audit, { title: unique('E2E 30 pages'), file: 'thirty-pages.pdf' });
  const { context, page } = await pageAs(browser, 'tax', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(`/library/${item.id}`);
  await expect(page.getByTestId('pdf-page-indicator')).toHaveText('Page 1 of 30', { timeout: 20_000 });

  for (let n = 1; n <= 30; n++) {
    const p = page.locator(`[data-pdf-page="${n}"]`);
    await p.scrollIntoViewIfNeeded();
    await expect(p).toHaveAttribute('data-ever-rendered', 'true', { timeout: 15_000 });
  }
  await expect(page.getByTestId('pdf-page-indicator')).toHaveText('Page 30 of 30');
  // Pages fit the phone width (no horizontal overflow on the page itself).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  // Pages scrolled far away release their canvases (long documents on phones).
  await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute('data-state', 'idle');
  await page.screenshot({ path: 'test-results/library-pdf-mobile.png' });

  const sa = await apiAs(playwright, 'sa', baseURL!);
  await destroyItem(sa, item.id);
  await sa.dispose();
  await audit.dispose();
  await context.close();
});
