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
import { RequestStageEntity } from '../modules/request-stages/infrastructure/persistence/request-stage.entity';
import { RequestStatusEntity } from '../modules/request-statuses/infrastructure/persistence/request-status.entity';
import { ClientTypeEntity } from '../modules/reference/infrastructure/persistence/client-types.entity';
import { TitleEntity } from '../modules/reference/infrastructure/persistence/titles.entity';
import { GenderEntity } from '../modules/reference/infrastructure/persistence/genders.entity';
import { MaritalStatusEntity } from '../modules/reference/infrastructure/persistence/marital-statuses.entity';
import { UserEntity } from '../modules/users/infrastructure/persistence/user.entity';

const DEPARTMENTS = ['Assurance', 'Tax', 'Advisory', 'Business Development', 'Shared Services', 'Other'];
const ENGAGEMENT_TYPES = ['Statutory Audit', 'Tax Compliance', 'Advisory'];
const REQUEST_CLASSES = ['Cash & Bank', 'Receivables', 'Payables', 'Revenue', 'PP&E', 'Inventory'];
const CLIENT_TYPES = ['Individual', 'Corporate'];
const TITLES = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'];
const GENDERS = ['Male', 'Female', 'Other'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];
const STAGES = ['Not Started', 'In Progress', 'Submitted', 'Reviewed'];
const STATUSES = ['Open', 'Pending Client', 'Accepted', 'Returned', 'Closed'];

async function ensure<T extends object>(em: import('@mikro-orm/postgresql').EntityManager, Entity: new () => T, where: Partial<T>, data: Partial<T>): Promise<T> {
  let row = await em.findOne(Entity, where as never);
  if (!row) {
    row = em.create(Entity, data as never);
    em.persist(row);
  }
  return row;
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
  for (const name of REQUEST_CLASSES) await ensure(em, RequestClassEntity, { name }, { name });
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
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
