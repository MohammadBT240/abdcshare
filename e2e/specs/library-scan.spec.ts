import path from 'node:path';
import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { FILES, bff, createItem, departmentId, destroyItem, unique, waitForScan } from '../support/library';

// The EICAR antivirus test file, assembled at run time so no file in the repo trips a scanner.
const EICAR = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$' + 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

type Note = { type: string; title: string; link: string | null; entityId: string | null };
const notes = async (api: import('@playwright/test').APIRequestContext) =>
  ((await (await api.get(bff('notifications?page=1&pageSize=50'))).json()).data as Note[]).filter(
    (n) => n.type === 'library.quarantined',
  );

test('EICAR upload → quarantined: hidden from the uploader, curators + uploader notified, no file handed out', async ({
  browser,
  playwright,
  baseURL,
}) => {
  const tax = await apiAs(playwright, 'tax', baseURL!);
  const sa = await apiAs(playwright, 'sa', baseURL!);
  const item = await createItem(tax, { title: unique('E2E eicar'), file: 'eicar.txt', body: EICAR });
  // From the uploader's side the item has vanished.
  expect(await waitForScan(tax, item.id)).toBe('hidden');

  const got = await (await sa.get(bff(`library/items/${item.id}`))).json();
  expect(got).toMatchObject({ status: 'Quarantined', scanStatus: 'Infected', canDownload: false, canDelete: true });
  expect((await sa.get(bff(`library/items/${item.id}/download`))).status()).toBe(403);
  expect(await (await sa.get(bff(`library/items/${item.id}/preview`))).json()).toMatchObject({ url: null, reason: 'quarantined' });

  await expect.poll(async () => (await notes(tax)).some((n) => n.entityId === item.id)).toBe(true);
  await expect.poll(async () => (await notes(sa)).some((n) => n.entityId === item.id && n.link?.includes('attention'))).toBe(true);

  // Curator view: banner on the item and listed under Needs attention.
  const { context, page } = await pageAs(browser, 'sa');
  await page.goto(`/library/${item.id}`);
  await expect(page.getByText('Quarantined: the virus scan found a threat in this file.')).toBeVisible();
  await expect(page.getByText('Quarantined — the virus scan found a threat')).toBeVisible();
  await page.goto('/library/review?tab=attention');
  await expect(page.getByTestId('attention-quarantined')).toContainText(item.title);
  await expect(page.getByTestId('attention-quarantined')).toContainText('Eicar');
  await page.screenshot({ path: 'test-results/library-attention.png', fullPage: true });

  // Curators can delete it outright.
  expect((await sa.delete(bff(`library/items/${item.id}`))).status()).toBe(204);
  await context.close();
  await tax.dispose();
  await sa.dispose();
});

test('downloads wait for a clean scan; the same file uploaded again is flagged as a duplicate', async ({
  browser,
  playwright,
  baseURL,
}) => {
  const audit = await apiAs(playwright, 'audit', baseURL!);
  const sa = await apiAs(playwright, 'sa', baseURL!);
  const first = await createItem(audit, { title: unique('E2E original png'), file: 'sample.png' });
  const clean = await (await audit.get(bff(`library/items/${first.id}`))).json();
  expect(clean).toMatchObject({ scanStatus: 'Clean', canDownload: true });
  expect(clean.contentHash).toMatch(/^[0-9a-f]{64}$/);

  const { context, page } = await pageAs(browser, 'tax');
  await page.goto('/library');
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.getByRole('menuitem', { name: 'One file' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add to the library' });
  await dialog.locator('input[type=file]').setInputFiles(path.join(FILES, 'sample.png'));
  await expect(dialog.getByTestId('duplicate-warning')).toContainText(first.title);
  await expect(dialog.getByTestId('duplicate-warning').getByRole('link', { name: first.title })).toHaveAttribute(
    'href',
    `/library/${first.id}`,
  );
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  // A brand-new file isn't flagged.
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.getByRole('menuitem', { name: 'One file' }).click();
  await dialog.locator('input[type=file]').setInputFiles({ name: 'fresh.txt', mimeType: 'text/plain', buffer: Buffer.from(unique('fresh')) });
  await expect(dialog.getByText('Checking whether this file is already in the library')).toBeHidden();
  await expect(dialog.getByTestId('duplicate-warning')).toHaveCount(0);
  await context.close();

  // Staff can't learn about duplicates they can't see: restrict it to Assurance; Tax staff get nothing.
  const tax = await apiAs(playwright, 'tax', baseURL!);
  const dup = (api: typeof tax) => api.get(bff(`library/items/duplicates?hash=${clean.contentHash}`)).then((r) => r.json());
  expect((await dup(tax)).map((d: { id: string }) => d.id)).toContain(first.id);
  await audit.patch(bff(`library/items/${first.id}`), {
    data: { visibility: 'Departments', departmentIds: [await departmentId(sa, 'Assurance')] },
  });
  expect((await dup(tax)).map((d: { id: string }) => d.id)).not.toContain(first.id);
  expect((await dup(audit)).map((d: { id: string }) => d.id)).toContain(first.id);
  await destroyItem(sa, first.id);
  for (const a of [audit, sa, tax]) await a.dispose();
});

test('password-protected files get a specific message (Word via the worker, PDF via PDF.js)', async ({
  browser,
  playwright,
  baseURL,
}) => {
  const audit = await apiAs(playwright, 'audit', baseURL!);
  const sa = await apiAs(playwright, 'sa', baseURL!);
  const docx = await createItem(audit, { title: unique('E2E locked docx'), file: 'protected.docx' });
  const pdf = await createItem(audit, { title: unique('E2E locked pdf'), file: 'protected.pdf' });
  const { context, page } = await pageAs(browser, 'tax');
  await page.goto(`/library/${docx.id}`);
  await expect(page.getByTestId('preview-failure')).toHaveText('This file is password-protected', { timeout: 60_000 });
  await page.goto(`/library/${pdf.id}`);
  await expect(page.getByText('This PDF is password-protected')).toBeVisible({ timeout: 20_000 });

  // Curators see it under Needs attention → Previews that failed.
  const cur = await pageAs(browser, 'sa');
  await cur.page.goto('/library/review?tab=attention');
  await expect(cur.page.getByTestId('attention-previews')).toContainText(docx.title);
  await expect(cur.page.getByTestId('attention-previews')).toContainText('Password-protected');
  for (const id of [docx.id, pdf.id]) await destroyItem(sa, id);
  for (const c of [context, cur.context]) await c.close();
  for (const a of [audit, sa]) await a.dispose();
});

test('deactivating a department warns about restricted items, which then need attention', async ({
  browser,
  playwright,
  baseURL,
}) => {
  const pa = await apiAs(playwright, 'pa', baseURL!);
  const sa = await apiAs(playwright, 'sa', baseURL!);
  const name = unique('E2E Dept');
  const dept = await (await pa.post(bff('departments'), { data: { name } })).json();
  const item = await createItem(sa, { title: unique('E2E dept-only item'), visibility: 'Departments', departmentIds: [dept.id] });

  const { context, page } = await pageAs(browser, 'pa');
  await page.goto(`/admin/catalogues/departments?q=${encodeURIComponent(name)}`);
  await page.getByRole('row', { name: new RegExp(name) }).getByRole('button', { name: 'Deactivate' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByTestId('department-library-impact')).toContainText('1 library item is restricted to this department only');
  await confirm.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText('Deactivated')).toBeVisible();

  await page.goto('/library/review?tab=attention');
  await expect(page.getByTestId('attention-orphaned')).toContainText(item.title);
  await expect(page.getByTestId('attention-orphaned')).toContainText(name);
  await destroyItem(sa, item.id);
  await context.close();
  for (const a of [pa, sa]) await a.dispose();
});

test('a curator transfers ownership; the new owner can edit and the move is logged', async ({ browser, playwright, baseURL }) => {
  const audit = await apiAs(playwright, 'audit', baseURL!);
  const tax = await apiAs(playwright, 'tax', baseURL!);
  const sa = await apiAs(playwright, 'sa', baseURL!);
  const item = await createItem(audit, { title: unique('E2E transfer me') });
  expect((await (await tax.get(bff(`library/items/${item.id}`))).json()).canEdit).toBe(false);

  const { context, page } = await pageAs(browser, 'sa');
  await page.goto(`/library/${item.id}`);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Transfer ownership' }).click();
  const dialog = page.getByRole('dialog', { name: 'Transfer ownership' });
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: /Tunde Tax/ }).click();
  await dialog.getByRole('button', { name: 'Transfer' }).click();
  await expect(page.getByText('Transferred 1 item')).toBeVisible();
  await expect(page.getByText('Tunde Tax').first()).toBeVisible();

  expect((await (await tax.get(bff(`library/items/${item.id}`))).json()).canEdit).toBe(true);
  const events = await (await tax.get(bff(`library/items/${item.id}/events`))).json();
  const moved = events.data.find((e: { action: string }) => e.action === 'OwnershipTransferred');
  expect(moved).toMatchObject({ actor: { name: 'Sade Super' }, metadata: { from: { name: 'Amaka Audit' }, to: { name: 'Tunde Tax' } } });
  expect((await tax.post(bff(`library/admin/items/${item.id}/transfer`), { data: { userId: moved.actor.id } })).status()).toBe(403);
  await destroyItem(sa, item.id);
  await context.close();
  for (const a of [audit, tax, sa]) await a.dispose();
});

test('header search finds library items within the viewer’s access', async ({ browser, playwright, baseURL }) => {
  const sa = await apiAs(playwright, 'sa', baseURL!);
  const audit = await apiAs(playwright, 'audit', baseURL!);
  const word = `zebra${Date.now().toString(36)}`;
  const open = await createItem(audit, { title: `E2E ${word} firm-wide` });
  const assurance = (await (await sa.get(bff('departments?page=1&pageSize=100'))).json()).data.find(
    (d: { name: string }) => d.name === 'Assurance',
  ).id;
  const secret = await createItem(audit, { title: `E2E ${word} assurance only`, visibility: 'Departments', departmentIds: [assurance] });

  const { context, page } = await pageAs(browser, 'tax');
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Search' }).click();
  const search = page.getByRole('dialog', { name: 'Search' });
  await search.getByPlaceholder(/Search engagements/).fill(word);
  await expect(search.getByRole('option', { name: new RegExp(`${word} firm-wide`) })).toBeVisible();
  await expect(search.getByRole('option', { name: new RegExp(`${word} assurance only`) })).toHaveCount(0);
  await search.getByRole('option', { name: new RegExp(`${word} firm-wide`) }).click();
  await page.waitForURL(`**/library/${open.id}`);
  // Keyboard shortcut once the app is interactive.
  await expect(page.getByRole('heading', { name: open.title })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(search).toBeVisible();
  await page.screenshot({ path: 'test-results/global-search.png' });
  await context.close();

  const auditSearch = await (await audit.get(bff(`search?q=${word}`))).json();
  expect(auditSearch.library.map((h: { id: string }) => h.id).sort()).toEqual([open.id, secret.id].sort());
  for (const id of [open.id, secret.id]) await destroyItem(sa, id);
  for (const a of [sa, audit]) await a.dispose();
});
