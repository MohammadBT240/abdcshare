import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, raw } from '@mikro-orm/postgresql';
import type { FilterQuery } from '@mikro-orm/postgresql';
import { hasPermission, type Paginated, type PartnerDesignation, type RoleName } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { HelpCategoryEntity } from './infrastructure/persistence/help-category.entity';
import { HelpArticleEntity } from './infrastructure/persistence/help-article.entity';
import type {
  CreateHelpCategoryDto,
  UpdateHelpCategoryDto,
} from './presentation/dto/help-category.dto';
import { HelpCategoryResponseDto } from './presentation/dto/help-category.dto';
import type {
  CreateHelpArticleDto,
  HelpArticleListQueryDto,
  UpdateHelpArticleDto,
} from './presentation/dto/help-article.dto';
import {
  HelpArticleResponseDto,
  HelpArticleSummaryDto,
  HelpCategoryWithArticlesDto,
} from './presentation/dto/help-article.dto';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { HelpFeedbackEntity } from './infrastructure/persistence/help-feedback.entity';
import { articleContentHash } from './sync/help-content';
import { HelpSyncService } from './sync/help-sync.service';
import type {
  HelpFeedbackStatsDto,
  HelpSearchResultDto,
} from './presentation/dto/help-reader.dto';

interface ViewerContext {
  userId?: string;
  role: RoleName;
  partnerDesignation?: PartnerDesignation | null;
}

/** Highlight markers for search snippets (the web turns them into <mark>; never HTML from SQL). */
export const HL_START = '\u27e6';
export const HL_END = '\u27e7';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class HelpService {
  constructor(
    private readonly em: EntityManager,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly sync: HelpSyncService,
  ) {}

  private toCategoryDto(c: HelpCategoryEntity): HelpCategoryResponseDto {
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      order: c.order,
      icon: c.icon ?? null,
      description: c.description ?? null,
      source: c.source,
    };
  }

  async createCategory(dto: CreateHelpCategoryDto): Promise<HelpCategoryResponseDto> {
    if (await this.em.findOne(HelpCategoryEntity, { slug: dto.slug })) {
      throw new ConflictException('A help category with this slug already exists');
    }
    const category = this.em.create(HelpCategoryEntity, {
      name: dto.name,
      slug: dto.slug,
      order: dto.order ?? 0,
      icon: dto.icon ?? null,
    });
    await this.em.persistAndFlush(category);
    return this.toCategoryDto(category);
  }

  async listCategoriesAdmin(): Promise<HelpCategoryResponseDto[]> {
    const rows = await this.em.find(HelpCategoryEntity, {}, { orderBy: { order: 'asc', name: 'asc' } });
    return rows.map((c) => this.toCategoryDto(c));
  }

  async updateCategory(id: string, dto: UpdateHelpCategoryDto): Promise<HelpCategoryResponseDto> {
    const category = await this.em.findOneOrFail(HelpCategoryEntity, { id });
    if (dto.slug != null && dto.slug !== category.slug) {
      if (await this.em.findOne(HelpCategoryEntity, { slug: dto.slug, id: { $ne: id } })) {
        throw new ConflictException('A help category with this slug already exists');
      }
      category.slug = dto.slug;
    }
    if (dto.name != null) category.name = dto.name;
    if (dto.order != null) category.order = dto.order;
    if (dto.icon !== undefined) category.icon = dto.icon ?? null;
    await this.em.flush();
    return this.toCategoryDto(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.em.findOneOrFail(HelpCategoryEntity, { id });
    // The FK has no ON DELETE rule, so a category that still has articles would raise a
    // raw constraint violation (a 500) instead of a meaningful client error.
    const articleCount = await this.em.count(HelpArticleEntity, { category: id });
    if (articleCount > 0) {
      throw new ConflictException(
        'Move or delete the articles in this category before deleting it',
      );
    }
    await this.em.removeAndFlush(category);
  }

  private canManage(viewer: ViewerContext): boolean {
    return hasPermission(viewer.role, 'help:manage', viewer.partnerDesignation);
  }

  /** Empty = everyone; otherwise the viewer's role or partner designation must be listed. */
  private isVisibleTo(article: HelpArticleEntity, viewer: ViewerContext): boolean {
    if (article.visibleToRoles.length === 0) return true;
    if (article.visibleToRoles.includes(viewer.role)) return true;
    return Boolean(viewer.partnerDesignation && article.visibleToRoles.includes(viewer.partnerDesignation));
  }

  /** Raw SQL form of {@link isVisibleTo} for hand-written queries (alias `a`). */
  private visibleSql(viewer: ViewerContext): { sql: string; params: unknown[] } {
    const tokens = [viewer.role, ...(viewer.partnerDesignation ? [viewer.partnerDesignation] : [])];
    return {
      sql: `(jsonb_array_length(a.visible_to_roles) = 0 or ${tokens.map(() => 'a.visible_to_roles @> ?::jsonb').join(' or ')})`,
      params: tokens.map((t) => JSON.stringify([t])),
    };
  }

  /**
   * SQL equivalent of {@link isVisibleTo}, so role filtering happens in the database
   * (before any LIMIT) rather than in memory afterwards.
   *
   * `visible_to_roles` is a `jsonb` column, not a native Postgres array, so MikroORM's
   * array operators (`$contains` and friends) don't apply — this needs a raw fragment
   * using the jsonb containment operator plus an emptiness check ("empty = everyone").
   */
  private visibleToRolesWhere(viewer: ViewerContext): Record<string, unknown> {
    const tokens = [viewer.role, ...(viewer.partnerDesignation ? [viewer.partnerDesignation] : [])];
    return {
      [raw(
        (alias) =>
          `(jsonb_array_length(${alias}.visible_to_roles) = 0 or ${tokens.map(() => `${alias}.visible_to_roles @> ?::jsonb`).join(' or ')})`,
        tokens.map((t) => JSON.stringify([t])),
      )]: true,
    };
  }

  /** A default (repo-shipped) article whose content an admin changed — the sync leaves it alone. */
  private isEdited(a: HelpArticleEntity): boolean {
    if (a.source !== 'default' || !a.defaultHash) return false;
    return articleContentHash(a) !== a.defaultHash;
  }

  private async toArticleDto(a: HelpArticleEntity, viewer?: ViewerContext): Promise<HelpArticleResponseDto> {
    const category = a.category;
    let related: HelpArticleSummaryDto[] = [];
    if (a.related?.length) {
      const rows = await this.em.find(
        HelpArticleEntity,
        { slug: { $in: a.related }, ...(viewer && !this.canManage(viewer) ? { status: 'published' as const } : {}) },
        { populate: ['category'] },
      );
      related = a.related
        .map((slug) => rows.find((r) => r.slug === slug))
        .filter((r): r is HelpArticleEntity => Boolean(r) && (!viewer || this.isVisibleTo(r!, viewer)))
        .map((r) => this.toSummaryDto(r));
    }
    let myFeedback: boolean | null = null;
    if (viewer?.userId) {
      const fb = await this.em.findOne(HelpFeedbackEntity, { article: a.id, user: viewer.userId });
      myFeedback = fb ? fb.helpful : null;
    }
    return {
      id: a.id,
      categoryId: category.id,
      category: { id: category.id, name: category.name, slug: category.slug },
      title: a.title,
      slug: a.slug,
      summary: a.summary ?? null,
      bodyJson: (await this.resolveImageUrls(a.bodyJson)) as Record<string, unknown>,
      visibleToRoles: a.visibleToRoles,
      status: a.status,
      order: a.order,
      source: a.source,
      edited: this.isEdited(a),
      related,
      myFeedback,
      updatedAt: a.updatedAt,
      publishedAt: a.publishedAt ?? null,
    };
  }

  async uploadImage(dto: { fileName: string; contentType: string; data: string }): Promise<{ storageKey: string }> {
    if (!IMAGE_TYPES.has(dto.contentType)) {
      throw new BadRequestException('Use a JPEG, PNG, or WebP image');
    }
    const body = Buffer.from(dto.data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!body.length) throw new BadRequestException('Image data is empty');
    if (body.length > MAX_IMAGE_BYTES) throw new BadRequestException('Image must be 5 MB or smaller');

    return this.storage.upload({
      keyPrefix: 'help-images',
      fileName: dto.fileName,
      contentType: dto.contentType,
      body,
    });
  }

  /** Walk a Tiptap/ProseMirror JSON doc, replacing image `storageKey` attrs with fresh presigned URLs. */
  private async resolveImageUrls(node: unknown): Promise<unknown> {
    if (Array.isArray(node)) {
      return Promise.all(node.map((n) => this.resolveImageUrls(n)));
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (obj.type === 'image' && obj.attrs && typeof obj.attrs === 'object') {
        const attrs = obj.attrs as Record<string, unknown>;
        const storageKey = attrs.storageKey;
        if (typeof storageKey === 'string' && storageKey) {
          return { ...obj, attrs: { ...attrs, src: await this.storage.presignDownload(storageKey) } };
        }
      }
      if (obj.content) {
        return { ...obj, content: await this.resolveImageUrls(obj.content) };
      }
    }
    return node;
  }

  private toSummaryDto(a: HelpArticleEntity): HelpArticleSummaryDto {
    return {
      id: a.id,
      categoryId: a.category.id,
      title: a.title,
      slug: a.slug,
      summary: a.summary ?? null,
      status: a.status,
      order: a.order,
      source: a.source,
      edited: this.isEdited(a),
      updatedAt: a.updatedAt,
    };
  }

  async createArticle(dto: CreateHelpArticleDto, actorId: string): Promise<HelpArticleResponseDto> {
    if (await this.em.findOne(HelpArticleEntity, { slug: dto.slug })) {
      throw new ConflictException('A help article with this slug already exists');
    }
    const category = await this.em.findOneOrFail(HelpCategoryEntity, { id: dto.categoryId });
    const article = this.em.create(HelpArticleEntity, {
      category,
      title: dto.title,
      slug: dto.slug,
      bodyJson: dto.bodyJson,
      bodyText: dto.bodyText,
      summary: dto.summary ?? null,
      visibleToRoles: dto.visibleToRoles ?? [],
      order: dto.order ?? 0,
      createdBy: this.em.getReference(UserEntity, actorId),
    });
    await this.em.persistAndFlush(article);
    return this.toArticleDto(article);
  }

  async updateArticle(id: string, dto: UpdateHelpArticleDto): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOneOrFail(HelpArticleEntity, { id }, { populate: ['category'] });
    if (dto.slug != null && dto.slug !== article.slug) {
      if (await this.em.findOne(HelpArticleEntity, { slug: dto.slug, id: { $ne: id } })) {
        throw new ConflictException('A help article with this slug already exists');
      }
      article.slug = dto.slug;
    }
    if (dto.categoryId != null) {
      article.category = await this.em.findOneOrFail(HelpCategoryEntity, { id: dto.categoryId });
    }
    if (dto.title != null) article.title = dto.title;
    if (dto.summary !== undefined) article.summary = dto.summary || null;
    if (dto.bodyJson != null) article.bodyJson = dto.bodyJson;
    if (dto.bodyText != null) article.bodyText = dto.bodyText;
    if (dto.visibleToRoles != null) article.visibleToRoles = dto.visibleToRoles;
    if (dto.order != null) article.order = dto.order;
    await this.em.flush();
    return this.toArticleDto(article);
  }

  async publishArticle(id: string): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOneOrFail(HelpArticleEntity, { id }, { populate: ['category'] });
    article.status = 'published';
    article.publishedAt = new Date();
    await this.em.flush();
    return this.toArticleDto(article);
  }

  async unpublishArticle(id: string): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOneOrFail(HelpArticleEntity, { id }, { populate: ['category'] });
    article.status = 'draft';
    await this.em.flush();
    return this.toArticleDto(article);
  }

  async deleteArticle(id: string): Promise<void> {
    const article = await this.em.findOneOrFail(HelpArticleEntity, { id });
    await this.em.removeAndFlush(article);
  }

  async listArticlesAdmin(query: HelpArticleListQueryDto): Promise<Paginated<HelpArticleSummaryDto>> {
    const where: Record<string, unknown> = {};
    if (query.categoryId) where.category = query.categoryId;
    if (query.status) where.status = query.status;
    if (query.q) where.title = { $ilike: `%${query.q}%` };

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      HelpArticleEntity,
      where as FilterQuery<HelpArticleEntity>,
      { populate: ['category'], orderBy: { order: 'asc', title: 'asc' }, limit, offset },
    );
    return paginated(rows.map((a) => this.toSummaryDto(a)), total, page, pageSize);
  }

  /** Authoring-only fetch by id — no status/role filtering, the route is `help:manage` guarded. */
  async getArticleByIdAdmin(id: string): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOne(HelpArticleEntity, { id }, { populate: ['category'] });
    if (!article) throw new NotFoundException('Help article not found');
    return this.toArticleDto(article);
  }

  async getCategoriesForViewer(viewer: ViewerContext): Promise<HelpCategoryWithArticlesDto[]> {
    const categories = await this.em.find(HelpCategoryEntity, {}, { orderBy: { order: 'asc', name: 'asc' } });
    const articles = await this.em.find(
      HelpArticleEntity,
      { status: 'published' },
      { populate: ['category'], orderBy: { order: 'asc', title: 'asc' } },
    );
    const visible = articles.filter((a) => this.isVisibleTo(a, viewer));
    return categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        order: c.order,
        icon: c.icon ?? null,
        description: c.description ?? null,
        articles: visible.filter((a) => a.category.id === c.id).map((a) => this.toSummaryDto(a)),
      }))
      // A category with nothing the viewer may read is noise (and a small hint that
      // role-scoped content exists) — drop it rather than render an empty accordion row.
      .filter((c) => c.articles.length > 0);
  }

  async getArticleBySlug(slug: string, viewer: ViewerContext): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOne(HelpArticleEntity, { slug }, { populate: ['category'] });
    if (!article) throw new NotFoundException('Help article not found');
    const manage = this.canManage(viewer);
    if (!manage && article.status !== 'published') throw new NotFoundException('Help article not found');
    if (!manage && !this.isVisibleTo(article, viewer)) throw new NotFoundException('Help article not found');
    return this.toArticleDto(article, viewer);
  }

  /**
   * Full-text search (HC5): prefix-matched terms over title (A), summary (B) and body (C),
   * ranked, with a highlighted snippet. Falls back to ILIKE when the query has no searchable
   * words (e.g. only stop words) or FTS finds nothing.
   */
  async searchArticles(q: string, viewer: ViewerContext): Promise<HelpSearchResultDto[]> {
    const trimmed = q.trim().slice(0, 200);
    if (!trimmed) return [];
    const vis = this.visibleSql(viewer);
    const words = (trimmed.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
    const tsquery = words.map((w) => `${w}:*`).join(' & ');
    const headline = `MaxFragments=1, MaxWords=28, MinWords=12, ShortWord=2, StartSel=${HL_START}, StopSel=${HL_END}`;
    type Row = { id: string; slug: string; title: string; summary: string | null; category: string; snippet: string | null };

    let rows: Row[] = [];
    if (tsquery) {
      rows = await this.em.execute<Row[]>(
        `with q as (select to_tsquery('english', ?) as query),
              hits as (
                select a.id, ts_rank(a.search_vector, q.query) as rank
                  from help_articles a, q
                 where a.status = 'published' and a.search_vector @@ q.query and ${vis.sql}
                 order by rank desc, a.title asc
                 limit 20)
         select a.id, a.slug, a.title, a.summary, c.name as category,
                ts_headline('english', a.body_text, q.query, ?) as snippet
           from hits h join help_articles a on a.id = h.id join help_categories c on c.id = a.category_id, q
          order by h.rank desc, a.title asc`,
        [tsquery, ...vis.params, headline],
      );
    }
    if (rows.length === 0) {
      const term = `%${trimmed.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      rows = await this.em.execute<Row[]>(
        `select a.id, a.slug, a.title, a.summary, c.name as category, null as snippet
           from help_articles a join help_categories c on c.id = a.category_id
          where a.status = 'published' and (a.title ilike ? or a.body_text ilike ?) and ${vis.sql}
          order by a.title asc limit 20`,
        [term, term, ...vis.params],
      );
    }
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      category: r.category,
      // Only keep a snippet that actually highlights something.
      snippet: r.snippet && r.snippet.includes(HL_START) ? r.snippet.replace(/\s+/g, ' ').trim() : null,
    }));
  }

  // ------------------------------------------------------------------ feedback (HC4)

  async setFeedback(slug: string, dto: { helpful: boolean; comment?: string | null }, viewer: ViewerContext & { userId: string }): Promise<void> {
    const article = await this.em.findOne(HelpArticleEntity, { slug, status: 'published' }, { populate: ['category'] });
    if (!article || !this.isVisibleTo(article, viewer)) throw new NotFoundException('Help article not found');
    const comment = dto.comment?.trim() ? dto.comment.trim().slice(0, 2000) : null;
    await this.em.upsert(
      HelpFeedbackEntity,
      { id: randomUUID(), article: article.id, user: viewer.userId, helpful: dto.helpful, comment, updatedAt: new Date() } as never,
      { onConflictFields: ['article', 'user'], onConflictMergeFields: ['helpful', 'comment', 'updatedAt'] },
    );
  }

  async feedbackStats(): Promise<HelpFeedbackStatsDto[]> {
    const rows = await this.em.execute<
      { id: string; slug: string; title: string; helpful: number; not_helpful: number; last_at: Date | null }[]
    >(
      `select a.id, a.slug, a.title,
              count(*) filter (where f.helpful)::int as helpful,
              count(*) filter (where not f.helpful)::int as not_helpful,
              max(f.updated_at) as last_at
         from help_feedback f join help_articles a on a.id = f.article_id
        group by a.id
        order by count(*) filter (where not f.helpful) desc, max(f.updated_at) desc
        limit 200`,
    );
    const comments = await this.em.execute<{ article_id: string; comment: string; helpful: boolean; updated_at: Date; name: string }[]>(
      `select f.article_id, f.comment, f.helpful, f.updated_at, u.full_name as name
         from help_feedback f join users u on u.id = f.user_id
        where f.comment is not null
        order by f.updated_at desc limit 500`,
    );
    return rows.map((r) => ({
      articleId: r.id,
      slug: r.slug,
      title: r.title,
      helpful: Number(r.helpful),
      notHelpful: Number(r.not_helpful),
      lastAt: r.last_at ? new Date(r.last_at) : null,
      comments: comments
        .filter((c) => c.article_id === r.id)
        .slice(0, 10)
        .map((c) => ({ comment: c.comment, helpful: c.helpful, by: c.name, at: new Date(c.updated_at) })),
    }));
  }

  // ------------------------------------------------------------------ defaults (HC1)

  /** Throw away an admin's edits to a default article and re-install the shipped version. */
  async restoreDefault(id: string): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOneOrFail(HelpArticleEntity, { id });
    if (article.source !== 'default') throw new BadRequestException('Only built-in articles can be restored');
    article.defaultHash = null;
    await this.em.flush();
    const result = await this.sync.sync();
    if (result.skipped === 'locked') throw new ConflictException('A help sync is already running — try again in a moment');
    this.em.clear();
    const fresh = await this.em.findOneOrFail(HelpArticleEntity, { id }, { populate: ['category'] });
    if (fresh.defaultHash == null) throw new NotFoundException('This article is no longer shipped with the app');
    return this.toArticleDto(fresh);
  }

  async runSync() {
    return this.sync.sync();
  }
}
