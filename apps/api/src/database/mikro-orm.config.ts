import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';

export default defineConfig({
  clientUrl: process.env.DATABASE_URL,
  entities: ['dist/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],
  extensions: [Migrator],
  migrations: { path: 'dist/migrations', pathTs: 'src/migrations', tableName: 'mikro_orm_migrations' },
  debug: process.env.NODE_ENV === 'development',
});
