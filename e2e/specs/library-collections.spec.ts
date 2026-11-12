import path from 'node:path';
import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { FILES, bff, createItem, departmentId, destroyItem, unique } from '../support/library';

async function destroyCollection(api: import('@playwright/test').APIRequestContext, id: string) {
  await api.post(bff(`library/collections/${id}/archive`));
  await api.delete(bff(`library/collections/${id}`));
}

test.describe('Library collections (S1)', () => {
  const cleanupItems: string[] = [];
  const cleanupCollections: string[] = [];

  test.afterAll(async ({ playwright, baseURL }) => {
    const sa = await apiAs(playwright, 'sa', baseURL!);
    for (const id of cleanupCollections) await destroyCollection(sa, id);
    for (const id of cleanupItems) await destroyItem(sa, id);
    await sa.dispose();
  });

  test('create a training collection, bulk upload into it, reorder, add an existing item, download all', async ({ browser, playwright, baseURL }) => {
    const taxApi = await apiAs(playwright, 'tax', baseURL!);
    const existing = await createItem(taxApi, { title: unique('E2E existing handout') });
    cleanupItems.push(existing.id);

    const { context, page } = await pageAs(browser, 'tax');
    const title = unique('E2E IFRS training');
    await page.goto('/library');
    await page.getByRole('button', { name: 'New collection' }).click();
    const form = page.getByRole('dialog', { name: 'New collection' });
    await form.getByLabel('Title').fill(title);
    await form.getByLabel('Starts').fill('2026-03-10');
    await form.getByLabel('Ends').fill('2026-03-12');
    await form.getByLabel('Facilitator / lead').fill('Deloitte Academy');
    await form.getByLabel('Link').fill('http://not-secure.example');
    await form.getByRole('button', { name: 'Create collection' }).click();
    await expect(form.getByRole('alert')).toContainText('https://');
    await form.getByLabel('Link').fill('https://academy.example.com/ifrs17');
    await form.getByRole('button', { name: 'Create collection' }).click();
    await page.waitForURL(/\/library\/collections\/[0-9a-f-]{36}$/);
    const collectionId = page.url().split('/').pop()!;
    cleanupCollections.push(collectionId);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('10–12 Mar 2026')).toBeVisible();

    // Bulk upload three files into "Day 1".
    await page.getByRole('button', { name: 'Upload files' }).first().click();
    const bulk = page.getByRole('dialog', { name: new RegExp(`Upload files to`) });
    await bulk.locator('input[type=file]').setInputFiles(['sample.pdf', 'sample.docx', 'sample.xlsx'].map((f) => path.join(FILES, f)));
    await expect(bulk.getByRole('list', { name: 'Files to upload' }).getByRole('listitem')).toHaveCount(3);
    await bulk.getByRole('textbox', { name: 'Title for sample.pdf' }).fill('Day 1 slides');
    await bulk.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Training Materials' }).click();
    await bulk.getByLabel('Section').fill('Day 1');
    await bulk.getByRole('checkbox', { name: /no client-identifiable information/ }).check();
    await bulk.getByRole('button', { name: 'Upload 3 files' }).click();
    await expect(bulk).toBeHidden({ timeout: 90_000 });
    await expect(page.getByText('Items · 3')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Day 1' })).toBeVisible();

    // Add an existing item.
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Add existing items' }).click();
    const add = page.getByRole('dialog', { name: 'Add items from the library' });
    await add.getByLabel('Search the library').fill(existing.title);
    await add.getByRole('checkbox').first().check();
    await add.getByRole('button', { name: /Add 1 item/ }).click();
    await expect(page.getByText('Items · 4')).toBeVisible();

    // Reorder: move the last item up one.
    const links = page.locator('section[aria-labelledby="collection-items-heading"] a[href^="/library/"]');
    const before = await links.allInnerTexts();
    await page.getByRole('button', { name: `Move ${before[3]} up` }).click();
    await expect.poll(async () => (await links.allInnerTexts())[2]).toBe(before[3]);

    // The item page shows the membership.
    await links.filter({ hasText: 'Day 1 slides' }).click();
    await expect(page.getByText('Part of')).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
    for (const id of (await taxApi.get(bff(`library/collections/${collectionId}/items`)).then((r) => r.json())).data.map((m: { item: { id: string } }) => m.item.id)) {
      if (!cleanupItems.includes(id)) cleanupItems.push(id);
    }

    // Download all → worker builds the ZIP → notification link resolves to a presigned URL.
    await page.goto(`/library/collections/${collectionId}`);
    await page.getByRole('button', { name: 'Download all' }).click();
    await expect(page.getByText(/Preparing a ZIP of 4 files/)).toBeVisible();
    let link: string | undefined;
    await expect
      .poll(
        async () => {
          const res = await taxApi.get(bff('notifications?page=1&pageSize=10'));
          const body = await res.json();
          const n = (body.data ?? []).find((x: { type: string; entityId: string }) => x.type === 'library.export_ready' && x.entityId === collectionId);
          link = n?.link;
          return Boolean(link);
        },
        { timeout: 60_000 },
      )
      .toBe(true);
    const dl = await taxApi.get(link!);
    expect(dl.ok()).toBe(true);
    const { url } = await dl.json();
    const zip = await taxApi.get(url);
    expect(zip.ok()).toBe(true);
    const bytes = await zip.body();
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    expect(bytes.includes(Buffer.from('index.csv'))).toBe(true);
    expect(bytes.includes(Buffer.from('Day 1/'))).toBe(true);

    await context.close();
    await taxApi.dispose();
  });

  test('restricted collections and hidden-item counts', async ({ browser, playwright, baseURL }) => {
    const sa = await apiAs(playwright, 'sa', baseURL!);
    const tax = await departmentId(sa, 'Tax');
    const taxOnly = await createItem(sa, { title: unique('E2E tax-only memo'), visibility: 'Departments', departmentIds: [tax] });
    const open = await createItem(sa, { title: unique('E2E open memo') });
    cleanupItems.push(taxOnly.id, open.id);

    const restricted = await (
      await sa.post(bff('library/collections'), { data: { title: unique('E2E Tax workshop'), type: 'Workshop', visibility: 'Departments', departmentIds: [tax] } })
    ).json();
    const firm = await (await sa.post(bff('library/collections'), { data: { title: unique('E2E Firm programme'), type: 'Programme' } })).json();
    cleanupCollections.push(restricted.id, firm.id);
    await sa.post(bff(`library/collections/${firm.id}/items`), { data: { itemIds: [taxOnly.id, open.id] } });

    // Audit staff: restricted collection is invisible; firm collection shows 1 item + 1 hidden.
    const audit = await pageAs(browser, 'audit');
    await audit.page.goto('/library?tab=collections');
    await expect(audit.page.getByRole('link', { name: firm.title })).toBeVisible();
    await expect(audit.page.getByRole('link', { name: restricted.title })).toHaveCount(0);
    await audit.page.goto(`/library/collections/${restricted.id}`);
    await expect(audit.page.getByText("This collection doesn't exist or you don't have access to it.")).toBeVisible();
    await audit.page.goto(`/library/collections/${firm.id}`);
    await expect(audit.page.getByText('Items · 1')).toBeVisible();
    await expect(audit.page.getByText("1 more item you don't have access to")).toBeVisible();
    await expect(audit.page.getByRole('link', { name: taxOnly.title })).toHaveCount(0);
    // Not the owner: no edit controls.
    await expect(audit.page.getByRole('button', { name: 'More actions' })).toHaveCount(0);
    await audit.context.close();

    // Tax staff see both items.
    const taxPage = await pageAs(browser, 'tax');
    await taxPage.page.goto(`/library/collections/${firm.id}`);
    await expect(taxPage.page.getByText('Items · 2')).toBeVisible();
    await taxPage.context.close();

    // Deleting a collection keeps its items.
    await sa.post(bff(`library/collections/${firm.id}/archive`));
    expect((await sa.delete(bff(`library/collections/${firm.id}`))).status()).toBe(204);
    expect((await sa.get(bff(`library/items/${open.id}`))).ok()).toBe(true);
    cleanupCollections.splice(cleanupCollections.indexOf(firm.id), 1);
    await sa.dispose();
  });
});
