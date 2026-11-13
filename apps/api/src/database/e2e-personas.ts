/**
 * Test-only personas for Playwright. Created by `pnpm --filter @abdcshare/api seed:e2e`,
 * which refuses to run when NODE_ENV=production. The @e2e.test domain is reserved for these
 * accounts; the password is a fixture value, never a real credential.
 */
export const E2E_PASSWORD = 'E2e-Test-Passw0rd!';

export type PersonaKey = 'pa' | 'sa' | 'tax' | 'audit' | 'nodept' | 'client' | 'guest';

export interface Persona {
  key: PersonaKey;
  email: string;
  firstName: string;
  surname: string;
  role: 'Platform Admin' | 'Super Admin' | 'Staff' | 'Client' | 'Guest';
  department?: 'Tax' | 'Assurance';
}

export const PERSONAS: Record<PersonaKey, Persona> = {
  pa: { key: 'pa', email: 'pa@e2e.test', firstName: 'Pat', surname: 'Platform', role: 'Platform Admin' },
  sa: { key: 'sa', email: 'sa@e2e.test', firstName: 'Sade', surname: 'Super', role: 'Super Admin', department: 'Assurance' },
  tax: { key: 'tax', email: 'tax@e2e.test', firstName: 'Tunde', surname: 'Tax', role: 'Staff', department: 'Tax' },
  audit: { key: 'audit', email: 'audit@e2e.test', firstName: 'Amaka', surname: 'Audit', role: 'Staff', department: 'Assurance' },
  nodept: { key: 'nodept', email: 'nodept@e2e.test', firstName: 'Nuhu', surname: 'Nodept', role: 'Staff' },
  client: { key: 'client', email: 'client@e2e.test', firstName: 'Chika', surname: 'Client', role: 'Client' },
  guest: { key: 'guest', email: 'guest@e2e.test', firstName: 'Gbenga', surname: 'Guest', role: 'Guest' },
};
