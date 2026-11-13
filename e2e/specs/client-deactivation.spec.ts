import { expect, request, test } from '@playwright/test';
import { E2E_PASSWORD, PERSONAS } from '../fixtures/personas';
import { apiAs, authFile, pageAs } from '../support/fixtures';
import { bff } from '../support/library';

const CLIENT = PERSONAS.client.email;

async function signIn(baseURL: string, ip: string) {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { 'x-real-ip': ip } });
  const res = await ctx.post('/api/bff/auth/login', { data: { email: CLIENT, password: E2E_PASSWORD } });
  return { ctx, res };
}

/**
 * Deactivating a client switches off the portal for its contacts — sign-in is refused with a reason —
 * and reactivating it lets them straight back in with the same password.
 */
test('a deactivated client’s contacts cannot sign in until it is reactivated', async ({ browser, playwright, baseURL }) => {
  const pa = await apiAs(playwright, 'pa', baseURL!);
  const list = (await (await pa.get(bff('clients?q=E2E%20Test%20Client&pageSize=10'))).json()) as { data: { id: string }[] };
  const clientId = list.data[0]!.id;
  const { page, context } = await pageAs(browser, 'pa');

  try {
    // ---- deactivate in the UI ----------------------------------------------------------------------
    await page.goto(`/admin/clients/${clientId}`);
    await page.getByRole('button', { name: 'Deactivate', exact: true }).last().click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click();
    await expect.poll(async () => ((await (await pa.get(bff(`clients/${clientId}`))).json()) as { isActive: boolean }).isActive).toBe(false);

    // ---- the contact is refused, with the reason, in the API and on the sign-in page ---------------
    const refused = await signIn(baseURL!, '10.98.0.1');
    expect(refused.res.status()).toBe(401);
    expect(await refused.res.text()).toContain('portal access is switched off');
    await refused.ctx.dispose();

    const anon = await browser.newContext();
    const login = await anon.newPage();
    await login.goto('/login');
    await login.locator('#email').fill(CLIENT);
    await login.locator('#password').fill(E2E_PASSWORD);
    await login.getByRole('button', { name: 'Sign in' }).click();
    await expect(login.getByText(/portal access is switched off/)).toBeVisible();
    await expect(login).toHaveURL(/\/login/);
    await anon.close();
  } finally {
    // ---- reactivate in the UI (always, so later specs keep a working client) ---------------------------
    await page.goto(`/admin/clients/${clientId}`);
    await page.getByRole('combobox').filter({ hasText: 'Inactive' }).click();
    await page.getByRole('option', { name: 'Active', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(async () => ((await (await pa.get(bff(`clients/${clientId}`))).json()) as { isActive: boolean }).isActive).toBe(true);
    await context.close();
  }

  // ---- back in with the same password; refresh the saved session the other specs use --------------
  const again = await signIn(baseURL!, '10.98.0.2');
  expect(again.res.ok()).toBeTruthy();
  await again.ctx.storageState({ path: authFile('client') });
  await again.ctx.dispose();
});
