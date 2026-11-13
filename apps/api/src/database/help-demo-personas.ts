/**
 * Demo people for the Help Center screenshot tours (HC3, e2e/help). Only the people are seeded
 * here — everything they work on is created by the tours through the real UI and API.
 * Test-only: refuses to run in production and uses the e2e test password.
 */
export interface DemoPersona {
  key: string;
  email: string;
  firstName: string;
  surname: string;
  role: 'Platform Admin' | 'Super Admin' | 'Staff' | 'Client' | 'Guest';
  department?: string;
  designation?: 'Partner' | 'PrincipalPartner';
}

export const DEMO_PERSONAS = {
  admin: { key: 'admin', email: 'ifeoma.okafor@demo.test', firstName: 'Ifeoma', surname: 'Okafor', role: 'Platform Admin' },
  principal: {
    key: 'principal',
    email: 'adebayo.bakare@demo.test',
    firstName: 'Adebayo',
    surname: 'Bakare',
    role: 'Super Admin',
    department: 'Assurance',
    designation: 'PrincipalPartner',
  },
  partner: {
    key: 'partner',
    email: 'kemi.adeyemi@demo.test',
    firstName: 'Kemi',
    surname: 'Adeyemi',
    role: 'Super Admin',
    department: 'Tax',
    designation: 'Partner',
  },
  manager: { key: 'manager', email: 'chidi.nwosu@demo.test', firstName: 'Chidi', surname: 'Nwosu', role: 'Super Admin', department: 'Assurance' },
  amina: { key: 'amina', email: 'amina.bello@demo.test', firstName: 'Amina', surname: 'Bello', role: 'Staff', department: 'Assurance' },
  tunde: { key: 'tunde', email: 'tunde.okoro@demo.test', firstName: 'Tunde', surname: 'Okoro', role: 'Staff', department: 'Tax' },
  client: { key: 'client', email: 'grace.eze@demo.test', firstName: 'Grace', surname: 'Eze', role: 'Client' },
  guest: { key: 'guest', email: 'musa.danjuma@demo.test', firstName: 'Musa', surname: 'Danjuma', role: 'Guest' },
} satisfies Record<string, DemoPersona>;

export type DemoKey = keyof typeof DEMO_PERSONAS;

export const DEMO_CLIENT = 'Northwind Foods Ltd';

