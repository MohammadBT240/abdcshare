/* eslint-disable no-console */
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import bcrypt from 'bcryptjs';
import config from './mikro-orm.config';
import { runSeed } from './seed';
import { E2E_PASSWORD } from './e2e-personas';
import { RoleEntity } from '../modules/roles/infrastructure/persistence/role.entity';
import { DepartmentEntity } from '../modules/departments/infrastructure/persistence/department.entity';
import { UserEntity } from '../modules/users/infrastructure/persistence/user.entity';
import { ClientEntity } from '../modules/clients/infrastructure/persistence/client.entity';
import { DEMO_CLIENT, DEMO_PERSONAS, type DemoPersona } from './help-demo-personas';

export async function runSeedHelpDemo(orm: MikroORM): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('seed:help-demo refuses to run with NODE_ENV=production');
  await runSeed(orm);
  const em = orm.em.fork();
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);

  let client = await em.findOne(ClientEntity, { name: DEMO_CLIENT });
  if (!client) {
    client = em.create(ClientEntity, { name: DEMO_CLIENT, isActive: true } as never);
    em.persist(client);
  }
  for (const p of Object.values(DEMO_PERSONAS) as DemoPersona[]) {
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
    user.partnerDesignation = p.designation ?? null;
    user.client = p.role === 'Client' ? client : null;
    user.passwordHash = passwordHash;
    user.mustChangePassword = false;
    user.isActive = true;
  }
  await em.flush();
  if (!client.primaryContact) {
    client.primaryContact = await em.findOneOrFail(UserEntity, { email: DEMO_PERSONAS.client.email });
    await em.flush();
  }
  console.log(`Help demo people ready: ${Object.values(DEMO_PERSONAS).map((p) => p.email).join(', ')}`);
}

if (require.main === module) {
  (async () => {
    const orm = await MikroORM.init(config);
    try {
      await runSeedHelpDemo(orm);
    } finally {
      await orm.close(true);
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
