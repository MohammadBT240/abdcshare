/* eslint-disable no-console */
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import bcrypt from 'bcryptjs';
import { ROLE_NAMES } from '@abdcshare/shared';
import config from './mikro-orm.config';
import { RoleEntity } from '../modules/roles/infrastructure/persistence/role.entity';
import { DepartmentEntity } from '../modules/departments/infrastructure/persistence/department.entity';
import { EngagementTypeEntity } from '../modules/engagement-types/infrastructure/persistence/engagement-type.entity';
import { RequestClassEntity } from '../modules/request-classes/infrastructure/persistence/request-class.entity';
import { RequestTypeEntity } from '../modules/request-types/infrastructure/persistence/request-type.entity';
import { RequestStageEntity } from '../modules/request-stages/infrastructure/persistence/request-stage.entity';
import { RequestStatusEntity } from '../modules/request-statuses/infrastructure/persistence/request-status.entity';
import { ClientTypeEntity } from '../modules/reference/infrastructure/persistence/client-types.entity';
import { TitleEntity } from '../modules/reference/infrastructure/persistence/titles.entity';
import { GenderEntity } from '../modules/reference/infrastructure/persistence/genders.entity';
import { MaritalStatusEntity } from '../modules/reference/infrastructure/persistence/marital-statuses.entity';
import { UserEntity } from '../modules/users/infrastructure/persistence/user.entity';

const DEPARTMENTS = ['Assurance', 'Tax', 'Advisory', 'Business Development', 'Shared Services', 'Other'];
const ENGAGEMENT_TYPES = ['Statutory Audit', 'Tax Compliance', 'Advisory'];
const CLIENT_TYPES = ['Individual', 'Corporate'];
const TITLES = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'];
const GENDERS = ['Male', 'Female', 'Other'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];
const STAGES = ['Not Started', 'In Progress', 'Submitted', 'Reviewed'];
const STATUSES = ['Open', 'Pending Client', 'Accepted', 'Returned', 'Closed'];

/** Tax checklist: section → request class; bullets → request types. */
const TAX_CATALOGUE: Record<string, string[]> = {
  General: [
    'Certificate of Incorporation (CAC)',
    'Memorandum & Articles of Association',
    'CAC Status Report',
    'Tax Identification',
    'VAT Registration Certificate',
    'Tax Office',
    'List of Directors/Shareholders and means of Identification',
    'Recent utility bill of office address',
    'Contact E-mail',
    'Phone Contact',
    'Bank statements',
    'Trial Balance',
    'General Ledger',
    'Chart of Accounts',
    'Management Accounts',
    'Signed Engagement Letter',
    'Authorized contact person(s) and escalation details',
    'NRS Rev 360 portal login access',
    'Letter of authorization to access Rev',
  ],
  'VAT Filing': [
    'Sales invoices (all transactions for the period)',
    'Sales ledger / revenue schedule',
    'Credit notes issued',
    'Contracts/agreements with customers',
    'Purchase invoices',
    'Import documentation (Form M, customs duty forms, waybills)',
    'Expense schedule',
    'Prior period VAT returns and payment evidence (NRS Rev 360)',
    'W/VAT credit notes',
  ],
  'Withholding Tax (WHT)': [
    'Payment vouchers',
    'Schedule of payments to vendors',
    'Vendor invoices',
    'Contracts/agreements with vendors and contractors',
    'Rent Agreement',
    'Vendor TIN details',
    'WHT credit notes/certificates received from customers',
    'Customer remittance advice/payment schedule',
    'Prior WHT returns and remittance evidence (NRS Rev 360)',
    'General ledger / trial balance extract for relevant accounts',
  ],
  PAYE: [
    'Monthly payroll schedule',
    'Letters of employment of staff and letters of last promotion',
    'Staff nominal roll',
    'Expatriate Payroll',
    'Pension schedules/records',
    'Gratuities schedules/records',
    'NHIS schedules/records',
    'NHF contribution schedules/records',
    "Director's information (Names, address, copies of TCC, director's fees, sitting allowances etc.)",
    'Details of benefits-in-kind, bonuses and allowances',
    'Prior PAYE returns and remittance evidence (state IRS/NRS)',
    'Employee tax cards / annual returns (Form H1) from prior year',
    'Business Premises and Development Levy computation schedule',
  ],
  'Companies Income Tax (CIT)': [
    'Fixed Asset Register',
    'Prior year tax computation and assessment notices',
    'Schedule of disallowable expenses (donations, penalties, etc.)',
    'Schedule of WHT credit notes for the year',
    'Capital expenditure schedule and invoices for additions',
    'Evidence of estimated/provisional tax payments and TCCs obtained',
    'Prior CIT returns filed with NRS',
  ],
  'Tax Audit Support': [
    'Board minutes / resolutions for the period',
    'Organizational chart and list of key management personnel',
    'Bank statements and bank reconciliation statements',
    'Fixed Asset Register and supporting invoices',
    'Debtors and creditors schedule/ageing analysis',
    'Inventory listing and valuation basis',
    'Prior year audited financial statements',
    'Loan agreements and statements from lenders',
    'Related party transaction schedule and agreements',
    'Payroll summary and staff cost schedule',
    'Schedule of employee benefits',
  ],
};

/**
 * Word audit TOC: 8 section headers → request classes;
 * coded blue-linked lines → request types (code kept in the type name).
 */
const AUDIT_TOC_CATALOGUE: Record<string, string[]> = {
  'General & Corporate Governance Documents': [
    'A.1 Statutory & Constitutional Documents',
    'A.2 Governance & Minutes',
    'A.3 Prior Period & Planning Documents',
    'A.4 IT & Internal Control Environment',
  ],
  'Non-Current Assets': [
    'B.1.1 Property, Plant & Equipment (PPE)',
    'B.1.2 Intangible Assets & Goodwill',
    'B.1.3 Investment Property',
    'B.1.4 Right-of-Use Assets & Lease Arrangements (IFRS 16)',
    'B.1.5 Investments (Financial Assets)',
  ],
  'Current Assets': [
    'B.2.1 Inventory / Stock',
    'B.2.2 Trade Receivables',
    'B.2.3 Other Receivables & Prepayments',
    'B.2.4 Cash and Bank Balances',
  ],
  Equity: ['C.1 Share Capital', 'C.2 Reserves & Retained Earnings'],
  Liabilities: [
    'D.1 Borrowings — Long-Term & Short-Term',
    'D.2 Lease Liabilities',
    'D.3 Deferred Tax',
    'D.4 Employee Benefits — Pension & Gratuity',
    'D.5 Trade Payables',
    'D.6 Accruals & Other Payables',
    'D.7 Taxation Payable',
    'D.8 Dividend Payable',
    'D.9 Provisions & Contingent Liabilities',
  ],
  'Statement of Profit or Loss and Other Comprehensive Income': [
    'E.1 Revenue',
    'E.2 Cost of Sales',
    'E.3 Employee Costs',
    'E.4 Operating / Administrative Expenses',
    'E.5 Finance Income & Finance Costs',
    'E.6 Other Income',
    'E.7 Taxation Expense',
  ],
  'Other General Audit Requirements': [
    'G.1 Subsequent Events & Going Concern',
    'G.2 Related Parties & Group Reporting',
    'G.3 Compliance & Regulatory',
  ],
  'Sector-Specific Requests (Addenda)': [
    'H.1 Banking & Other Financial Institutions',
    'H.2 Microfinance Banks, Fintech & Virtual Asset Service Providers (VASP)',
    'H.3 Insurance',
    'H.4 Oil & Gas / Extractive Industries',
    'H.5 Manufacturing',
    'H.6 Telecommunications',
    'H.7 Real Estate & Construction',
    'H.8 Public Sector / Government MDAs',
    'H.9 NGOs / Not-for-Profit Organisations',
    'H.10 Trading, Retail & Distribution',
  ],
};

/**
 * Engagement audit working request list (spreadsheet):
 * middle column → request class; description → request type.
 */
const AUDIT_WORKING_CATALOGUE: Record<string, string[]> = {
  'General Ledger': ['Closure of 2024 accounting ledgers'],
  'Trial Balance': ['Final Trial Balance'],
  'Cash and cash equivalents': [
    'Bank Confirmations requests for 31 December 2024',
    'All Bank Statements',
    'Cash book (All banks)',
    'Bank reconciliation statements (All banks)',
    'Schedule of Unbanked collection',
    'Reconciliation of unbanked collection',
    'Cashflow projections',
  ],
  'Accounts receivable': [
    'Schedule of trade receivable',
    'Account receivable Confirmations',
    'Reconciliation of customer balances',
    'Receivable ageing analysis',
  ],
  'Allowance for doubtful accounts': [
    'Summary of assumptions applied on all financial assets',
  ],
  Inventory: [
    'Signed CHQ stock reconciliations',
    'Signed regional stock reconciliations',
    'Schedule of (Regional & CHQ) stock balances as at 31 December 2024',
    'Schedule of (CHQ and regional) obsolete stock as at 31 December 2024',
    'Schedule of goods in transit as at 31 December 2024',
  ],
  'Prepaid expenses': [
    'Schedule of all prepayment GL lines',
    'Schedule of Rent prepayment and agreement',
    'Schedule of staff advance',
  ],
  'Property, plant & equipment': [
    'Non current assets schedule',
    'Asset Register',
    'Schedule of Addition during the year',
    'Schedule of writeoff/bad asset',
    'List of asset held for sales/discontinue operation (IFRS 5)',
    'Capitalization policy',
    'IFRS 16 adoption disclosures',
  ],
  'Intangible assets subject to amortization': ['Asset register'],
  'Accounts payable': [
    'Reconciliation of vendor balances',
    'Schedule of trade payable; NBET and MO',
    'Settlement of NELMCO liability',
    'Schedule of sundry payable',
    'Vendor confirmation balance as at 31 December 2023',
  ],
  'Contract liability': [
    'List of 3rd party investment in electricity network',
    'All contract agreement between the KEDCO, Customer and the Contractor',
    'NERC approval of a tripartite agreement for the 3rd party investment in electricity network',
    'Schedule of repayment on contract liability',
  ],
  'Intercompany accounts': [
    'Intercompany reconciliation',
    'Schedule of Intercompany account',
  ],
  'Contingent liability/asset (IAS 37)': ['List of Litigation'],
  'Loan facility': [
    'Schedule of loan repayment-CBN NEMSF 1',
    'Schedule of loan repayment-CBN NEMSF 2 (opex loan)',
    'Schedule of loan repayment-CBN NEMSF 3 (CAPEX) (TCN loan)',
    'Schedule of loan repayment-CBN NEMS facility NMMP',
    'New loan agreement and repayment schedule if any during the year under review',
    'Evidence of remittances of CBN loan and interest repayments',
  ],
  'Accruals, provisions and other liabilities': [
    'NERC reconciliations. Analysis of VAT, WHT and FIRS subledger reconciliation',
    'WHT and VAT schedule for the period',
    'WHT and VAT payment for the period',
    'Schedule of liability due to NERC',
    'Employee benefit',
  ],
  'Income taxes': [
    'Assessment of deferred tax recoverability',
    'Receipt of payment for income tax',
  ],
  Revenue: [
    'Contract documents (MD and Non MD customers) Schedule of energy sold in the period under review from the Commercial team',
    'Schedule of Postpaid billing',
    'Schedule of prepaid billing',
    'Monthly postpaid and prepaid billing profile',
    'Reconciliation of Regional revenue cash collection',
    'Credit note issued by NBET during the year',
    'Report of revenue loss for the year signed by NERC',
    'Reconciliation between the Revenue unit and billing unit',
    'Schedule of VAT output on Revenue',
  ],
  'Cost of Sales': [
    'NBET energy Invoice',
    'MO energy Invoice',
    'Schedule of NBET and MO purchase profile',
    'Schedule of other cost of sales',
  ],
  'Salaries/payroll expenses': [
    'Schedule of Directors emoluments',
    'Schedule of monthly staff cost',
    'Schedule of staff nominal roll',
    'Joiners and leavers with copy of their employment letter',
    'Summary of earning and deduction',
  ],
  'Admin/operating expenses': ['Schedule of admin/operating expenses'],
  'Others Income': ['Schedule of all other incomes'],
  Others: ['Lawyer confirmations'],
  'Finance cost': [
    'Schedule of Interest on unpaid NBET Invoices',
    'Interest of schedule on Long term debt',
  ],
  'NREC, NBET, TCN and other reconciliations': [
    'NBET, TCN, NERC confirmation of energy outstanding',
  ],
  'IFRS 9, 15 & 16': ['ECL computation, ROU Asset and Revenue Recognition'],
};

async function ensure<T extends object>(
  em: import('@mikro-orm/postgresql').EntityManager,
  Entity: new () => T,
  where: Partial<T>,
  data: Partial<T>,
): Promise<T> {
  let row = await em.findOne(Entity, where as never);
  if (!row) {
    row = em.create(Entity, data as never);
    em.persist(row);
  }
  return row;
}

async function seedClassTypesCatalogue(
  em: import('@mikro-orm/postgresql').EntityManager,
  catalogue: Record<string, string[]>,
): Promise<number> {
  let typeCount = 0;
  for (const [className, types] of Object.entries(catalogue)) {
    const rc = await ensure(
      em,
      RequestClassEntity,
      { name: className },
      { name: className, isActive: true },
    );
    for (const typeName of types) {
      await ensure(
        em,
        RequestTypeEntity,
        { requestClass: rc, name: typeName } as never,
        {
          requestClass: rc,
          name: typeName,
          expectedDocuments: 1,
          isActive: true,
        } as never,
      );
      typeCount += 1;
    }
  }
  return typeCount;
}

async function seedRequestCatalogues(
  em: import('@mikro-orm/postgresql').EntityManager,
): Promise<void> {
  const taxTypes = await seedClassTypesCatalogue(em, TAX_CATALOGUE);
  const workingTypes = await seedClassTypesCatalogue(em, AUDIT_WORKING_CATALOGUE);
  const tocTypes = await seedClassTypesCatalogue(em, AUDIT_TOC_CATALOGUE);

  await em.flush();
  console.log(
    `Request catalogues: ${Object.keys(TAX_CATALOGUE).length} tax classes (${taxTypes} types) + ` +
      `${Object.keys(AUDIT_WORKING_CATALOGUE).length} audit working classes (${workingTypes} types) + ` +
      `${Object.keys(AUDIT_TOC_CATALOGUE).length} toc classes (${tocTypes} types).`,
  );
}

/** Idempotent seed of reference data + a default Platform Admin. Reusable by db:setup. */
export async function runSeed(orm: MikroORM): Promise<void> {
  const em = orm.em.fork();

  for (const name of ROLE_NAMES) await ensure(em, RoleEntity, { roleName: name }, { roleName: name });
  await em.flush();

  // Migrate legacy Auditor role → Staff (Auditor is no longer a login role).
  const auditorRole = await em.findOne(RoleEntity, { roleName: 'Auditor' as never });
  if (auditorRole) {
    const staffRole = await em.findOneOrFail(RoleEntity, { roleName: 'Staff' });
    const auditors = await em.find(UserEntity, { role: auditorRole });
    for (const u of auditors) u.role = staffRole;
    em.remove(auditorRole);
    await em.flush();
    console.log(`Migrated ${auditors.length} Auditor user(s) to Staff and removed Auditor role.`);
  }

  for (const name of DEPARTMENTS) await ensure(em, DepartmentEntity, { name }, { name });
  for (const name of ENGAGEMENT_TYPES) await ensure(em, EngagementTypeEntity, { name }, { name });
  await seedRequestCatalogues(em);
  for (let i = 0; i < STAGES.length; i++) {
    await ensure(em, RequestStageEntity, { name: STAGES[i] }, { name: STAGES[i], sortOrder: i });
  }
  for (let i = 0; i < STATUSES.length; i++) {
    await ensure(em, RequestStatusEntity, { name: STATUSES[i] }, { name: STATUSES[i], sortOrder: i });
  }
  for (const name of CLIENT_TYPES) await ensure(em, ClientTypeEntity, { name }, { name });
  for (const name of TITLES) await ensure(em, TitleEntity, { name }, { name });
  for (const name of GENDERS) await ensure(em, GenderEntity, { name }, { name });
  for (const name of MARITAL_STATUSES) await ensure(em, MaritalStatusEntity, { name }, { name });
  await em.flush();

  // Default Platform Admin (idempotent).
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@abdcshare.local';
  const existing = await em.findOne(UserEntity, { email: adminEmail });
  if (!existing) {
    const platformAdmin = await em.findOneOrFail(RoleEntity, { roleName: 'Platform Admin' });
    const tempPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!123';
    const admin = em.create(UserEntity, {
      role: platformAdmin,
      firstName: 'Platform',
      surname: 'Admin',
      fullName: 'Platform Admin',
      email: adminEmail,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
      isActive: true,
    } as never);
    em.persist(admin);
    await em.flush();
    console.log(`Created Platform Admin: ${adminEmail} (temp password: ${tempPassword})`);
  } else {
    console.log(`Platform Admin ${adminEmail} already exists — skipped.`);
  }
  console.log('Seed complete.');
}

// CLI entry: `ts-node seed.ts` (or compiled) — inits its own ORM.
if (require.main === module) {
  (async () => {
    const orm = await MikroORM.init(config);
    await runSeed(orm);
    await orm.close(true);
  })()
    .then(() => {
      // One-shot script: force exit so the seed container always terminates.
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
