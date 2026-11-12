import path from 'node:path';
import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { FILES, bff, createItem, destroyItem, unique, waitForScan } from '../support/library';

test('a view-only, licensed item: no download for staff (403), uploader still can; ZIP skips it', async ({
  browser,
  playwright,
  baseURL,
}) => {
  // Uploader sets licence + view-only in the upload dialog.
  const audit = await pageAs(browser, 'audit');
  await audit.page.goto('/library');
  await audit.page.getByRole('button', { name: 'Upload', exact: true }).click();
  await audit.page.getByRole('menuitem', { name: 'One file' }).click();
  const dialog = audit.page.getByRole('dialog', { name: 'Add to the library' });
  await dialog.locator('input[type=file]').setInputFiles(path.join(FILES, 'sample.pdf'));
  const title = unique('E2E view-only');
  await dialog.getByLabel('Title').fill(title);
  await dialog.getByRole('combobox').first().click();
  await audit.page.getByRole('option', { name: 'Reports' }).click();
  // Licence picker is the next combobox after category.
  await dialog.getByRole('combobox').nth(1).click();
  await audit.page.getByRole('option', { name: 'Licensed material' }).click();
  await dialog.getByLabel('Licence note').fill('Subscription — internal use only');
  await dialog.getByRole('checkbox', { name: /View-only/ }).check();
  await dialog.getByRole('button', { name: 'What counts as client-identifiable?' }).click();
  await expect(dialog.getByText('Anonymise the file first')).toBeVisible();
  await dialog.getByRole('checkbox', { name: /no client-identifiable information/ }).check();
  await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await audit.page.getByRole('button', { name: 'Open', exact: true }).click();
  await audit.page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
  const id = audit.page.url().split('/').pop()!;
  const auditApiEarly = await apiAs(playwright, 'audit', baseURL!);
  await waitForScan(auditApiEarly, id);
  await auditApiEarly.dispose();
  await audit.page.reload();
  // The uploader can still download, and sees the banner.
  await expect(audit.page.getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(audit.page.getByTestId('licence-banner')).toContainText('Licensed material — do not share outside the firm.');

  // Staff: no Download button, a View-only badge, the banner, and the PDF still renders.
  const tax = await pageAs(browser, 'tax');
  await tax.page.goto(`/library/${id}`);
  await expect(tax.page.getByTestId('licence-banner')).toContainText("can't prevent screenshots");
  await expect(tax.page.getByTestId('licence-banner')).toContainText('Subscription — internal use only');
  await expect(tax.page.getByRole('button', { name: 'Download' })).toHaveCount(0);
  await expect(tax.page.getByText('View-only', { exact: true }).first()).toBeVisible();
  await expect(tax.page.locator('[data-pdf-page="1"][data-ever-rendered="true"]')).toBeVisible({ timeout: 20_000 });
  await tax.page.screenshot({ path: 'test-results/library-view-only.png', fullPage: true });

  // API: 403 for staff, 200 for the uploader and curators.
  const taxApi = await apiAs(playwright, 'tax', baseURL!);
  const auditApi = await apiAs(playwright, 'audit', baseURL!);
  const saApi = await apiAs(playwright, 'sa', baseURL!);
  const denied = await taxApi.get(bff(`library/items/${id}/download`));
  expect(denied.status()).toBe(403);
  expect((await denied.json()).message).toContain('view-only');
  expect((await auditApi.get(bff(`library/items/${id}/download`))).status()).toBe(200);
  expect((await saApi.get(bff(`library/items/${id}/download`))).status()).toBe(200);
  expect((await (await taxApi.get(bff(`library/items/${id}`))).json()).canDownload).toBe(false);

  // ZIP: a collection with one normal + one view-only item zips one file for staff.
  const normal = await createItem(auditApi, { title: unique('E2E zip normal') });
  const col = await (
    await auditApi.post(bff('library/collections'), { data: { title: unique('E2E view-only zip'), type: 'Training' } })
  ).json();
  await auditApi.post(bff(`library/collections/${col.id}/items`), { data: { itemIds: [normal.id, id] } });
  const zip = await taxApi.post(bff(`library/collections/${col.id}/export`));
  expect(zip.status()).toBe(202);
  expect(await zip.json()).toEqual({ accepted: true, files: 1, viewOnlySkipped: 1, scanPendingSkipped: 0 });
  // The worker zips the normal file only and says so in the notification.
  let ready: { link: string; body: string } | undefined;
  await expect
    .poll(
      async () => {
        const body = await (await taxApi.get(bff('notifications?page=1&pageSize=10'))).json();
        ready = (body.data ?? []).find(
          (x: { type: string; entityId: string }) => x.type === 'library.export_ready' && x.entityId === col.id,
        );
        return Boolean(ready);
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  expect(ready!.body).toContain('1 view-only or unchecked item(s) listed in index.csv');
  const { url } = await (await taxApi.get(ready!.link)).json();
  const bytes = await (await taxApi.get(url)).body();
  // Entry names are stored uncompressed in the ZIP directory.
  expect(bytes.includes(Buffer.from(normal.title))).toBe(true);
  expect(bytes.includes(Buffer.from(title))).toBe(false);

  await saApi.post(bff(`library/collections/${col.id}/archive`));
  await saApi.delete(bff(`library/collections/${col.id}`));
  for (const i of [id, normal.id]) await destroyItem(saApi, i);
  for (const c of [audit.context, tax.context]) await c.close();
  for (const a of [taxApi, auditApi, saApi]) await a.dispose();
});

test('declaration is enforced by the API, not just the UI', async ({ playwright, baseURL }) => {
  const taxApi = await apiAs(playwright, 'tax', baseURL!);
  const cats = await (await taxApi.get(bff('library/categories?page=1&pageSize=100'))).json();
  const res = await taxApi.post(bff('library/items'), { data: { title: 'No declaration', categoryId: cats.data[0].id } });
  expect(res.status()).toBe(400);
  expect(JSON.stringify(await res.json())).toContain('Confirm the upload declaration');
  await taxApi.dispose();
});
