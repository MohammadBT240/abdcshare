import { expect, test, type Page } from '@playwright/test';
import { bff } from '../support/library';
import { apiAs, choose, pageAs, shot } from './support';

/**
 * Partner reports (docs/help/partner-reports): Kemi (Partner) writes and submits a weekly report,
 * Adebayo (Principal Partner) reviews it and manages the reporting roster, Musa (Guest) reports too.
 */
async function writeReport(page: Page, prefix: string, label: string, opts: { financials: boolean; shots: boolean }) {
  await page.goto('/reports/new');
  await expect(page.getByRole('heading', { name: 'New report' }).or(page.getByText('New report')).first()).toBeVisible();
  // Step 1: reporter & period (name and department are filled in from your profile).
  await choose(page, /Select|Weekly|Monthly/, 'Weekly').catch(() => undefined);
  await page.getByPlaceholder('e.g. Week ending 7 Aug 2026').fill(label);
  const company = page.locator('main').getByRole('textbox').nth(1);
  if (!(await company.inputValue())) await company.fill('Tax');
  if (opts.shots) await shot(page, `${prefix}/step-reporter`);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('main textarea').first().fill(
    'Fieldwork on Northwind Foods finished on time. Two new tax mandates signed; collections slightly behind plan.',
  );
  if (opts.shots) await shot(page, `${prefix}/step-summary`);
  await page.getByRole('button', { name: 'Next' }).click();
  if (opts.financials) {
    await choose(page, 'Select', /Naira|NGN/);
    await page.getByRole('button', { name: 'Add line' }).click();
    const row = page.locator('tbody tr').last();
    const inputs = row.locator('input');
    await inputs.nth(0).fill('Northwind Foods — audit fee (2nd instalment)');
    await inputs.nth(1).fill('4500000');
    await inputs.nth(2).fill('2000000').catch(() => undefined);
    if (opts.shots) await shot(page, `${prefix}/step-financials`);
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('Client / engagement').fill('Northwind Foods — FY2026 audit');
  await page.getByPlaceholder('Update').fill('Final report approved by the client; engagement completed.');
  if (opts.shots) await shot(page, `${prefix}/step-engagements`);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('Decision needed').fill('Approve one extra senior for the January audit season.');
  if (opts.shots) await shot(page, `${prefix}/step-decisions`);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('main textarea').nth(0).fill('Team at full strength; one senior on leave next week.');
  await page.locator('main textarea').nth(1).fill('Year-end planning for three audit clients starts next week.');
  if (opts.shots) await shot(page, `${prefix}/step-people`);
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}/, { timeout: 30_000 });
}

test('partner reports tour', async ({ browser, playwright, baseURL }) => {
  const kemiApi = await apiAs(playwright, 'partner', baseURL!);
  const mine = JSON.stringify(await (await kemiApi.get(bff('partner-reports?page=1&pageSize=20'))).json());

  // ---- a Partner writes and submits ------------------------------------------------------------
  const kemi = await pageAs(browser, 'partner');
  await kemi.page.goto('/reports');
  await expect(kemi.page.getByRole('button', { name: 'New report' })).toBeVisible();
  await shot(kemi.page, 'partner-reports/partner-reports-page');
  if (!mine.includes('Week ending 13 Nov 2026')) {
    await writeReport(kemi.page, 'partner-reports', 'Week ending 13 Nov 2026', { financials: true, shots: true });
  }
  await kemi.page.goto('/reports');
  await kemi.page.getByText('Week ending 13 Nov 2026').first().click();
  await expect(kemi.page.getByText('Executive summary').first()).toBeVisible();
  await shot(kemi.page, 'partner-reports/submitted-report');
  await kemi.context.close();

  // ---- the Principal Partner reviews -------------------------------------------------------------
  const pp = await pageAs(browser, 'principal');
  await pp.page.goto('/reports');
  await expect(pp.page.getByRole('tab', { name: 'Awaiting review' })).toBeVisible();
  await shot(pp.page, 'partner-reports/principal-reports-page');
  await pp.page.getByRole('tab', { name: 'All reports' }).click();
  await pp.page.getByText('Week ending 13 Nov 2026').first().click();
  await expect(pp.page.getByText('Executive summary').first()).toBeVisible();
  const review = pp.page.getByRole('button', { name: /Review report|^Review$/ }).first();
  if (await review.count()) {
    await review.click();
    const dlg = pp.page.getByRole('dialog');
    await dlg.getByPlaceholder('Feedback for the reporting officer').fill('Thanks Kemi — approved the extra senior. Push on collections.');
    await shot(dlg, 'partner-reports/review-dialog');
    await dlg.getByRole('button', { name: 'Mark reviewed' }).click();
    await expect(dlg).toBeHidden();
  }
  await shot(pp.page, 'partner-reports/reviewed-report');

  // ---- the roster: request a report, invite a guest -------------------------------------------------
  await pp.page.goto('/reports');
  await pp.page.getByRole('button', { name: 'Roster' }).click();
  const roster = pp.page.getByRole('dialog', { name: 'Reporting roster' });
  await expect(roster).toBeVisible();
  await shot(roster, 'partner-reports/roster');
  await roster.getByRole('tab', { name: 'External guest' }).click();
  const panel = roster.getByRole('tabpanel');
  await panel.getByRole('textbox').nth(0).fill('zainab.lawal@demo.test');
  await panel.getByRole('textbox').nth(1).fill('Zainab Lawal');
  await shot(roster, 'partner-reports/invite-guest');
  await pp.page.keyboard.press('Escape');

  const req = await apiAs(playwright, 'principal', baseURL!);
  const reporters = JSON.stringify(await (await req.get(bff('partner-reports/reporters'))).json());
  void reporters;
  await pp.page.getByRole('button', { name: 'Roster' }).click();
  const r2 = pp.page.getByRole('dialog', { name: 'Reporting roster' });
  const requestBtn = r2.getByRole('button', { name: 'Request' }).first();
  if (await requestBtn.count()) {
    await requestBtn.click();
    const rq = pp.page.getByRole('dialog', { name: 'Request a report' });
    await rq.getByPlaceholder('e.g. Please cover WIP and collections for this week').fill('Please cover the January audit staffing plan.');
    await shot(rq, 'partner-reports/request-report');
    await pp.page.keyboard.press('Escape');
  }
  await pp.context.close();

  // ---- a guest's view ---------------------------------------------------------------------------------
  const guest = await pageAs(browser, 'guest');
  await guest.page.goto('/dashboard');
  await expect(guest.page.getByText('My reports').first()).toBeVisible();
  await shot(guest.page, 'partner-reports/guest-dashboard');
  await guest.context.close();
});
