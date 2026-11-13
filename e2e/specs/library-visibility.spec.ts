import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { bff, createItem, departmentId, destroyItem, unique } from '../support/library';

test.describe('Library visibility matrix', () => {
  const titles = { firm: unique('E2E Firm memo'), tax: unique('E2E Tax-only circular'), audit: unique('E2E Audit-only guide') };
  const ids: string[] = [];

  test.beforeAll(async ({ playwright, baseURL }) => {
    const sa = await apiAs(playwright, 'sa', baseURL!);
    const tax = await departmentId(sa, 'Tax');
    const assurance = await departmentId(sa, 'Assurance');
    ids.push((await createItem(sa, { title: titles.firm })).id);
    ids.push((await createItem(sa, { title: titles.tax, visibility: 'Departments', departmentIds: [tax] })).id);
    ids.push((await createItem(sa, { title: titles.audit, visibility: 'Departments', departmentIds: [assurance] })).id);
    await sa.dispose();
  });

  test.afterAll(async ({ playwright, baseURL }) => {
    const sa = await apiAs(playwright, 'sa', baseURL!);
    for (const id of ids) await destroyItem(sa, id);
    await sa.dispose();
  });

  const cases = [
    { who: 'tax', sees: ['firm', 'tax'], hidden: ['audit'] },
    { who: 'audit', sees: ['firm', 'audit'], hidden: ['tax'] },
    { who: 'nodept', sees: ['firm'], hidden: ['tax', 'audit'] },
    { who: 'sa', sees: ['firm', 'tax', 'audit'], hidden: [] },
  ] as const;

  for (const c of cases) {
    test(`${c.who} sees ${c.sees.join(' + ')}`, async ({ browser }) => {
      const { context, page } = await pageAs(browser, c.who);
      await page.goto('/library?view=table&pageSize=100');
      await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();
      for (const k of c.sees) await expect(page.getByRole('link', { name: titles[k] })).toBeVisible();
      for (const k of c.hidden) await expect(page.getByRole('link', { name: titles[k] })).toHaveCount(0);
      await context.close();
    });
  }

  test('a hidden item 404s by direct URL', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'audit');
    await page.goto(`/library/${ids[1]}`);
    await expect(page.getByText("This item doesn't exist or you don't have access to it.")).toBeVisible();
    await context.close();
  });

  test('clients have no library: no sidebar entry, redirected, API forbidden', async ({ browser, playwright, baseURL }) => {
    const { context, page } = await pageAs(browser, 'client');
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Library' })).toHaveCount(0);
    await page.goto('/library');
    await page.waitForURL('**/dashboard');
    await context.close();
    const client = await apiAs(playwright, 'client', baseURL!);
    expect((await client.get(bff('library/items'))).status()).toBe(403);
    await client.dispose();
  });
});
