import { request, type FullConfig } from '@playwright/test';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { E2E_PASSWORD, PERSONAS } from '../fixtures/personas';

export const AUTH_DIR = path.join(__dirname, '..', '.auth');
const FRESH_MS = 10 * 60_000;

/**
 * Logs every persona in through the web BFF once and saves its cookies, so specs start
 * authenticated. Each persona gets its own X-Real-IP so the 5/min login throttle (per IP)
 * doesn't trip during setup. State files younger than 10 minutes are reused.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000';
  await mkdir(AUTH_DIR, { recursive: true });
  let n = 0;
  for (const persona of Object.values(PERSONAS)) {
    n += 1;
    const file = path.join(AUTH_DIR, `${persona.key}.json`);
    const age = await stat(file).then((s) => Date.now() - s.mtimeMs).catch(() => Infinity);
    if (age < FRESH_MS) continue;
    const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { 'x-real-ip': `10.99.0.${n}` } });
    const res = await ctx.post('/api/bff/auth/login', { data: { email: persona.email, password: E2E_PASSWORD } });
    if (!res.ok()) {
      throw new Error(`Login failed for ${persona.email}: ${res.status()} ${await res.text()} — run \`pnpm seed:e2e\`.`);
    }
    await ctx.storageState({ path: file });
    await ctx.dispose();
  }
}
