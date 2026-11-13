import 'dotenv/config';
import path from 'node:path';
import { MikroORM } from '@mikro-orm/postgresql';

/** A real MikroORM against DATABASE_URL for `*.int-spec.ts` (entities discovered from source). */
export async function intOrm(): Promise<MikroORM> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for integration tests');
  return MikroORM.init({
    clientUrl: process.env.DATABASE_URL,
    entities: [path.join(__dirname, '..', '**', '*.entity.ts')],
    entitiesTs: [path.join(__dirname, '..', '**', '*.entity.ts')],
    preferTs: true,
    allowGlobalContext: false,
    debug: false,
  });
}
