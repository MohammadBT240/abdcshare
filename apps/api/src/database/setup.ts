/* eslint-disable no-console */
import 'dotenv/config';
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import ormConfig from './mikro-orm.config';
import { runSeed } from './seed';

/**
 * One-command DB bootstrap — "set DATABASE_URL and it takes care of everything":
 *   1. create the database if it doesn't exist (ensureDatabase)
 *   2. generate the initial migration from entities if none exist yet (dev convenience)
 *   3. apply all pending migrations
 *   4. seed reference data + default Platform Admin (skipped in production / with SKIP_SEED=1)
 *
 * The database USER in DATABASE_URL must already exist in your Postgres; the DATABASE is created for you.
 */
async function main(): Promise<void> {
  // init without connecting so we can create the DB first if needed
  const orm = await MikroORM.init({ ...ormConfig, connect: false });

  console.log('Ensuring database exists...');
  await orm.schema.ensureDatabase();
  await orm.connect();

  const migrator = orm.migrator;
  const executed = await migrator.getExecutedMigrations();
  const pending = await migrator.getPendingMigrations();
  if (executed.length === 0 && pending.length === 0) {
    console.log('No migrations found — generating initial migration from entities...');
    await migrator.createInitialMigration();
  }

  console.log('Applying migrations...');
  await migrator.up();

  const skipSeed = process.env.SKIP_SEED === '1' || process.env.NODE_ENV === 'production';
  if (skipSeed) {
    console.log('Skipping seed (production or SKIP_SEED=1).');
  } else {
    await runSeed(orm);
  }

  await orm.close(true);
  console.log('DB setup complete.');
}

main()
  .then(() => {
    // One-shot script: force exit so a lingering connection handle can never
    // keep the container alive (the compose migrate step must terminate).
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
