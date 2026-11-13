import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { STORAGE, type StoragePort } from '../../../common/storage/storage.port';
import { HelpArticleEntity } from '../infrastructure/persistence/help-article.entity';
import { HelpAssetEntity } from '../infrastructure/persistence/help-asset.entity';
import { HelpCategoryEntity } from '../infrastructure/persistence/help-category.entity';
import {
  articleContentHash,
  defaultHelpContentDir,
  loadHelpContent,
  swapAssetKeys,
  type HelpImageRef,
  type LoadedHelpContent,
} from './help-content';

export interface HelpSyncResult {
  skipped?: 'locked' | 'no-content';
  created: string[];
  updated: string[];
  unchanged: number;
  /** Default articles an admin has edited — left alone until "Restore default". */
  keptEdited: string[];
  /** A custom article already uses the slug. */
  conflicts: string[];
  /** Default articles no longer in docs/help — unpublished unless edited. */
  retired: string[];
  imagesUploaded: number;
  errors: string[];
}

/** Arbitrary constant for pg_try_advisory_xact_lock — one sync at a time across API replicas. */
const SYNC_LOCK = 724_310_551;

/**
 * Upserts the default Help Center articles from `docs/help` (HC1). Runs on API start
 * (HELP_SYNC_ON_START, default on) and from `pnpm help:sync`. An article an admin has edited
 * in the app is never overwritten: its stored content no longer matches `default_hash`.
 */
@Injectable()
export class HelpSyncService implements OnApplicationBootstrap {
  private readonly log = new Logger(HelpSyncService.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly config: ConfigService,
  ) {}

  contentDir(): string {
    return this.config.get<string>('HELP_CONTENT_DIR') || defaultHelpContentDir();
  }

  onApplicationBootstrap(): void {
    if (this.config.get<string>('HELP_SYNC_ON_START', 'true') === 'false') return;
    // Don't hold up boot; a failure only means yesterday's help content stays in place.
    setTimeout(() => {
      this.sync()
        .then((r) => this.logResult(r))
        .catch((err: unknown) => this.log.error(`Help sync failed: ${(err as Error).message}`));
    }, 0);
  }

  logResult(r: HelpSyncResult): void {
    if (r.skipped) {
      this.log.log(`Help sync skipped (${r.skipped})`);
      return;
    }
    this.log.log(
      `Help sync: ${r.created.length} created, ${r.updated.length} updated, ${r.unchanged} unchanged, ` +
        `${r.keptEdited.length} kept (edited in app), ${r.retired.length} retired, ${r.imagesUploaded} images uploaded`,
    );
    for (const c of r.conflicts) this.log.warn(`Help sync: slug "${c}" is used by a custom article — default not installed`);
    for (const e of r.errors) this.log.warn(`Help content: ${e}`);
  }

  /** `retire: false` leaves default articles that aren't in `dir` alone (tests that sync a partial folder). */
  async sync(dir = this.contentDir(), opts: { retire?: boolean } = {}): Promise<HelpSyncResult> {
    const content = loadHelpContent(dir);
    const result: HelpSyncResult = {
      created: [],
      updated: [],
      unchanged: 0,
      keptEdited: [],
      conflicts: [],
      retired: [],
      imagesUploaded: 0,
      errors: content.errors,
    };
    if (content.articles.length === 0) return { ...result, skipped: 'no-content' };

    // Query logging off: in development the full article bodies and ~100 image hashes would
    // flood the console on every start. The one-line summary in logResult() is what matters.
    return this.em.fork({ loggerContext: { enabled: false } }).transactional(async (em) => {
      const [lock] = await em.execute<{ ok: boolean }[]>('select pg_try_advisory_xact_lock(?) as ok', [SYNC_LOCK]);
      if (!lock?.ok) return { ...result, skipped: 'locked' as const };

      const keys = await this.uploadImages(em, content, result);
      const categories = await this.syncCategories(em, content);
      await this.syncArticles(em, content, categories, keys, result, opts.retire ?? true);
      await em.flush();
      return result;
    });
  }

  private async uploadImages(em: EntityManager, content: LoadedHelpContent, result: HelpSyncResult): Promise<Map<string, string>> {
    const refs = new Map<string, HelpImageRef>();
    for (const a of content.articles) for (const i of a.images) refs.set(i.hash, i);
    const keys = new Map<string, string>();
    if (refs.size === 0) return keys;
    const known = await em.find(HelpAssetEntity, { hash: { $in: [...refs.keys()] } });
    for (const k of known) keys.set(k.hash, k.storageKey);

    for (const ref of refs.values()) {
      const existing = keys.get(ref.hash);
      if (existing && (await this.storage.head(existing))) continue;
      const { storageKey } = await this.storage.upload({
        keyPrefix: 'help-images/defaults',
        fileName: `${ref.hash.slice(0, 16)}${path.extname(ref.absPath).toLowerCase()}`,
        contentType: ref.contentType,
        body: readFileSync(ref.absPath),
      });
      keys.set(ref.hash, storageKey);
      await em.upsert(HelpAssetEntity, { hash: ref.hash, storageKey, createdAt: new Date() });
      result.imagesUploaded += 1;
    }
    return keys;
  }

  private async syncCategories(em: EntityManager, content: LoadedHelpContent): Promise<Map<string, HelpCategoryEntity>> {
    const existing = await em.find(HelpCategoryEntity, { slug: { $in: content.categories.map((c) => c.slug) } });
    const bySlug = new Map(existing.map((c) => [c.slug, c]));
    for (const c of content.categories) {
      const row = bySlug.get(c.slug);
      if (!row) {
        bySlug.set(
          c.slug,
          em.create(HelpCategoryEntity, { slug: c.slug, name: c.name, order: c.order, icon: c.icon, description: c.description, source: 'default' }),
        );
      } else if (row.source === 'default') {
        Object.assign(row, { name: c.name, order: c.order, icon: c.icon, description: c.description });
      }
    }
    return bySlug;
  }

  private async syncArticles(
    em: EntityManager,
    content: LoadedHelpContent,
    categories: Map<string, HelpCategoryEntity>,
    keys: Map<string, string>,
    result: HelpSyncResult,
    retire: boolean,
  ): Promise<void> {
    const slugs = content.articles.map((a) => a.slug);
    const rows = await em.find(HelpArticleEntity, retire ? { $or: [{ slug: { $in: slugs } }, { source: 'default' }] } : { slug: { $in: slugs } });
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const now = new Date();

    for (const a of content.articles) {
      const category = categories.get(a.categorySlug)!;
      const bodyJson = swapAssetKeys(a.bodyJson, keys) as unknown as Record<string, unknown>;
      const fields = { title: a.title, summary: a.summary, bodyJson, visibleToRoles: a.visibleToRoles };
      const hash = articleContentHash(fields);
      const row = bySlug.get(a.slug);

      if (!row) {
        em.create(HelpArticleEntity, {
          ...fields,
          slug: a.slug,
          category,
          bodyText: a.bodyText,
          related: a.related,
          order: a.order,
          source: 'default',
          defaultHash: hash,
          status: 'published',
          publishedAt: now,
          createdBy: null,
        });
        result.created.push(a.slug);
        continue;
      }
      if (row.source !== 'default') {
        result.conflicts.push(a.slug);
        continue;
      }
      const current = articleContentHash({ title: row.title, summary: row.summary, bodyJson: row.bodyJson, visibleToRoles: row.visibleToRoles });
      if (row.defaultHash && current !== row.defaultHash) {
        result.keptEdited.push(a.slug);
        continue;
      }
      const placementChanged = row.category.id !== category.id || row.order !== a.order || JSON.stringify(row.related) !== JSON.stringify(a.related);
      if (current === hash && row.defaultHash === hash && !placementChanged) {
        result.unchanged += 1;
        continue;
      }
      Object.assign(row, { ...fields, bodyText: a.bodyText, related: a.related, order: a.order, category, defaultHash: hash });
      result.updated.push(a.slug);
    }

    // Default articles that were removed from docs/help.
    const shipped = new Set(content.articles.map((a) => a.slug));
    for (const row of rows) {
      if (row.source !== 'default' || shipped.has(row.slug) || row.status !== 'published') continue;
      const current = articleContentHash({ title: row.title, summary: row.summary, bodyJson: row.bodyJson, visibleToRoles: row.visibleToRoles });
      if (row.defaultHash && current !== row.defaultHash) continue; // edited — an admin owns it now
      row.status = 'draft';
      row.publishedAt = null;
      result.retired.push(row.slug);
    }
  }
}
