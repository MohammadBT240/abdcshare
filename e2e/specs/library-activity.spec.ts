import path from 'node:path';
import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { FILES, bff, createItem, destroyItem, unique } from '../support/library';

test('Activity tab: views and downloads from two people, a replacement (declared again) and an edit', async ({
  browser,
  playwright,
  baseURL,
}) => {
  const auditApi = await apiAs(playwright, 'audit', baseURL!);
  const taxApi = await apiAs(playwright, 'tax', baseURL!);
  const saApi = await apiAs(playwright, 'sa', baseURL!);
  const item = await createItem(auditApi, { title: unique('E2E activity') });

  // Two people read it; one downloads. Every view counts.
  await taxApi.get(bff(`library/items/${item.id}/preview`));
  await taxApi.get(bff(`library/items/${item.id}/preview`));
  await taxApi.get(bff(`library/items/${item.id}/download`));
  await saApi.get(bff(`library/items/${item.id}/preview`));
  // Staff who aren't the uploader can't read the timeline.
  expect((await taxApi.get(bff(`library/items/${item.id}/events`))).status()).toBe(403);

  const { context, page } = await pageAs(browser, 'audit');
  await page.goto(`/library/${item.id}`);

  // Replace the file: the declaration must be ticked again.
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Replace file' }).click();
  const replace = page.getByRole('dialog', { name: 'Replace file' });
  await replace.locator('input[type=file]').setInputFiles(path.join(FILES, 'thirty-pages.pdf'));
  await expect(replace.getByRole('button', { name: 'Replace' })).toBeDisabled();
  await replace.getByRole('checkbox', { name: /no client-identifiable information/ }).check();
  await replace.getByRole('button', { name: 'Replace' }).click();
  await expect(replace).toBeHidden({ timeout: 60_000 });

  // Edit: licence → Licensed (logged as an edit of the licence).
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit details' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit details' });
  await edit.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'Licensed material' }).click();
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit).toBeHidden();

  await page.getByRole('tab', { name: 'Activity' }).click();
  const log = page.getByRole('list', { name: 'Activity' });
  await expect(log.locator('[data-action="Viewed"]').filter({ hasText: 'Tunde Tax' })).toHaveCount(2);
  await expect(log.locator('[data-action="Viewed"]').filter({ hasText: 'Sade Super' })).toHaveCount(1);
  await expect(log.locator('[data-action="Downloaded"]')).toContainText('Tunde Tax downloaded it');
  await expect(log.locator('[data-action="FileReplaced"]')).toContainText('with thirty-pages.pdf');
  await expect(log.locator('[data-action="Edited"]')).toContainText('edited the licence');
  await expect(log.locator('[data-action="Uploaded"]')).toContainText('Amaka Audit uploaded');
  // The tile matches the timeline: every view counts, including the uploader's own.
  const viewed = await log.locator('[data-action="Viewed"]').count();
  expect(viewed).toBeGreaterThanOrEqual(3);
  await expect(page.getByText('Views', { exact: true }).locator('..')).toHaveText(`${viewed}Views`);
  await page.screenshot({ path: 'test-results/library-activity.png', fullPage: true });

  // The API refuses a replacement without a fresh declaration.
  const presign = await (
    await auditApi.post(bff(`library/items/${item.id}/files/presign`), {
      data: { fileName: 'again.pdf', contentType: 'application/pdf' },
    })
  ).json();
  const confirm = await auditApi.post(bff(`library/items/${item.id}/files`), {
    data: { storageKey: presign.storageKey, fileName: 'again.pdf', mimeType: 'application/pdf' },
  });
  expect(confirm.status()).toBe(400);

  await destroyItem(saApi, item.id);
  await context.close();
  for (const a of [auditApi, taxApi, saApi]) await a.dispose();
});
