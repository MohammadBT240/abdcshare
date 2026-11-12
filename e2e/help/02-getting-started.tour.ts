import { devices, expect, test } from '@playwright/test';
import { bff } from '../support/library';
import { apiAs, pageAs, shot } from './support';

/** Getting started screenshots (docs/help/getting-started/*). Runs after the library tour (needs its items). */
test('getting started tour', async ({ browser, playwright, baseURL }) => {
  // Install the latest docs/help articles (the API also does this when it starts).
  const admin = await apiAs(playwright, 'manager', baseURL!);
  expect((await admin.post(bff('help/admin/sync'))).ok()).toBeTruthy();

  // ---- signed out ------------------------------------------------------------------------------
  const anon = await browser.newContext();
  const out = await anon.newPage();
  await out.goto('/login');
  await expect(out.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await shot(out, 'getting-started/sign-in');
  await out.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(out.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  await shot(out, 'getting-started/forgot-password');
  await anon.close();

  // ---- a member of staff -----------------------------------------------------------------------
  const { page, context } = await pageAs(browser, 'amina');
  await page.goto('/change-password');
  await expect(page.getByRole('button', { name: 'Update password' })).toBeVisible();
  await shot(page, 'getting-started/change-password');

  await page.goto('/dashboard');
  await expect(page.getByText('My progress')).toBeVisible();
  await shot(page, 'getting-started/dashboard-staff');
  await shot(page.locator('header').first(), 'getting-started/header', { pad: 0 });

  await page.keyboard.press('Control+k');
  const search = page.getByPlaceholder('Search engagements, requests, documents, the library…');
  await search.fill('ifrs');
  await expect(page.getByRole('option', { name: /IFRS 17 Implementation Guide/ }).first()).toBeVisible();
  await shot(page.getByRole('dialog'), 'getting-started/global-search', { pad: 16 });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Change theme' }).click();
  await shot(page.getByRole('menu'), 'getting-started/theme-menu', { pad: 40 });
  await page.keyboard.press('Escape');

  await page.locator('header').getByRole('button', { name: /Amina/ }).click();
  await shot(page.getByRole('menu'), 'getting-started/user-menu', { pad: 40 });
  await page.keyboard.press('Escape');

  await page.goto('/settings/account');
  await expect(page.getByRole('heading', { name: 'Profile photo' })).toBeVisible();
  await shot(page, 'getting-started/settings-account');
  await page.getByRole('heading', { name: 'Security' }).scrollIntoViewIfNeeded();
  await shot(page, 'getting-started/settings-security');
  await page.goto('/settings/notifications');
  await expect(page.getByText('Choose which events send in-app alerts and email.')).toBeVisible();
  await shot(page, 'getting-started/settings-notifications');

  await page.goto('/help');
  await expect(page.getByTestId('help-categories')).toBeVisible();
  await shot(page, 'getting-started/help-center');
  await context.close();

  // ---- notifications (Chidi has the library report from the library tour) ------------------------
  const cur = await pageAs(browser, 'manager');
  await cur.page.goto('/dashboard');
  await cur.page.getByRole('button', { name: /unread notifications|Notifications/ }).click();
  await expect(cur.page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await shot(cur.page.getByRole('dialog').or(cur.page.locator('[data-radix-popper-content-wrapper]')).first(), 'getting-started/notifications', { pad: 16 });
  await cur.page.keyboard.press('Escape');
  await expect(cur.page.getByText('Request activity')).toBeVisible();
  await shot(cur.page, 'getting-started/dashboard-firm');
  await cur.context.close();

  // ---- on a phone ------------------------------------------------------------------------------
  const phone = await pageAs(browser, 'amina', { ...devices['iPhone 13'], deviceScaleFactor: 2 });
  await phone.page.goto('/dashboard');
  await expect(phone.page.getByText('My progress')).toBeVisible();
  await shot(phone.page, 'getting-started/phone-dashboard');
  await phone.page.getByRole('button', { name: 'Open menu' }).click();
  await expect(phone.page.getByRole('link', { name: 'Library' }).first()).toBeVisible();
  await shot(phone.page, 'getting-started/phone-menu');
  await phone.context.close();
});
