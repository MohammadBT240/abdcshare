import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bff } from '../support/library';
import { apiAs, choose, DEMO_FILES, pageAs, shot } from './support';

type Row = Record<string, unknown> & { id: string };
async function rows(api: { get: (u: string) => Promise<{ json: () => Promise<unknown> }> }, url: string): Promise<Row[]> {
  const body = (await (await api.get(bff(url))).json()) as { data?: Row[]; items?: Row[] } | Row[];
  return Array.isArray(body) ? body : (body.data ?? body.items ?? []);
}

/** Administration screenshots (docs/help/administration), as Ifeoma (Platform Admin). */
test('administration tour', async ({ browser, playwright, baseURL }) => {
  const adminApi = await apiAs(playwright, 'admin', baseURL!);
  const { page, context } = await pageAs(browser, 'admin');

  // ---- users ---------------------------------------------------------------------------------
  await page.goto('/admin/users');
  await expect(page.getByText('Amina Bello').first()).toBeVisible();
  await shot(page, 'administration/users');
  if (!(await rows(adminApi, 'users?q=tobi.ojo')).some((u) => u.email === 'tobi.ojo@demo.test')) {
    await page.getByRole('button', { name: 'Add User' }).click();
    const dlg = page.getByRole('dialog', { name: 'Add user' });
    await dlg.locator('input[name="firstName"]').fill('Tobi');
    await dlg.locator('input[name="surname"]').fill('Ojo');
    await dlg.locator('input[name="email"]').fill('tobi.ojo@demo.test');
    await choose(dlg, 'Select role', 'Staff');
    await dlg.getByRole('combobox').filter({ hasText: 'Optional' }).last().click();
    await page.getByRole('option', { name: /Advisory|Assurance/ }).first().click();
    await shot(dlg, 'administration/add-user');
    await dlg.getByRole('button', { name: 'Create user' }).click();
    await expect(dlg).toBeHidden({ timeout: 20_000 });
  }
  const kemi = (await rows(adminApi, 'users?q=kemi')).find((u) => String(u.email).startsWith('kemi'))!;
  await page.goto(`/admin/users/${kemi.id}`);
  await expect(page.getByText('Role & access').first()).toBeVisible();
  await page.getByText('Role & access').first().scrollIntoViewIfNeeded();
  await shot(page, 'administration/user-role-access');

  // Reset, deactivate and reactivate the demo user.
  const tobi = (await rows(adminApi, 'users?q=tobi.ojo')).find((u) => u.email === 'tobi.ojo@demo.test')!;
  await page.goto(`/admin/users/${tobi.id}`);
  await page.getByRole('button', { name: 'Reset & email password' }).click();
  const reset = page.getByRole('alertdialog');
  await shot(reset, 'administration/reset-password');
  await reset.getByRole('button', { name: 'Reset & email' }).click();
  await expect(reset).toBeHidden();
  await page.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click();
  await expect.poll(async () => (await rows(adminApi, 'users?q=tobi.ojo'))[0]?.isActive).toBe(false);
  await page.reload();
  await choose(page, 'Inactive', 'Active');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(async () => (await rows(adminApi, 'users?q=tobi.ojo'))[0]?.isActive).toBe(true);

  // ---- clients ---------------------------------------------------------------------------------
  await page.goto('/admin/clients');
  await expect(page.getByText('Northwind Foods Ltd').first()).toBeVisible();
  await shot(page, 'administration/clients');
  await page.getByRole('button', { name: 'Add Client' }).click();
  const addClient = page.getByRole('dialog', { name: 'Add client' });
  await choose(addClient, 'Select type', 'Corporate');
  await expect(addClient.getByText('Primary contact').first()).toBeVisible();
  await shot(addClient, 'administration/add-client');
  await page.keyboard.press('Escape');
  const northwind = (await rows(adminApi, 'clients?q=Northwind'))[0]!;
  await page.goto(`/admin/clients/${northwind.id}`);
  await expect(page.getByText('Portal contacts').first()).toBeVisible();
  const contacts = await rows(adminApi, `clients/${northwind.id}/contacts`);
  if (!JSON.stringify(contacts).includes('samuel.eze@demo.test')) {
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const add = page.getByRole('dialog', { name: 'Add contact' });
    await add.getByRole('textbox').nth(0).fill('Samuel');
    await add.getByRole('textbox').nth(1).fill('Eze');
    await add.getByRole('textbox').nth(2).fill('samuel.eze@demo.test');
    await shot(add, 'administration/add-contact');
    await add.getByRole('button', { name: 'Add contact' }).click();
    await expect(add).toBeHidden({ timeout: 20_000 });
  }
  await expect(page.getByText('samuel.eze@demo.test').first()).toBeVisible();
  await page.getByText('Portal contacts').first().scrollIntoViewIfNeeded();
  await shot(page, 'administration/client-contacts');

  // ---- catalogues ------------------------------------------------------------------------------
  for (const [slug, name] of [
    ['engagement-types', 'catalogue-engagement-types'],
    ['request-classes', 'catalogue-request-classes'],
    ['request-statuses', 'catalogue-request-statuses'],
    ['departments', 'catalogue-departments'],
  ] as const) {
    await page.goto(`/admin/catalogues/${slug}`);
    await page.waitForLoadState('networkidle');
    await shot(page, `administration/${name}`);
  }
  await page.goto('/admin/catalogues/engagement-types');
  await page.getByRole('row', { name: /Statutory Audit/ }).getByRole('button', { name: 'Suggested classes' }).click();
  const suggested = page.getByRole('dialog', { name: /Suggested request classes/ });
  await expect(suggested.getByRole('checkbox').first()).toBeVisible();
  await shot(suggested, 'administration/suggested-classes');
  await suggested.getByRole('button', { name: 'Cancel' }).click();

  // ---- company profiles ------------------------------------------------------------------------
  await page.goto('/admin/company-profile');
  if (!JSON.stringify(await rows(adminApi, 'company-profiles?pageSize=50')).includes('Firm capability statement 2026')) {
    await page.getByRole('button').filter({ hasText: /^Upload$/ }).first().click();
    const up = page.getByRole('dialog', { name: 'Upload company profile' });
    await up.getByPlaceholder('e.g. ACA capability statement 2026').fill('Firm capability statement 2026');
    await up.locator('input[type=file]').first().setInputFiles({
      name: 'Firm capability statement 2026.pdf',
      mimeType: 'application/pdf',
      buffer: await readFile(path.join(DEMO_FILES, 'quality-management-manual.pdf')),
    });
    await expect(up.getByText(/Firm capability statement 2026\.pdf/)).toBeVisible();
    await shot(up, 'administration/upload-company-profile');
    await up.getByRole('button', { name: /^Upload$/ }).last().click();
    await expect(up).toBeHidden({ timeout: 30_000 });
  }
  await page.goto('/admin/company-profile');
  await expect(page.getByText('Firm capability statement 2026').first()).toBeVisible();
  await shot(page, 'administration/company-profiles');
  // Opening a card shows the document viewer (not captured: headless Chromium can't render PDFs).
  await page.getByLabel('Open Firm capability statement 2026').click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Download' })).toBeVisible();
  await page.keyboard.press('Escape');

  // ---- activity log and background jobs ----------------------------------------------------------
  await page.waitForLoadState('networkidle');
  await page.goto('/admin/activity').catch(() => page.goto('/admin/activity'));
  await page.waitForLoadState('networkidle');
  await shot(page, 'administration/activity-log');
  await page.getByPlaceholder('Search action, user, entity, IP…').fill('users');
  const created = page.getByRole('row').filter({ hasText: 'Created Users' }).first();
  await expect(created).toBeVisible({ timeout: 15_000 });
  await created.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Details' }).click();
  await expect(page.getByRole('dialog', { name: 'Event details' })).toBeVisible();
  await shot(page.getByRole('dialog', { name: 'Event details' }), 'administration/activity-details');
  await page.keyboard.press('Escape');
  await page.goto('/admin/jobs');
  await expect(page.getByText(/Outbox/).first()).toBeVisible();
  await shot(page, 'administration/background-jobs');

  // ---- help content, with some reader feedback ----------------------------------------------------
  const amina = await apiAs(playwright, 'amina', baseURL!);
  await amina.put(bff('help/articles/library-uploading/feedback'), { data: { helpful: true } });
  await amina.put(bff('help/articles/library-collections/feedback'), { data: { helpful: false, comment: 'How do I share a collection with a client?' } });
  await page.goto('/admin/help');
  await expect(page.getByText('Built-in').first()).toBeVisible();
  await shot(page, 'administration/help-content');
  await page.getByRole('tab', { name: 'Reader feedback' }).click();
  await expect(page.getByTestId('help-feedback-stats')).toBeVisible();
  await shot(page, 'administration/help-feedback');
  await page.goto('/admin/help');
  await page.getByRole('row', { name: /^Collections/ }).getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByLabel('Article body')).toBeVisible();
  await shot(page, 'administration/help-editor');
  await context.close();
});
