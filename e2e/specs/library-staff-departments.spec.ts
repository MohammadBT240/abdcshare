import { expect, pageAs, test } from '../support/fixtures';

/**
 * Staff restrict items to departments, but can't list /departments (catalogue:view) — the
 * Library's pickers use /library/departments instead (found while writing the Help Center).
 */
test('staff can choose departments when restricting an upload', async ({ browser }) => {
  const { context, page } = await pageAs(browser, 'tax');
  const denied: string[] = [];
  page.on('response', (r) => r.status() === 403 && denied.push(r.url()));
  await page.goto('/library');
  await expect(page.getByRole('combobox').filter({ hasText: 'All departments' })).toBeVisible();
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.getByRole('menuitem', { name: 'One file' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add to the library' });
  await dialog.getByText('Specific departments').click();
  await dialog.getByText('Choose departments').click();
  await expect(page.getByRole('option', { name: 'Tax' })).toBeVisible();
  expect(denied).toEqual([]);
  await context.close();
});
