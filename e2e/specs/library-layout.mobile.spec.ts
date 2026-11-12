import { test, expect } from '@playwright/test';
import { apiAs, authFile } from '../support/fixtures';
import { createItem, destroyItem, unique } from '../support/library';

test.use({ storageState: authFile('tax') });

test('library pages fit a phone screen without sideways scrolling', async ({ page, playwright, baseURL }) => {
  const api = await apiAs(playwright, 'tax', baseURL!);
  const item = await createItem(api, { title: unique('E2E mobile layout item'), tags: ['mobile'] });
  for (const url of ['/library', `/library/${item.id}`]) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${url}`).toBeLessThanOrEqual(1);
  }
  const sa = await apiAs(playwright, 'sa', baseURL!);
  await destroyItem(sa, item.id);
  await sa.dispose();
  await api.dispose();
});
