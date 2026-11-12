/* eslint-disable no-console */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { validateEnv } from '../config/env.schema';
import { StorageModule } from '../common/storage/storage.module';
import { HelpArticleEntity } from '../modules/help/infrastructure/persistence/help-article.entity';
import { HelpAssetEntity } from '../modules/help/infrastructure/persistence/help-asset.entity';
import { HelpCategoryEntity } from '../modules/help/infrastructure/persistence/help-category.entity';
import { HelpSyncService } from '../modules/help/sync/help-sync.service';
import { defaultHelpContentDir, loadHelpContent } from '../modules/help/sync/help-content';
import mikroOrmConfig from './mikro-orm.config';

/**
 * `pnpm help:sync [--check]` — install/refresh the default Help Center articles from docs/help.
 * `--check` only validates the Markdown (no database) and exits non-zero on problems.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    MikroOrmModule.forRoot(mikroOrmConfig),
    MikroOrmModule.forFeature([HelpCategoryEntity, HelpArticleEntity, HelpAssetEntity]),
    StorageModule,
  ],
  providers: [HelpSyncService],
})
class HelpSyncCliModule {}

async function main(): Promise<void> {
  if (process.argv.includes('--check')) {
    const dir = process.env.HELP_CONTENT_DIR || defaultHelpContentDir();
    const { categories, articles, errors } = loadHelpContent(dir);
    console.log(`${categories.length} categories, ${articles.length} articles in ${dir}`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exitCode = errors.length ? 1 : 0;
    return;
  }
  process.env.HELP_SYNC_ON_START = 'false';
  const app = await NestFactory.createApplicationContext(HelpSyncCliModule, { logger: ['error', 'warn', 'log'] });
  try {
    const sync = app.get(HelpSyncService);
    const result = await sync.sync();
    sync.logResult(result);
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
