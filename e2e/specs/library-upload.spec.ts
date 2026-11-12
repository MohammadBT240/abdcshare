import path from 'node:path';
import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { FILES, destroyItem, unique } from '../support/library';

test.describe('Library upload and in-browser viewing (UI)', () => {
  const created: string[] = [];

  test.afterAll(async ({ playwright, baseURL }) => {
    const sa = await apiAs(playwright, 'sa', baseURL!);
    for (const id of created) await destroyItem(sa, id);
    await sa.dispose();
  });

  async function uploadViaDialog(page: import('@playwright/test').Page, file: string, title: string, category: string) {
    await page.goto('/library');
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add to the library' });
    await dialog.locator('input[type=file]').setInputFiles(path.join(FILES, file));
    await dialog.getByLabel('Title').fill(title);
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: category }).click();
    await dialog.getByLabel('Tags').fill('e2e, ifrs');
    await dialog.getByLabel('Tags').press('Enter');
    await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 60_000 });
    await expect(page.getByText('Added to the library')).toBeVisible();
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
    created.push(page.url().split('/').pop()!);
  }

  test('staff upload a PDF and read it in the browser', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'tax');
    const title = unique('E2E PDF upload');
    await uploadViaDialog(page, 'sample.pdf', title, 'Research Papers');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.locator('iframe[title^="Preview of"]')).toBeVisible();
    await expect(page.getByText('#ifrs')).toBeVisible();
    await page.screenshot({ path: 'test-results/library-item-pdf.png', fullPage: true });
    await context.close();
  });

  test('a Word document is converted to PDF by the worker and shown', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'tax');
    const title = unique('E2E DOCX upload');
    await uploadViaDialog(page, 'sample.docx', title, 'Training Materials');
    // Pending → Ready via LibreOffice in the worker; the viewer polls on its own.
    await expect(page.locator('iframe[title^="Preview of"]')).toBeVisible({ timeout: 60_000 });
    await context.close();
  });

  test('images and CSV render inline', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'tax');
    const img = unique('E2E PNG upload');
    await uploadViaDialog(page, 'sample.png', img, 'Reports');
    await expect(page.getByRole('img', { name: img })).toBeVisible();
    const csv = unique('E2E CSV upload');
    await uploadViaDialog(page, 'sample.csv', csv, 'Reports');
    await expect(page.getByText('Alpha,100')).toBeVisible();
    await context.close();
  });
});
