import { test, expect } from '@playwright/test';
import { pageAs } from '../support/fixtures';

test('platform admin manages library categories', async ({ browser }) => {
  const { context, page } = await pageAs(browser, 'pa');
  const name = `E2E Category ${Date.now().toString(36)}`;
  await page.goto('/admin/catalogues/library-categories');
  await expect(page.getByRole('heading', { name: 'Library categories' })).toBeVisible();
  await page.getByRole('button', { name: 'Add' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add library category' });
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Sort order').fill('99');
  await dialog.getByRole('button', { name: 'Save' }).click();
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: 'Deactivate' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click();
  await expect(row.getByText('Inactive')).toBeVisible();
  await row.getByRole('button', { name: 'Reactivate' }).click();
  await expect(row.getByText('Active')).toBeVisible();

  // Super Admins can read the catalogue but not change it.
  const sa = await pageAs(browser, 'sa');
  await sa.page.goto('/admin/catalogues/library-categories');
  await expect(sa.page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
  await expect(sa.page.getByRole('button', { name: 'Add' })).toHaveCount(0);
  await sa.context.close();

  // Leave it inactive so the rail stays clean for other specs.
  await row.getByRole('button', { name: 'Deactivate' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click();
  await context.close();
});
