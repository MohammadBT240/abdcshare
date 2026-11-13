import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bff } from '../support/library';
import { apiAs, choose, combo, DEMO_FILES, pageAs, shot } from './support';

/**
 * Engagements, requests, client submissions, documents and final reports (docs/help/engagements,
 * requests, documents, clients). Chidi (Super Admin) runs a statutory audit for Northwind Foods,
 * with Amina (Staff) on the team and Grace Eze as the client contact.
 */
test('engagement tour', async ({ browser, playwright, baseURL }) => {
  const chidiApi = await apiAs(playwright, 'manager', baseURL!);
  const existing = (await (await chidiApi.get(bff('engagements?page=1&pageSize=50'))).json()).data as { id: string; title: string }[];
  let engagementId = existing.find((e) => e.title === 'Statutory Audit FY2026')?.id;

  const sa = await pageAs(browser, 'manager');
  const page = sa.page;

  // ---- create the engagement (UI) ------------------------------------------------------------
  await page.goto('/engagements');
  await expect(page.getByRole('button', { name: 'Create engagement' })).toBeVisible();
  if (!engagementId) {
    await page.getByRole('button', { name: 'Create engagement' }).click();
    const dlg = page.getByRole('dialog', { name: 'Create engagement' });
    await combo(dlg, 'Search or create client', 'Northwind', 'Northwind Foods Ltd');
    // The client's primary contact is pre-selected as main contact, with email on.
    await expect(dlg.getByRole('checkbox', { name: 'Grace Eze' })).toBeChecked();
    await combo(dlg, 'Search or create type', 'Statutory', 'Statutory Audit');
    await choose(dlg, 'Select department', 'Assurance');
    await dlg.getByPlaceholder('e.g. Statutory Audit 2024').fill('Statutory Audit FY2026');
    await dlg.getByPlaceholder('e.g. FY 2024').fill('FY 2026');
    for (const c of ['Cash and cash equivalents', 'Accounts receivable', 'Revenue', 'Property, plant & equipment']) {
      await dlg.getByText(c, { exact: true }).click();
    }
    await shot(dlg, 'engagements/create-dialog');
    await dlg.getByRole('button', { name: 'Create engagement' }).click();
    await expect(dlg).toBeHidden({ timeout: 30_000 });
    const list = (await (await chidiApi.get(bff('engagements?page=1&pageSize=50'))).json()).data as { id: string; title: string }[];
    engagementId = list.find((e) => e.title === 'Statutory Audit FY2026')!.id;
  }
  await page.goto('/engagements');
  await expect(page.getByText('Statutory Audit FY2026').first()).toBeVisible();
  await shot(page, 'engagements/list');

  await page.goto(`/engagements/${engagementId}`);
  await expect(page.getByText('Statutory Audit FY2026').first()).toBeVisible();
  await shot(page, 'engagements/workspace-overview');

  // ---- team (Settings tab) -------------------------------------------------------------------
  await page.goto(`/engagements/${engagementId}?tab=settings`);
  const teamCard = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Team' }) }).last();
  const ws = await (await chidiApi.get(bff(`engagements/${engagementId}/workspace`))).json();
  if (!JSON.stringify(ws).includes('Amina Bello')) {
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    const add = page.getByRole('dialog', { name: 'Add team members' });
    await add.getByRole('combobox').first().click();
    await page.locator('[cmdk-input]').last().fill('Amina');
    await page.getByRole('option', { name: /Amina Bello/ }).first().click();
    await page.keyboard.press('Escape');
    await shot(add, 'engagements/add-team');
    await add.getByRole('button', { name: /^Add/ }).last().click();
    await expect(add).toBeHidden();
  }
  await expect(page.getByText('Amina Bello').first()).toBeVisible();
  await shot(page, 'engagements/settings-tab');
  void teamCard;

  // ---- planning document (Overview) ----------------------------------------------------------
  await page.goto(`/engagements/${engagementId}?tab=overview`);
  const pack = page.getByRole('button', { name: /^Planning pack/ });
  await expect(pack).toBeVisible();
  // The pack is collapsed once the engagement leaves Planning.
  if (!(await page.getByText('Planning documents').count())) await pack.click();
  await expect(page.getByText('Planning documents').first()).toBeVisible();
  if (!(await page.getByText('Engagement letter FY2026').count())) {
    await page.getByRole('button', { name: 'Upload', exact: true }).first().click();
    const up = page.getByRole('dialog', { name: 'Upload planning document' });
    await up.getByPlaceholder('e.g. Engagement letter').fill('Engagement letter FY2026');
    await up.locator('input[type=file]').setInputFiles(path.join(DEMO_FILES, 'engagement-letter-template.docx'));
    await shot(up, 'engagements/planning-upload');
    await up.getByRole('button', { name: /^Upload$/ }).last().click();
    await expect(up).toBeHidden({ timeout: 30_000 });
  }
  await expect(page.getByText('Engagement letter FY2026').first()).toBeVisible();
  await shot(page.getByRole('heading', { name: /^Planning pack/ }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]'), 'engagements/planning-pack');

  // ---- advance to Execution ---------------------------------------------------------------------
  if (await page.getByRole('button', { name: 'Advance to Execution' }).count()) {
    await page.getByRole('button', { name: 'Advance to Execution' }).click();
    const tr = page.getByRole('dialog', { name: 'Transition engagement' });
    await tr.getByPlaceholder('Add a note about this transition...').fill('Planning agreed with the client; fieldwork starts Monday.');
    await shot(tr, 'engagements/transition');
    await tr.getByRole('button', { name: /Execution|Transition|Confirm/ }).last().click();
    await expect(tr).toBeHidden();
  }

  // ---- requests -------------------------------------------------------------------------------
  const team = (await (await chidiApi.get(bff(`engagements/${engagementId}`))).json()) as { team?: { userId: string; fullName: string }[] };
  const aminaId = (team.team ?? []).find((m) => m.fullName === 'Amina Bello')?.userId;
  const reqs = async () =>
    ((await (await chidiApi.get(bff(`requests?engagementId=${engagementId}&page=1&pageSize=100`))).json()).data ?? []) as {
      id: string;
      requestTypeName?: string;
      requestType?: { name: string };
    }[];
  const typeName = (r: { requestTypeName?: string; requestType?: { name: string } }) => r.requestTypeName ?? r.requestType?.name ?? '';
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const planned: [number, string, number, number][] = [
    // [requestTypeId, description, due in days, expected documents]
    [73, 'All bank statements for January–December 2026, every account.', 10, 4],
    [75, 'Month-end bank reconciliations for every account, signed by the preparer.', 12, 2],
    [79, 'Trade receivables listing at 31 December 2026, agreeing to the ledger.', 7, 1],
    [82, 'Ageing analysis of receivables at year end.', -2, 1],
    [93, 'Fixed asset register with additions and disposals for the year.', 14, 1],
    [126, 'Monthly postpaid billing schedule for the year.', 5, 1],
  ];
  const have = new Set((await reqs()).map(typeName));
  const typeNames: Record<number, string> = {
    73: 'All Bank Statements',
    75: 'Bank reconciliation statements (All banks)',
    79: 'Schedule of trade receivable',
    82: 'Receivable ageing analysis',
    93: 'Asset Register',
    126: 'Schedule of Postpaid billing',
  };
  for (const [typeId, description, due, expected] of planned) {
    if (have.has(typeNames[typeId]!)) continue;
    const res = await chidiApi.post(bff('requests'), {
      data: { engagementId, requestTypeId: typeId, description, dueDate: day(due), expectedDocumentCount: expected, assigneeIds: aminaId ? [aminaId] : [] },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  }

  // Amina raises one herself, through the dialog.
  const staff = await pageAs(browser, 'amina');
  const sp = staff.page;
  await sp.goto(`/engagements/${engagementId}?tab=requests`);
  if (!have.has('Bank Confirmations requests for 31 December 2024')) {
    await sp.getByRole('button', { name: 'Create request' }).first().click();
    const cr = sp.getByRole('dialog', { name: 'Create request' });
    await choose(cr, 'Select class', 'Cash and cash equivalents');
    await combo(cr, 'Search or create type', 'Bank Confirmations', /Bank Confirmations requests/);
    await shot(cr, 'requests/create-dialog-top');
    await cr.getByPlaceholder('Optional additional details...').fill('Signed bank confirmation letters for every bank the company used in 2026.');
    await cr.getByRole('combobox').filter({ hasText: 'Search and select assignees…' }).click();
    await sp.getByRole('option', { name: /Amina Bello/ }).first().click();
    await sp.keyboard.press('Escape');
    await shot(cr, 'requests/create-dialog');
    await cr.getByRole('button', { name: 'Create request' }).click();
    await expect(cr).toBeHidden({ timeout: 30_000 });
  }
  await sp.reload();
  await expect(sp.getByText('Receivable ageing analysis').first()).toBeVisible();
  await shot(sp, 'requests/engagement-requests-tab');
  await sp.goto('/requests');
  await expect(sp.getByText('Receivable ageing analysis').first()).toBeVisible();
  await shot(sp, 'requests/requests-page');


  // ---- send requests to the client: status "Pending Client" ------------------------------------
  const all = await reqs();
  const idOf = (name: string) => all.find((r) => typeName(r) === name)!.id;
  const statementsId = idOf('All Bank Statements');
  await sp.goto(`/requests/${statementsId}`);
  await expect(sp.getByText('All Bank Statements').first()).toBeVisible();
  await shot(sp, 'requests/request-overview');
  const detail = await (await chidiApi.get(bff(`requests/${statementsId}`))).json();
  // Edit, Change status and assignees (Super Admins) sit in the collapsible "Request details" section.
  const sa2 = await pageAs(browser, 'manager');
  await sa2.page.goto(`/requests/${statementsId}`);
  const details = sa2.page.getByRole('button', { name: /Lifecycle, scope, and timing/ });
  await expect(details).toBeVisible();
  if ((await details.getAttribute('aria-expanded')) !== 'true') await details.click();
  await details.scrollIntoViewIfNeeded();
  await shot(sa2.page, 'requests/request-details');
  if (JSON.stringify(detail).includes('"Open"')) {
    await sa2.page.getByRole('button', { name: 'Change status' }).first().click();
    const st = sa2.page.getByRole('dialog', { name: 'Change status' });
    await st.getByRole('combobox').first().click();
    await sa2.page.getByRole('option', { name: 'Pending Client' }).click();
    await st.getByRole('textbox').first().fill('Sent to Grace — statements for all three accounts.').catch(() => undefined);
    await shot(st, 'requests/change-status');
    await st.getByRole('button', { name: /Save|Update|Change status|Confirm/ }).last().click();
    await expect(st).toBeHidden();
  }
  await sa2.context.close();
  for (const r of all) {
    if (r.id === statementsId) continue;
    await chidiApi.post(bff(`requests/${r.id}/status`), { data: { statusId: 2 } });
  }

  // ---- the client responds (Grace) -----------------------------------------------------------
  const pdf = async (label: string) =>
    Buffer.concat([await readFile(path.join(DEMO_FILES, 'finance-act-2025-highlights.pdf')), Buffer.from(`\n% ${label}\n`)]);
  const client = await pageAs(browser, 'client');
  const cp = client.page;
  await cp.goto('/dashboard');
  await expect(cp.getByText(/request\(s\) waiting on you/)).toBeVisible();
  await shot(cp, 'clients/dashboard');
  await cp.goto(`/requests/${statementsId}`);
  await expect(cp.getByText('All Bank Statements').first()).toBeVisible();
  await shot(cp, 'clients/request-overview');
  const subsBody = (await (await chidiApi.get(bff(`requests/${statementsId}/submissions`))).json()) as unknown[] | { data: unknown[] };
  const subs = Array.isArray(subsBody) ? subsBody : subsBody.data;
  if (!subs.length) {
    await cp.goto(`/requests/${statementsId}?tab=submissions`);
    await cp.getByRole('button', { name: 'Send response' }).click();
    const rd = cp.getByRole('dialog', { name: 'Respond to request' });
    await rd.getByPlaceholder('Describe your response and any context the review team needs…').fill(
      'Statements for our three accounts. The Access Bank one for March is still with the bank.',
    );
    await rd.locator('input[type=file]').first().setInputFiles([
      { name: 'Zenith Bank - current account 2026.pdf', mimeType: 'application/pdf', buffer: await pdf('zenith') },
      { name: 'GTBank - savings account 2026.pdf', mimeType: 'application/pdf', buffer: await pdf('gtb') },
      { name: 'Access Bank - collections account 2026.pdf', mimeType: 'application/pdf', buffer: await pdf('access') },
    ]);
    await shot(rd, 'clients/respond-dialog');
    await rd.getByRole('button', { name: 'Upload & send' }).click();
    // Once sent, the dialog becomes "Add files to response" — you can keep adding files.
    const sent = cp.getByRole('dialog', { name: 'Add files to response' });
    await expect(sent.getByText('Sent', { exact: true })).toHaveCount(3, { timeout: 60_000 });
    await shot(sent, 'clients/respond-sent');
    await sent.getByRole('button', { name: 'Done' }).click();
  }
  await cp.goto(`/requests/${statementsId}?tab=submissions`);
  await expect(cp.getByText('Zenith Bank - current account 2026.pdf').first()).toBeVisible();
  await shot(cp, 'clients/submissions-sent');

  // ---- Amina reviews the files ---------------------------------------------------------------
  await sp.goto(`/requests/${statementsId}?tab=submissions`);
  await expect(sp.getByText('Zenith Bank - current account 2026.pdf').first()).toBeVisible();
  await shot(sp, 'requests/review-submissions');
  // A file's card = the nearest block around its name that holds its own review buttons.
  const fileRow = (name: string) =>
    sp
      .getByText(name, { exact: true })
      .first()
      .locator(
        'xpath=ancestor::*[.//button[normalize-space()="Accept" or @aria-label="Undo accept" or @aria-label="Undo return" or normalize-space()="Confirm return"]][1]',
      );
  const fileStatus = async (name: string): Promise<string | undefined> => {
    const body = (await (await chidiApi.get(bff(`requests/${statementsId}/submissions`))).json()) as unknown;
    const list = (Array.isArray(body) ? body : (body as { data: unknown[] }).data) as { files?: { fileName: string; status: string; superseded?: boolean }[] }[];
    return list.flatMap((x) => x.files ?? []).find((f) => f.fileName === name && !f.superseded)?.status;
  };
  for (const name of ['Zenith Bank - current account 2026.pdf', 'GTBank - savings account 2026.pdf']) {
    const accept = fileRow(name).getByRole('button', { name: 'Accept' });
    if (['Pending', 'UnderReview'].includes((await fileStatus(name)) ?? '')) {
      const done = sp.waitForResponse((r) => /submissions\/.*review/.test(r.url()) && r.request().method() === 'POST');
      await accept.click();
      expect((await done).ok()).toBeTruthy();
      await expect(sp.getByRole('button', { name: 'Undo accept' }).nth(name.startsWith('GT') ? 1 : 0)).toBeVisible();
    }
  }
  const access = fileRow('Access Bank - collections account 2026.pdf');
  if (['Pending', 'UnderReview'].includes((await fileStatus('Access Bank - collections account 2026.pdf')) ?? '')) {
    await access.getByRole('button', { name: 'Return' }).click();
    await sp.getByPlaceholder('Explain what to revise…').fill('March is missing — please send the full January–December statement.');
    await shot(sp.getByPlaceholder('Explain what to revise…').locator('xpath=ancestor::*[.//button[normalize-space()="Confirm return"]][1]'), 'requests/return-reason', { pad: 24 });
    const returned = sp.waitForResponse((r) => /submissions\/.*review/.test(r.url()) && r.request().method() === 'POST');
    await sp.getByRole('button', { name: 'Confirm return' }).click();
    expect((await returned).ok()).toBeTruthy();
    await expect(sp.getByRole('button', { name: 'Undo return' })).toBeVisible();
  }
  await shot(sp, 'requests/reviewed-files');

  // ---- the client replaces the returned file -------------------------------------------------
  await cp.goto(`/requests/${statementsId}?tab=submissions`);
  await expect(cp.getByText(/collections account 2026/).first()).toBeVisible();
  const replace = cp.getByRole('button', { name: 'Upload replacement' });
  if ((await fileStatus('Access Bank - collections account 2026.pdf')) === 'Returned' && !(await fileStatus('Access Bank - collections account 2026 (full year).pdf'))) {
    await replace.scrollIntoViewIfNeeded();
    await shot(cp, 'clients/returned-file');
    const chooser = cp.waitForEvent('filechooser');
    await replace.click();
    await (await chooser).setFiles({ name: 'Access Bank - collections account 2026 (full year).pdf', mimeType: 'application/pdf', buffer: await pdf('access-full') });
    await expect(cp.getByText(/collections account 2026 \(full year\)/).first()).toBeVisible({ timeout: 60_000 });
  }
  await cp.getByText(/collections account 2026 \(full year\)/).first().scrollIntoViewIfNeeded();
  await shot(cp, 'clients/replaced-file');

  // ---- discussion -----------------------------------------------------------------------------
  await cp.goto(`/requests/${statementsId}?tab=discussion`);
  const box = cp.getByPlaceholder('Write a message…');
  await expect(box).toBeVisible();
  if (!(await cp.getByText('Do you also need the dormant USD account').count())) {
    await box.fill('Do you also need the dormant USD account? It had no movement this year.');
    await cp.getByRole('button', { name: 'Post' }).click();
    await expect(cp.getByText('Do you also need the dormant USD account').first()).toBeVisible();
  }
  await sp.goto(`/requests/${statementsId}?tab=discussion`);
  await expect(sp.getByText('Do you also need the dormant USD account').first()).toBeVisible();
  if (!(await sp.getByText('Yes please — a statement showing the nil balance').count())) {
    await sp.getByPlaceholder('Write a message…').fill('Yes please — a statement showing the nil balance is enough. ');
    await sp.getByRole('button', { name: 'Mention' }).click();
    await sp.locator('[cmdk-input]').last().fill('Chidi');
    await sp.getByRole('option', { name: /Chidi Nwosu/ }).click();
    await shot(sp.getByPlaceholder('Write a message…').locator('xpath=ancestor::*[.//button[normalize-space()="Post"]][1]'), 'requests/discussion-compose', { pad: 16 });
    await sp.getByRole('button', { name: 'Post' }).click();
    await expect(sp.getByText('Yes please — a statement showing the nil balance').first()).toBeVisible();
  }
  await sp.getByText('Yes please — a statement showing the nil balance').first().scrollIntoViewIfNeeded();
  await shot(sp, 'requests/discussion');

  // ---- submit for internal review (Amina) and decide (Chidi) ---------------------------------------
  await sp.goto(`/requests/${statementsId}`);
  const submitBtn = sp.getByRole('button', { name: 'Submit for review' }).first();
  await expect(submitBtn).toBeVisible();
  const reviewsBody = await (await chidiApi.get(bff('reviews?page=1&pageSize=50'))).json();
  if (!JSON.stringify(reviewsBody).includes(statementsId)) {
    await submitBtn.click();
    const sr = sp.getByRole('dialog', { name: 'Submit request for review' });
    await choose(sr, 'Search and select reviewer…', 'Chidi Nwosu');
    await sr.getByRole('textbox').last().fill('Statements received for all three accounts; Access Bank replaced with the full year.');
    await shot(sr, 'requests/submit-for-review');
    await sr.getByRole('button', { name: 'Submit for review' }).click();
    await expect(sr).toBeHidden();
  }
  const rv = await pageAs(browser, 'manager');
  await rv.page.goto('/reviews');
  const pendingReviews = JSON.stringify(await (await chidiApi.get(bff('reviews?status=ForReview&page=1&pageSize=20'))).json());
  if (pendingReviews.includes(statementsId)) {
    await expect(rv.page.getByText('All Bank Statements').first()).toBeVisible();
    await shot(rv.page, 'requests/review-queue');
    await rv.page.getByRole('button', { name: 'Decide' }).first().click();
    const dr = rv.page.getByRole('dialog', { name: 'Decide review' });
    await dr.getByRole('textbox').last().fill('Agreed to the bank letters. Good work.');
    await shot(dr, 'requests/decide-review');
    await dr.getByRole('button', { name: 'Save decision' }).click();
    await expect(dr).toBeHidden();
  }
  await rv.context.close();

  // ---- working papers (Amina) ------------------------------------------------------------------
  const docs = async (category: string) =>
    ((await (await chidiApi.get(bff(`documents?engagementId=${engagementId}&category=${category}&page=1&pageSize=50`))).json()).data ?? []) as {
      id: string;
      title: string;
    }[];
  await sp.goto(`/engagements/${engagementId}?tab=documents`);
  await expect(sp.getByRole('tab', { name: 'Working papers' })).toBeVisible();
  if (!(await docs('WorkingPaper')).some((d) => d.title === 'Bank reconciliation review')) {
    await sp.getByRole('button').filter({ hasText: /^Upload$/ }).click();
    const wp = sp.getByRole('dialog', { name: 'Upload working paper' });
    await choose(wp, 'No class', 'Cash and cash equivalents');
    await wp.getByRole('textbox').first().fill('Bank reconciliation review');
    await wp.getByRole('textbox').nth(1).fill('Tick-marked reconciliations for all three accounts, with exceptions listed.');
    await wp.locator('input[type=file]').first().setInputFiles({
      name: 'Bank reconciliation review.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await readFile(path.join(DEMO_FILES, 'transfer-pricing-checklist.xlsx')),
    });
    await shot(wp, 'documents/upload-working-paper');
    await wp.getByRole('button', { name: 'Upload', exact: true }).last().click();
    await expect(wp).toBeHidden({ timeout: 30_000 });
  }
  await sp.reload();
  await expect(sp.getByText('Bank reconciliation review').first()).toBeVisible();
  await shot(sp, 'documents/working-papers');

  // ---- final report: send to the client (Chidi) ----------------------------------------------------
  const fr = await pageAs(browser, 'manager');
  await fr.page.goto(`/engagements/${engagementId}?tab=documents`);
  await fr.page.getByRole('tab', { name: 'Final reports' }).click();
  if (!(await docs('FinalReport')).length) {
    await fr.page.getByRole('button').filter({ hasText: /^Upload$/ }).click();
    const up = fr.page.getByRole('dialog', { name: 'Upload final report' });
    await up.getByRole('textbox').first().fill('Audited financial statements FY2026 — draft');
    await up.locator('input[type=file]').first().setInputFiles({
      name: 'Northwind Foods - draft financial statements FY2026.pdf',
      mimeType: 'application/pdf',
      buffer: await readFile(path.join(DEMO_FILES, 'ifrs-17-implementation-guide.pdf')),
    });
    await shot(up, 'documents/upload-final-report');
    await up.getByRole('button', { name: 'Upload & send' }).click();
    await expect(up).toBeHidden({ timeout: 30_000 });
  }
  await fr.page.reload();
  await fr.page.getByRole('tab', { name: 'Final reports' }).click();
  await expect(fr.page.getByText('Audited financial statements FY2026 — draft').first()).toBeVisible();
  await shot(fr.page, 'documents/final-reports-tab');

  // ---- the client reviews it (Grace): round 1 asks for changes ----------------------------------------
  const finalReport = (await docs('FinalReport'))[0]!;
  const state = async () =>
    (await (await chidiApi.get(bff(`documents/${finalReport.id}/final-report`))).json()) as { reviewState: string; reviewRound: number };
  await cp.goto('/final-reports');
  if ((await state()).reviewState !== 'AwaitingClient') await cp.getByText('All reports').first().click();
  await expect(cp.getByText('Audited financial statements FY2026 — draft').first()).toBeVisible();
  await shot(cp, 'clients/final-reports');
  await cp.getByText('Audited financial statements FY2026 — draft').first().click();
  await expect(cp.getByText(/Current report file/).first()).toBeVisible();
  await shot(cp, 'clients/final-report-review');
  const s1 = await state();
  if (s1.reviewRound === 1 && s1.reviewState === 'AwaitingClient') {
    await cp.getByRole('button', { name: 'Request changes' }).click();
    const rc = cp.getByRole('dialog');
    await rc.getByRole('textbox').fill('Note 14: please show the loan covenants separately.');
    await shot(rc, 'clients/request-changes');
    await rc.getByRole('button', { name: 'Send feedback' }).click();
    await expect(rc).toBeHidden();
  }

  // Chidi uploads the revised draft (round 2), the client approves.
  await fr.page.goto(`/engagements/${engagementId}?tab=documents`);
  await fr.page.getByRole('tab', { name: 'Final reports' }).click();
  await fr.page.getByText('Audited financial statements FY2026 — draft').first().click();
  const revise = fr.page.getByRole('button', { name: /Upload & send revision/ });
  if ((await state()).reviewState === 'ChangesRequested') {
    await shot(fr.page.getByRole('dialog').last(), 'documents/final-report-changes-requested');
    await revise.click();
    const rv2 = fr.page.getByRole('dialog', { name: 'Upload & send revised final report' });
    await rv2.locator('input[type=file]').first().setInputFiles({
      name: 'Northwind Foods - financial statements FY2026 v2.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.concat([await readFile(path.join(DEMO_FILES, 'ifrs-17-implementation-guide.pdf')), Buffer.from('\n% v2\n')]),
    });
    await shot(rv2, 'documents/upload-revision');
    await rv2.getByRole('button', { name: /Upload & send/ }).last().click();
    await expect(rv2).toBeHidden({ timeout: 30_000 });
  }
  await fr.page.keyboard.press('Escape');
  await cp.reload();
  const s2 = await state();
  if (s2.reviewRound >= 2 && s2.reviewState === 'AwaitingClient') {
    await cp.getByRole('button', { name: 'Approve' }).click();
    const ap = cp.getByRole('dialog');
    await shot(ap, 'clients/approve-final-report');
    await ap.getByRole('button', { name: 'Confirm approval' }).click();
    await expect(ap).toBeHidden();
  }
  await cp.reload();
  await expect(cp.getByText(/You approved this report|issued this report/).first()).toBeVisible();
  await shot(cp, 'clients/final-report-approved');

  // ---- sign-off and completion (Chidi) --------------------------------------------------------------
  await fr.page.goto(`/engagements/${engagementId}?tab=settings`);
  await expect(fr.page.getByRole('heading', { name: 'Request classes' })).toBeVisible();
  const signBtn = fr.page.getByRole('button', { name: 'Sign off', exact: true }).first();
  if (await signBtn.count()) {
    await signBtn.click();
    const so = fr.page.getByRole('dialog', { name: 'Sign off request class' });
    await so.getByRole('textbox').fill('Cash work complete; bank letters agreed.').catch(() => undefined);
    await shot(so, 'engagements/sign-off-class');
    await so.getByRole('button', { name: 'Sign off', exact: true }).click();
    await expect(so).toBeHidden();
  }
  const wide = fr.page.getByRole('button', { name: 'Sign off engagement' });
  await wide.scrollIntoViewIfNeeded();
  const eng = async () => (await (await chidiApi.get(bff(`engagements/${engagementId}`))).json()) as { stage: string };
  if (!JSON.stringify(await (await chidiApi.get(bff(`engagements/${engagementId}/sign-offs`))).json()).includes('"requestClassId":null')) {
    await wide.click();
    const se = fr.page.getByRole('dialog', { name: 'Sign off engagement' });
    await se.getByRole('textbox').fill('All classes reviewed; final report approved by the client.').catch(() => undefined);
    await shot(se, 'engagements/sign-off-engagement');
    await se.getByRole('button', { name: 'Sign off', exact: true }).click();
    await expect(se).toBeHidden();
  }
  await shot(fr.page, 'engagements/sign-offs');

  // Reporting, then Completed.
  for (const next of ['Reporting', 'Completed']) {
    if ((await eng()).stage === next || (next === 'Reporting' && (await eng()).stage === 'Completed')) continue;
    await fr.page.goto(`/engagements/${engagementId}`);
    await fr.page.getByRole('button', { name: `Advance to ${next}` }).click();
    const tr = fr.page.getByRole('dialog', { name: 'Transition engagement' });
    if (next === 'Completed') await shot(tr, 'engagements/transition-completed');
    await tr.getByRole('button', { name: 'Transition' }).click();
    await expect(tr).toBeHidden();
  }
  await fr.page.goto(`/engagements/${engagementId}`);
  await expect(fr.page.getByText('Completed').first()).toBeVisible();
  await shot(fr.page, 'engagements/completed');

  // Clone for next year (dialog only).
  await fr.page.getByRole('button', { name: 'Clone for new period' }).click();
  const cl = fr.page.getByRole('dialog', { name: 'Clone for new period' });
  await cl.getByRole('textbox').first().fill('FY 2027');
  await shot(cl, 'engagements/clone');
  await fr.page.keyboard.press('Escape');

  // The Requests page with selection (bulk actions).
  await fr.page.goto('/requests');
  await expect(fr.page.getByText('Receivable ageing analysis').first()).toBeVisible();
  const boxes = fr.page.getByRole('checkbox');
  if ((await boxes.count()) > 2) {
    await boxes.nth(1).check();
    await boxes.nth(2).check();
    await shot(fr.page, 'requests/bulk-actions');
  }
  await fr.context.close();

  // The client's view of the engagement.
  await cp.goto(`/engagements/${engagementId}`);
  await expect(cp.getByText('Statutory Audit FY2026').first()).toBeVisible();
  await shot(cp, 'clients/engagement');

  await sa.context.close();
  await staff.context.close();
  await client.context.close();
});
