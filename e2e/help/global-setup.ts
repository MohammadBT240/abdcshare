import { request, type FullConfig } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { E2E_PASSWORD } from '../../apps/api/src/database/e2e-personas';
import { DEMO_PERSONAS } from '../../apps/api/src/database/help-demo-personas';

export const HELP_AUTH_DIR = path.join(__dirname, '..', '.auth-help');

/** Sign every demo person in once (own X-Real-IP each, so the login throttle doesn't trip). */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000';
  await mkdir(HELP_AUTH_DIR, { recursive: true });
  let n = 0;
  for (const p of Object.values(DEMO_PERSONAS)) {
    n += 1;
    const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { 'x-real-ip': `10.98.0.${n}` } });
    const res = await ctx.post('/api/bff/auth/login', { data: { email: p.email, password: E2E_PASSWORD } });
    if (!res.ok()) throw new Error(`Login failed for ${p.email}: ${res.status()} — run seed:help-demo against this stack's database.`);
    await ctx.storageState({ path: path.join(HELP_AUTH_DIR, `${p.key}.json`) });
    await ctx.dispose();
  }
}
