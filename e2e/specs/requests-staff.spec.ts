import { expect, test } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { bff } from '../support/library';

type Row = Record<string, unknown> & { id: string };
type Api = Awaited<ReturnType<typeof apiAs>>;
async function rows(api: Api, path: string): Promise<Row[]> {
  const res = await api.get(bff(path));
  expect(res.ok(), `${path} → ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { data?: Row[] } | Row[];
  return Array.isArray(body) ? body : (body.data ?? []);
}
async function userId(api: Api, email: string): Promise<string> {
  return (await rows(api, `users?q=${encodeURIComponent(email)}&pageSize=10`)).find((u) => u.email === email)!.id;
}

/**
 * Staff on an engagement's team edit requests, set their status and assign them — in the UI, one at a
 * time and in bulk. Only team members can be assigned, and only Super Admins can delete a request.
 */
test('staff manage requests on their engagements; only Super Admins delete', async ({ browser, playwright, baseURL }) => {
  const sa = await apiAs(playwright, 'sa', baseURL!);
  const tax = await apiAs(playwright, 'tax', baseURL!);

  // ---- an engagement with Tunde (Staff, Tax) on the team ------------------------------------------
  const client = (await rows(sa, 'clients?q=E2E%20Test%20Client&pageSize=10'))[0]!;
  const contactId = (await rows(sa, `clients/${client.id}/contacts`)).find((c) => c.email === 'client@e2e.test')!.id;
  const taxId = await userId(sa, 'tax@e2e.test');
  const auditId = await userId(sa, 'audit@e2e.test');
  const type = (await rows(sa, 'engagement-types?page=1&pageSize=100'))[0]!;
  const dept = (await rows(sa, 'departments?page=1&pageSize=100')).find((d) => d.name === 'Tax')!;
  const rtype = (await rows(sa, 'request-types?page=1&pageSize=100&isActive=true'))[0]!;
  const run = Date.now().toString(36); // descriptions stay unique across runs on the same database
  const title = `E2E staff requests ${run}`;
  const created = await sa.post(bff('engagements'), {
    data: {
      clientId: client.id,
      engagementTypeId: type.id,
      departmentId: dept.id,
      title,
      periodLabel: 'FY 2026',
      requestClassIds: [rtype.requestClassId],
      clientContactUserIds: [contactId],
      mainClientContactUserId: contactId,
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const engagementId = ((await created.json()) as Row).id;
  expect((await sa.post(bff(`engagements/${engagementId}/team`), { data: { userId: taxId } })).ok()).toBeTruthy();

  const mk = async (description: string) => {
    const res = await sa.post(bff('requests'), {
      data: { engagementId, requestTypeId: rtype.id, description, expectedDocumentCount: 1 },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    return ((await res.json()) as Row).id;
  };
  const r1 = await mk(`Staff-managed request one ${run}`);
  const r2 = await mk(`Staff-managed request two ${run}`);
  const statuses = await rows(tax, 'request-statuses?page=1&pageSize=100&isActive=true'); // Staff can read these now
  const statusOf = async (id: string) => ((await (await tax.get(bff(`requests/${id}`))).json()) as Row).statusName;

  // ---- Tunde, in the UI: change status, assign, edit; no Delete ---------------------------------
  const { page, context } = await pageAs(browser, 'tax');
  await page.goto(`/requests/${r1}`);
  await expect(page.getByText(`Staff-managed request one ${run}`).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Change status' }).click();
  const statusDlg = page.getByRole('dialog', { name: 'Change status' });
  await statusDlg.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Pending Client' }).click();
  await statusDlg.getByRole('button', { name: 'Save' }).click();
  await expect(statusDlg).toBeHidden();
  await expect.poll(() => statusOf(r1)).toBe('Pending Client');

  await page.getByRole('button', { name: /Assignees|Manage/ }).first().click();
  const assignDlg = page.getByRole('dialog', { name: 'Manage assignees' });
  await assignDlg.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Tunde Tax/ }).first().click();
  await page.keyboard.press('Escape');
  await assignDlg.getByRole('button', { name: 'Save' }).click();
  await expect(assignDlg).toBeHidden();
  await expect
    .poll(async () => JSON.stringify(await (await tax.get(bff(`requests/${r1}`))).json()))
    .toContain(taxId);

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editDlg = page.getByRole('dialog');
  await editDlg.getByRole('textbox').first().fill(`Staff-managed request one ${run} — edited`);
  await editDlg.getByRole('button', { name: 'Save' }).click();
  await expect(editDlg).toBeHidden();
  await expect(page.getByText(`Staff-managed request one ${run} — edited`).first()).toBeVisible();

  // ---- the API keeps the rules --------------------------------------------------------------------
  const outsider = await tax.post(bff(`requests/${r2}/assignees`), { data: { userId: auditId } });
  expect(outsider.status()).toBe(400);
  expect(await outsider.text()).toContain("isn't on the engagement team");
  expect((await tax.delete(bff(`requests/${r2}`))).status()).toBe(403);
  const assignable = await rows(tax, 'requests/assignable-users');
  expect(assignable.map((u) => u.id)).toContain(taxId);
  expect(assignable.map((u) => u.id)).not.toContain(auditId);

  // ---- bulk: Tunde sets both requests to Accepted from the Requests page --------------------------
  await page.goto(`/requests?q=${encodeURIComponent(run)}`);
  for (const text of [`Staff-managed request one ${run} — edited`, `Staff-managed request two ${run}`]) {
    await page.getByRole('row').filter({ hasText: text }).getByRole('checkbox').check();
  }
  await page.getByRole('combobox').filter({ hasText: 'Set status' }).click();
  await page.getByRole('option', { name: 'Accepted', exact: true }).click();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect.poll(() => statusOf(r2)).toBe('Accepted');
  expect(await statusOf(r1)).toBe('Accepted');
  void statuses;

  // ---- a Super Admin can delete -------------------------------------------------------------------
  expect((await sa.delete(bff(`requests/${r2}`))).ok()).toBeTruthy();
  await context.close();
});
