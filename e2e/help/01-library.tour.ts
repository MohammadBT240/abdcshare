import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bff, createItem as create, departmentId } from '../support/library';
import { apiAs, DEMO_FILES, pageAs, shot } from './support';

/**
 * Library screenshots (docs/help/library/*). Builds a small, realistic library as the demo people,
 * then walks the same flows the articles describe.
 */
test('library tour', async ({ browser, playwright, baseURL }) => {
  const chidi = await apiAs(playwright, 'manager', baseURL!); // Super Admin — a library curator
  const amina = await apiAs(playwright, 'amina', baseURL!); // Staff, Assurance
  const tunde = await apiAs(playwright, 'tunde', baseURL!); // Staff, Tax
  const file = (name: string) => readFile(path.join(DEMO_FILES, name));
  const tax = await departmentId(chidi, 'Tax');
  // Re-runnable: reuse what an earlier run created (the curator sees everything).
  const existing = new Map<string, string>(
    ((await (await chidi.get(bff('library/items?page=1&pageSize=100'))).json()).data as { id: string; title: string }[]).map((i) => [i.title, i.id]),
  );
  const createItem: typeof create = async (api, opts) =>
    existing.has(opts.title) ? { id: existing.get(opts.title)!, title: opts.title } : create(api, opts);

  // ---- demo content -------------------------------------------------------------------------
  const ifrs = await createItem(chidi, {
    title: 'IFRS 17 Implementation Guide',
    categorySlug: 'reports',
    file: 'x.pdf',
    body: await file('ifrs-17-implementation-guide.pdf'),
    tags: ['ifrs 17', 'insurance', 'implementation'],
    extra: { description: 'A practitioner’s walkthrough of IFRS 17 — scope, measurement models, transition and disclosures.', authors: 'Technical desk', year: 2026, source: 'Internal' },
  });
  await createItem(amina, {
    title: 'Audit Sampling Masterclass',
    categorySlug: 'training-materials',
    file: 'x.pdf',
    body: await file('audit-sampling-masterclass.pdf'),
    tags: ['sampling', 'audit methodology'],
    extra: { description: 'Slides from the Assurance academy session on statistical and non-statistical sampling.', authors: 'Amina Bello', year: 2026 },
  });
  await createItem(tunde, {
    title: 'Finance Act 2025 — Highlights',
    categorySlug: 'regulatory-standards',
    file: 'x.pdf',
    body: await file('finance-act-2025-highlights.pdf'),
    visibility: 'Departments',
    departmentIds: [tax],
    tags: ['finance act', 'vat', 'wht'],
    extra: { description: 'What changed in company income tax, VAT and withholding tax, and from when.', year: 2025, authors: 'Tax team' },
  });
  await createItem(chidi, {
    title: 'Quality Management Manual',
    categorySlug: 'policies-methodology',
    file: 'x.pdf',
    body: await file('quality-management-manual.pdf'),
    tags: ['isqm 1', 'quality'],
    extra: { description: 'How the firm meets ISQM 1.', year: 2026, downloadable: false, licence: 'InternalUseOnly' },
  });
  await createItem(chidi, {
    title: 'ESG Reporting in West Africa',
    categorySlug: 'research-papers',
    file: 'x.pdf',
    body: await file('esg-reporting-research.pdf'),
    tags: ['esg', 'sustainability'],
    extra: { description: 'Readiness survey of listed companies, 2026.', year: 2026, licence: 'Licensed', licenceNote: 'Subscription — internal use only', authors: 'Research unit' },
  });
  await createItem(tunde, {
    title: 'Transfer Pricing Documentation Checklist',
    categorySlug: 'templates-tools',
    file: 'x.xlsx',
    body: await file('transfer-pricing-checklist.xlsx'),
    tags: ['transfer pricing', 'checklist'],
    extra: { year: 2026 },
  });

  // A training collection with three modules.
  const collections = (await (await chidi.get(bff('library/collections?page=1&pageSize=50'))).json()).data as { id: string; title: string }[];
  const onboarding = collections.find((c) => c.title === 'New joiner onboarding — 2026') ?? await (
    await chidi.post(bff('library/collections'), {
      data: {
        title: 'New joiner onboarding — 2026',
        type: 'Training',
        description: 'The three modules every new joiner completes in their first month.',
        startsOn: '2026-09-07',
        endsOn: '2026-09-09',
        facilitator: 'Chidi Nwosu',
        venue: 'Lagos office, Training room 2',
      },
    })
  ).json();
  for (const [n, t] of [[1, 'Firm methodology'], [2, 'Working papers and evidence'], [3, 'Using the portal with clients']] as const) {
    await createItem(chidi, {
      title: `Onboarding module ${n} — ${t}`,
      categorySlug: 'training-materials',
      file: 'x.pdf',
      body: await file(`onboarding-module-${n}.pdf`),
      extra: { collectionId: onboarding.id, section: `Day ${n}`, year: 2026 },
    });
  }

  // ---- browsing (Amina, Staff) -----------------------------------------------------------------
  const { page, context } = await pageAs(browser, 'amina');
  await page.goto('/library');
  await expect(page.getByText('IFRS 17 Implementation Guide').first()).toBeVisible();
  await expect(page.getByText('Loading…')).toHaveCount(0);
  await shot(page, 'library/browse');

  await page.getByRole('searchbox', { name: /search the library/i }).or(page.getByLabel('Search the library')).first().fill('sampling');
  await expect(page.getByText('Audit Sampling Masterclass').first()).toBeVisible();
  await shot(page, 'library/search');

  await page.goto(`/library/${ifrs.id}`);
  await expect(page.getByTestId('pdf-viewer')).toBeVisible();
  await expect(page.locator('[data-pdf-page="1"][data-ever-rendered="true"]')).toBeVisible();
  await shot(page, 'library/item-page');
  await page.getByRole('button', { name: 'More actions' }).click();
  await shot(page.getByRole('menu'), 'library/more-actions', { pad: 40 });
  await page.keyboard.press('Escape');

  await page.goto('/library?tab=collections');
  await expect(page.getByText('New joiner onboarding — 2026').first()).toBeVisible();
  await shot(page, 'library/collections-tab');
  await page.goto(`/library/collections/${onboarding.id}`);
  await expect(page.getByText('Onboarding module 3 — Using the portal with clients').first()).toBeVisible();
  await shot(page, 'library/collection-page');

  // ---- uploading one file (Amina) --------------------------------------------------------------
  await page.goto('/library');
  await page.getByRole('button', { name: /^Upload/ }).click();
  await shot(page.getByRole('menu'), 'library/upload-menu', { pad: 60 });
  await page.getByRole('menuitem', { name: 'One file' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'Engagement letter template.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await file('engagement-letter-template.docx'),
  });
  await dialog.getByLabel('Title').fill('Engagement Letter Template');
  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Templates & Tools' }).click();
  await dialog.getByLabel('Description').fill('Standard engagement letter — replace the bracketed text before sending.');
  await shot(dialog, 'library/upload-dialog');
  // Scroll to the access, licence and declaration part of the form.
  const declaration = dialog.getByText(/contains no client-identifiable information/);
  await declaration.scrollIntoViewIfNeeded();
  await dialog.getByRole('button', { name: 'What counts as client-identifiable?' }).click();
  await declaration.click();
  await shot(dialog, 'library/upload-dialog-access');
  await dialog.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  const mine = (await (await amina.get(bff('library/items?page=1&pageSize=20&mine=true&sort=newest'))).json()).data as { id: string; title: string }[];
  await page.goto(`/library/${mine.find((i) => i.title === 'Engagement Letter Template')!.id}`);
  await expect(page.getByRole('heading', { name: 'Engagement Letter Template' })).toBeVisible();
  await shot(page, 'library/item-after-upload');

  // ---- uploading several files ------------------------------------------------------------------
  await page.goto('/library');
  await page.getByRole('button', { name: /^Upload/ }).click();
  await page.getByRole('menuitem', { name: 'Several files' }).click();
  const bulk = page.getByRole('dialog');
  // New files (a byte appended so they aren't flagged as already in the library).
  const fresh = async (n: number) => Buffer.concat([await file(`onboarding-module-${n}.pdf`), Buffer.from(`\n% academy ${n}\n`)]);
  await bulk.locator('input[type=file]').setInputFiles([
    { name: 'Sampling workshop - session 1.pdf', mimeType: 'application/pdf', buffer: await fresh(1) },
    { name: 'Sampling workshop - session 2.pdf', mimeType: 'application/pdf', buffer: await fresh(2) },
    { name: 'Sampling workshop - session 3.pdf', mimeType: 'application/pdf', buffer: await fresh(3) },
  ]);
  await expect(bulk.getByLabel('Title for Sampling workshop - session 3.pdf')).toBeVisible();
  await shot(bulk, 'library/upload-several');
  await page.keyboard.press('Escape');

  // ---- view-only, report, add to collection ------------------------------------------------------
  const items = (await (await amina.get(bff('library/items?page=1&pageSize=50'))).json()).data as { id: string; title: string }[];
  const qm = items.find((i) => i.title === 'Quality Management Manual')!;
  await page.goto(`/library/${qm.id}`);
  await expect(page.getByText(/View-only: read it here/)).toBeVisible();
  await shot(page, 'library/view-only');

  const esg = items.find((i) => i.title === 'ESG Reporting in West Africa')!;
  await page.goto(`/library/${esg.id}`);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Report a problem' }).click();
  const report = page.getByRole('dialog');
  await report.getByText('Out of date or wrong').click();
  await report.getByLabel('Note').fill('The 2026 survey has been replaced by the March 2027 edition.');
  await shot(report, 'library/report-dialog');
  await report.getByRole('button', { name: /^Report|Send/ }).last().click();
  // A re-run against the same data gets "already reported" — close the dialog and carry on.
  await expect(report.or(report.getByText(/already reported/))).toBeHidden({ timeout: 5000 }).catch(() => page.keyboard.press('Escape'));

  // Amina keeps her own collection for the Assurance academy.
  const mineCols = (await (await amina.get(bff('library/collections?page=1&pageSize=20&mine=true'))).json()).data as { title: string }[];
  if (!mineCols.some((c) => c.title === 'Assurance academy — reading list')) {
    await amina.post(bff('library/collections'), { data: { title: 'Assurance academy — reading list', type: 'Programme' } });
  }
  await page.goto(`/library/${ifrs.id}`);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Add to collection' }).click();
  await page.getByRole('dialog').getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Assurance academy/ }).click();
  await page.getByRole('dialog').getByLabel('Section').fill('Standards');
  await shot(page.getByRole('dialog'), 'library/add-to-collection');
  await page.keyboard.press('Escape');
  await context.close();

  // ---- curators (Chidi, Super Admin) ------------------------------------------------------------
  const cur = await pageAs(browser, 'manager');
  await cur.page.goto('/library/review');
  await expect(cur.page.getByText('ESG Reporting in West Africa').first()).toBeVisible();
  await shot(cur.page, 'library/review-queue');
  await cur.page.getByRole('tab', { name: /Needs attention/ }).click();
  await expect(cur.page.getByText('Quarantined').first()).toBeVisible();
  await shot(cur.page, 'library/needs-attention');

  await cur.page.goto(`/library/${ifrs.id}`);
  await cur.page.getByRole('tab', { name: 'Activity' }).or(cur.page.getByRole('button', { name: 'Activity' })).first().click();
  await expect(cur.page.getByRole('list', { name: 'Activity' }).getByText(/uploaded/).first()).toBeVisible();
  await shot(cur.page, 'library/activity');
  await cur.page.getByRole('button', { name: 'More actions' }).click();
  await cur.page.getByRole('menuitem', { name: 'Transfer ownership' }).click();
  await shot(cur.page.getByRole('dialog'), 'library/transfer');
  await cur.context.close();
});
