import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { bff, createItem, departmentId, destroyItem, unique } from '../support/library';

type Notification = { type: string; title: string; body: string | null; link: string | null };

async function notifications(api: import('@playwright/test').APIRequestContext, type: string): Promise<Notification[]> {
  const res = await (await api.get(bff('notifications?page=1&pageSize=50'))).json();
  return (res.data as Notification[]).filter((n) => n.type === type);
}

test('report → curator notified + queue badge → Restrict → reporter notified and loses access', async ({ browser, playwright, baseURL }) => {
  const audit = await apiAs(playwright, 'audit', baseURL!);
  const taxApi = await apiAs(playwright, 'tax', baseURL!);
  const saApi = await apiAs(playwright, 'sa', baseURL!);
  const item = await createItem(audit, { title: unique('E2E reported item') });

  // Staff report it from the item page.
  const tax = await pageAs(browser, 'tax');
  await tax.page.goto(`/library/${item.id}`);
  await tax.page.getByRole('button', { name: 'More actions' }).click();
  await tax.page.getByRole('menuitem', { name: 'Report a problem' }).click();
  const dialog = tax.page.getByRole('dialog', { name: 'Report a problem' });
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Choose what the problem is');
  await dialog.getByRole('radio', { name: /Client-confidential information/ }).click();
  await dialog.getByLabel('Note').fill('Page 1 names a client');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(tax.page.getByText('Thanks — a library curator will look at it')).toBeVisible();
  // A second report by the same person is refused; the item stays visible meanwhile.
  const again = await taxApi.post(bff(`library/items/${item.id}/reports`), { data: { reason: 'Other', note: 'again' } });
  expect(again.status()).toBe(409);
  expect((await taxApi.get(bff(`library/items/${item.id}`))).status()).toBe(200);

  // Curator: in-app notification, sidebar badge, banner on the item, queue entry.
  const reported = await notifications(saApi, 'library.reported');
  expect(reported.some((n) => n.title.includes(item.title) && n.link === '/library/review')).toBe(true);
  const sa = await pageAs(browser, 'sa');
  await sa.page.goto(`/library/${item.id}`);
  await expect(sa.page.getByText('Someone has reported this item.')).toBeVisible();
  await expect(sa.page.getByTestId('nav-badge-library')).toBeVisible();
  await sa.page.getByRole('link', { name: 'Review', exact: true }).click();
  await sa.page.waitForURL('**/library/review');
  const group = sa.page.getByTestId('report-group').filter({ hasText: item.title });
  await expect(group).toContainText('Client-confidential information');
  await expect(group).toContainText('Page 1 names a client');
  await sa.page.screenshot({ path: 'test-results/library-review-queue.png', fullPage: true });

  // Restrict to Assurance only.
  await group.getByRole('button', { name: 'Restrict' }).click();
  const resolve = sa.page.getByRole('dialog', { name: /^Restrict:/ });
  await resolve.getByRole('button', { name: 'Restrict' }).click();
  await expect(resolve.getByRole('alert')).toHaveText('Choose at least one department');
  await resolve.getByRole('combobox').click();
  await sa.page.getByRole('option', { name: 'Assurance' }).click();
  await sa.page.keyboard.press('Escape');
  await resolve.getByLabel('Note to the reporter').fill('Thanks — limited to Assurance.');
  await resolve.getByRole('button', { name: 'Restrict' }).click();
  await expect(sa.page.getByText(/Restricted to departments — 1 report closed/)).toBeVisible();
  await expect(group).toHaveCount(0);

  // Reporter is told, and can no longer see the item (Tax ≠ Assurance).
  const resolved = await notifications(taxApi, 'library.report_resolved');
  expect(resolved.some((n) => n.title.includes(item.title) && (n.body ?? '').includes('limited to Assurance'))).toBe(true);
  expect((await taxApi.get(bff(`library/items/${item.id}`))).status()).toBe(404);
  const got = await (await saApi.get(bff(`library/items/${item.id}`))).json();
  expect(got.visibility).toBe('Departments');
  expect(got.departments.map((d: { id: number }) => d.id)).toEqual([await departmentId(saApi, 'Assurance')]);

  // The Actioned tab keeps the history.
  await sa.page.getByRole('tab', { name: 'Actioned' }).click();
  await expect(sa.page.getByTestId('report-group').filter({ hasText: item.title })).toContainText('Restricted to departments');

  await destroyItem(saApi, item.id);
  for (const c of [tax.context, sa.context]) await c.close();
  for (const a of [audit, taxApi, saApi]) await a.dispose();
});

test('staff cannot open the review queue or resolve reports', async ({ browser, playwright, baseURL }) => {
  const taxApi = await apiAs(playwright, 'tax', baseURL!);
  expect((await taxApi.get(bff('library/reports'))).status()).toBe(403);
  expect(await (await taxApi.get(bff('library/reports/count'))).json()).toEqual({ open: 0 });
  const { context, page } = await pageAs(browser, 'tax');
  await page.goto('/library/review');
  await expect(page.getByText('Review queue')).toHaveCount(0);
  await context.close();
  await taxApi.dispose();
});

test('Delete outcome removes the item; the reporter is told', async ({ playwright, baseURL }) => {
  const audit = await apiAs(playwright, 'audit', baseURL!);
  const taxApi = await apiAs(playwright, 'tax', baseURL!);
  const saApi = await apiAs(playwright, 'sa', baseURL!);
  const item = await createItem(audit, { title: unique('E2E delete via report') });
  const report = await (await taxApi.post(bff(`library/items/${item.id}/reports`), { data: { reason: 'Copyright' } })).json();
  const res = await saApi.post(bff(`library/reports/${report.id}/resolve`), { data: { outcome: 'Delete', note: 'Not ours to share' } });
  expect(await res.json()).toEqual({ resolved: 1, outcome: 'Delete' });
  expect((await saApi.get(bff(`library/items/${item.id}`))).status()).toBe(404);
  const resolved = await notifications(taxApi, 'library.report_resolved');
  expect(resolved.some((n) => n.title.includes(item.title) && n.link === '/library')).toBe(true);
  for (const a of [audit, taxApi, saApi]) await a.dispose();
});
