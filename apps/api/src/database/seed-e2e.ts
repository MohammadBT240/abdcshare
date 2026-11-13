/* eslint-disable no-console */
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import bcrypt from 'bcryptjs';
import config from './mikro-orm.config';
import { runSeed } from './seed';
import { RoleEntity } from '../modules/roles/infrastructure/persistence/role.entity';
import { DepartmentEntity } from '../modules/departments/infrastructure/persistence/department.entity';
import { UserEntity } from '../modules/users/infrastructure/persistence/user.entity';
import { ClientEntity } from '../modules/clients/infrastructure/persistence/client.entity';
import { E2E_PASSWORD, PERSONAS } from './e2e-personas';

/**
 * Test personas for the Playwright suite (e2e/). Idempotent: re-running resets their
 * password, role, department and active flag. Never runs in production.
 */
export async function runSeedE2e(orm: MikroORM): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:e2e refuses to run with NODE_ENV=production');
  }
  await runSeed(orm);
  const em = orm.em.fork();
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);

  let client = await em.findOne(ClientEntity, { name: 'E2E Test Client Ltd' });
  if (!client) {
    client = em.create(ClientEntity, { name: 'E2E Test Client Ltd', isActive: true } as never);
    em.persist(client);
  }

  for (const p of Object.values(PERSONAS)) {
    const role = await em.findOneOrFail(RoleEntity, { roleName: p.role });
    const department = p.department ? await em.findOneOrFail(DepartmentEntity, { name: p.department }) : null;
    let user = await em.findOne(UserEntity, { email: p.email });
    if (!user) {
      user = em.create(UserEntity, {
        email: p.email,
        firstName: p.firstName,
        surname: p.surname,
        fullName: `${p.firstName} ${p.surname}`,
        role,
        passwordHash,
      } as never);
      em.persist(user);
    }
    user.role = role;
    user.department = department;
    user.client = p.role === 'Client' ? client : null;
    user.passwordHash = passwordHash;
    user.mustChangePassword = false;
    user.isActive = true;
  }
  await em.flush();
  const clientUser = await em.findOneOrFail(UserEntity, { email: PERSONAS.client.email });
  if (!client.primaryContact) {
    client.primaryContact = clientUser;
    await em.flush();
  }
  console.log(`E2E personas ready: ${Object.values(PERSONAS).map((p) => p.email).join(', ')}`);
}

if (require.main === module) {
  (async () => {
    const orm = await MikroORM.init(config);
    try {
      await runSeedE2e(orm);
    } finally {
      await orm.close(true);
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
