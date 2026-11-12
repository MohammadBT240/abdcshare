import path from 'node:path';
import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { FILES, bff, destroyItem } from '../support/library';

test('bulk upload: a failed file can be retried without creating a duplicate', async ({ browser, playwright, baseURL }) => {
  const { context, page } = await pageAs(browser, 'audit');
  // Fail the first storage PUT for the PNG (network drop), let everything else through.
  let failed = false;
  await page.route('**/api/storage/local/**', async (route) => {
    if (!failed && route.request().method() === 'PUT' && route.request().url().includes('sample.png')) {
      failed = true;
      return route.abort('connectionreset');
    }
    return route.continue();
  });

  await page.goto('/library');
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Several files' }).click();
  const bulk = page.getByRole('dialog', { name: 'Upload several files' });
  await bulk.locator('input[type=file]').setInputFiles(['sample.pdf', 'sample.png'].map((f) => path.join(FILES, f)));
  const stamp = Date.now().toString(36);
  await bulk.getByRole('textbox', { name: 'Title for sample.pdf' }).fill(`E2E bulk pdf ${stamp}`);
  await bulk.getByRole('textbox', { name: 'Title for sample.png' }).fill(`E2E bulk png ${stamp}`);
  await bulk.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Reports' }).click();
  await bulk.getByRole('checkbox', { name: /no client-identifiable information/ }).check();
  await bulk.getByRole('button', { name: 'Upload 2 files' }).click();

  await expect(bulk.getByRole('button', { name: 'Retry', exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(bulk.getByText('1/2 uploaded')).toBeVisible();
  await bulk.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(bulk).toBeHidden({ timeout: 60_000 });

  const api = await apiAs(playwright, 'audit', baseURL!);
  const res = await (await api.get(bff(`library/items?mine=true&q=${stamp}&pageSize=50`))).json();
  const titles = res.data.map((i: { title: string }) => i.title).sort();
  expect(titles).toEqual([`E2E bulk pdf ${stamp}`, `E2E bulk png ${stamp}`]);
  const sa = await apiAs(playwright, 'sa', baseURL!);
  for (const i of res.data) await destroyItem(sa, i.id);
  await sa.dispose();
  await api.dispose();
  await context.close();
});
