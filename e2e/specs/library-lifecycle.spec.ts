import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { bff, createItem, unique } from '../support/library';

test('uploader archives and restores; curator deletes an archived item', async ({ browser, playwright, baseURL }) => {
  const taxApi = await apiAs(playwright, 'tax', baseURL!);
  const item = await createItem(taxApi, { title: unique('E2E lifecycle item') });

  // Uploader: archive → appears under Archived → restore.
  const tax = await pageAs(browser, 'tax');
  await tax.page.goto(`/library/${item.id}`);
  await tax.page.getByRole('button', { name: 'More actions' }).click();
  await tax.page.getByRole('menuitem', { name: 'Archive' }).click();
  await tax.page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
  await expect(tax.page.getByText(/Archived .* hidden from the library/)).toBeVisible();

  await tax.page.goto('/library?scope=archived&view=table');
  await expect(tax.page.getByRole('link', { name: item.title })).toBeVisible();

  await tax.page.goto(`/library/${item.id}`);
  await tax.page.getByRole('button', { name: 'More actions' }).click();
  await tax.page.getByRole('menuitem', { name: 'Restore' }).click();
  await expect(tax.page.getByText(/hidden from the library/)).toHaveCount(0);
  // Staff can't delete, even their own items.
  await tax.page.getByRole('button', { name: 'More actions' }).click();
  await expect(tax.page.getByRole('menuitem', { name: 'Delete permanently' })).toHaveCount(0);
  await tax.page.keyboard.press('Escape');
  expect((await taxApi.delete(bff(`library/items/${item.id}`))).status()).toBe(403);

  // Re-archive, then a curator deletes it permanently.
  await taxApi.post(bff(`library/items/${item.id}/archive`));
  const sa = await pageAs(browser, 'sa');
  await sa.page.goto(`/library/${item.id}`);
  await sa.page.getByRole('button', { name: 'More actions' }).click();
  await sa.page.getByRole('menuitem', { name: 'Delete permanently' }).click();
  await sa.page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await sa.page.waitForURL('**/library?scope=archived');
  expect((await taxApi.get(bff(`library/items/${item.id}`))).status()).toBe(404);

  await tax.context.close();
  await sa.context.close();
  await taxApi.dispose();
});

test("staff can't edit someone else's item, but can edit their own", async ({ browser, playwright, baseURL }) => {
  const saApi = await apiAs(playwright, 'sa', baseURL!);
  const theirs = await createItem(saApi, { title: unique('E2E curator item') });
  const { context, page } = await pageAs(browser, 'tax');
  await page.goto(`/library/${theirs.id}`);
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
  // Staff may add any visible item to their own collection, but get no edit actions.
  await page.getByRole('button', { name: 'More actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Add to collection' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Edit details' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Archive' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  const taxApi = await apiAs(playwright, 'tax', baseURL!);
  const mine = await createItem(taxApi, { title: unique('E2E my item') });
  await page.goto(`/library/${mine.id}`);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit details' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit details' });
  const newTitle = `${mine.title} (edited)`;
  await dialog.getByLabel('Title').fill(newTitle);
  await dialog.getByRole('radio', { name: /Specific departments/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('Choose at least one department')).toBeVisible();
  await dialog.getByRole('radio', { name: /Everyone in the firm/ }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: newTitle })).toBeVisible();

  for (const id of [theirs.id, mine.id]) {
    await saApi.post(bff(`library/items/${id}/archive`));
    await saApi.delete(bff(`library/items/${id}`));
  }
  await context.close();
  await saApi.dispose();
  await taxApi.dispose();
});
