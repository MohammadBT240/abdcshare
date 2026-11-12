import { test as base, expect, type Browser, type BrowserContext, type Page, type APIRequestContext } from '@playwright/test';
import path from 'node:path';
import type { PersonaKey } from '../fixtures/personas';

const AUTH_DIR = path.join(__dirname, '..', '.auth');

export function authFile(key: PersonaKey): string {
  return path.join(AUTH_DIR, `${key}.json`);
}

/** Open a page signed in as `key`. Caller closes the context. */
export async function pageAs(browser: Browser, key: PersonaKey, options: Parameters<Browser['newContext']>[0] = {}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ ...options, storageState: authFile(key) });
  const page = await context.newPage();
  return { context, page };
}

/** API calls through the BFF proxy as `key` (cookies from the saved state). */
export async function apiAs(playwright: { request: { newContext: (o: object) => Promise<APIRequestContext> } }, key: PersonaKey, baseURL: string): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL, storageState: authFile(key) });
}

export const test = base;
export { expect };
