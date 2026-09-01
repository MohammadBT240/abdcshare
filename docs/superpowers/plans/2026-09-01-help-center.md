# Help Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a role-scoped, in-app Help Center — a searchable article library authored by Platform/Super Admin through a rich-text editor, plus contextual "?" entry points on complex pages.

**Architecture:** A new `help` NestJS module (DDD-style, mirroring `apps/api/src/modules/audit`) backed by two MikroORM entities (`HelpCategoryEntity`, `HelpArticleEntity`). Reading endpoints are open to any authenticated role and filtered by each article's `visibleToRoles`; writing endpoints require the new `help:manage` permission. The web side adds a `features/help/` module (mirroring `features/activity-log/`) with a public `/help` reader, an `/admin/help` authoring UI built on Tiptap, and a reusable `HelpTip` contextual drawer.

**Tech Stack:** NestJS + MikroORM (Postgres) on the API; Next.js App Router + TanStack Query + Tailwind/shadcn on the web; Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`) — new dependency, no rich-text editor exists in the repo today.

**Spec:** `docs/superpowers/specs/2026-09-01-help-center-design.md`

## Global Constraints

- No article revision history — `updatedAt` + draft/published status only.
- No video embeds — images only.
- Search is plain Postgres `ILIKE` over `title` + `bodyText` — no `tsvector`.
- No "was this helpful" feedback mechanism.
- Contextual `HelpTip` placements are wired by hand, one article slug per placement — no automatic matching.
- `help:manage` is granted to `Platform Admin` and `Super Admin` only (`packages/shared/src/permissions.ts`).
- Reading routes carry no `@RequirePermission` — every authenticated role can reach them; visibility is filtered by `visibleToRoles` (empty array = all roles) and `status === 'published'` (unless the caller has `help:manage`, who may preview drafts).
- Follow existing module conventions exactly: entities under `infrastructure/persistence/`, DTOs under `presentation/dto/`, `class-validator` for validation, `EntityManager` injected directly into services (no repository classes), MikroORM migrations generated via `pnpm migration:create` (never hand-authored raw SQL) then reviewed and committed.
- The web app has no component-testing infra (`apps/web/jest.config.js` only runs one hand-picked `.spec.ts`, `testEnvironment: 'node'`, no React Testing Library). Frontend tasks get real pure-function unit tests where logic is pure, and a manual browser verification step where it isn't — do not invent React component tests that cannot run.
- `pnpm --filter @abdcshare/web test` does **not** run Jest — `apps/web/package.json`'s `test` script is a placeholder `echo` that always exits 0. To actually run the web unit tests, `cd apps/web` and run `../api/node_modules/.bin/jest --config jest.config.js` (web has no local Jest install; it borrows the one already installed under `apps/api/node_modules`, per the comment at the top of `apps/web/jest.config.js`). Every "Run:" step below that targets web tests uses this exact command — never the `pnpm --filter` form.

---

## Task 1: `help:manage` permission

**Files:**
- Modify: `packages/shared/src/permissions.ts`

**Interfaces:**
- Produces: `Permission` union gains `'help:manage'`. `ROLE_PERMISSIONS['Platform Admin']` and `ROLE_PERMISSIONS['Super Admin']` both include it.

- [ ] **Step 1: Add the permission and grant it**

In `packages/shared/src/permissions.ts`, add `'help:manage'` to the `PERMISSIONS` array (in the `// cross-cutting` group, next to `'audit:view'`):

```ts
  // cross-cutting
  'notification:receive',
  'audit:view',
  'help:manage',
] as const;
```

Add it to both roles in `ROLE_PERMISSIONS`:

```ts
  'Platform Admin': [
    'user:manage', 'user:view', 'client:manage', 'client:view',
    'catalogue:manage', 'catalogue:view', 'reference-data:manage', 'reference-data:view',
    'department:manage', 'company-profile:manage', 'company-profile:view',
    'bulk-import:run', 'audit:view', 'notification:receive', 'help:manage',
  ],
  'Super Admin': [
    ...ALL_VIEW, 'user:view', 'client:manage', 'client:view', 'catalogue:view', 'reference-data:view', 'company-profile:view',
    'engagement:create', 'engagement:update', 'engagement:transition',
    'request:create', 'request:update', 'request:assign',
    'working-paper:upload', 'final-report:upload', 'document:delete', 'document:export',
    'submission:review', 'discussion:participate',
    'review:decide', 'review:signoff', 'report-review:manage', 'help:manage',
  ],
```

- [ ] **Step 2: Build the shared package and typecheck**

Run: `pnpm --filter @abdcshare/shared build && pnpm --filter @abdcshare/shared typecheck`
Expected: both succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/permissions.ts
git commit -m "feat(shared): add help:manage permission"
```

---

## Task 2: Help entities + migration

**Files:**
- Create: `apps/api/src/modules/help/infrastructure/persistence/help-category.entity.ts`
- Create: `apps/api/src/modules/help/infrastructure/persistence/help-article.entity.ts`
- Create: a new MikroORM migration under `apps/api/src/migrations/` (generated, not hand-written)

**Interfaces:**
- Produces: `HelpCategoryEntity` (`id: string`, `name: string`, `slug: string`, `order: number`, `icon: string | null`). `HelpArticleEntity` (`id: string`, `category: HelpCategoryEntity`, `title: string`, `slug: string`, `bodyJson: Record<string, unknown>`, `bodyText: string`, `visibleToRoles: string[]`, `status: 'draft' | 'published'`, `order: number`, `createdBy: UserEntity | null`, `updatedAt: Date`, `publishedAt: Date | null`).

- [ ] **Step 1: Write `HelpCategoryEntity`**

```ts
// apps/api/src/modules/help/infrastructure/persistence/help-category.entity.ts
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';

@Entity({ tableName: 'help_categories' })
@Unique({ properties: ['slug'] })
export class HelpCategoryEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property()
  name!: string;

  @Property()
  slug!: string;

  @Property({ default: 0 })
  order: number = 0;

  @Property({ nullable: true })
  icon?: string | null;
}
```

- [ ] **Step 2: Write `HelpArticleEntity`**

```ts
// apps/api/src/modules/help/infrastructure/persistence/help-article.entity.ts
import { Entity, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';
import { HelpCategoryEntity } from './help-category.entity';

export type HelpArticleStatus = 'draft' | 'published';

@Entity({ tableName: 'help_articles' })
@Unique({ properties: ['slug'] })
export class HelpArticleEntity {
  [OptionalProps]?: 'status' | 'order' | 'updatedAt' | 'visibleToRoles';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => HelpCategoryEntity)
  category!: HelpCategoryEntity;

  @Property()
  title!: string;

  @Property()
  slug!: string;

  @Property({ type: 'json' })
  bodyJson!: Record<string, unknown>;

  /** Plain-text extract of bodyJson, computed client-side (editor.getText()) at save time — used for ILIKE search. */
  @Property({ type: 'text' })
  bodyText!: string;

  /** Empty array = visible to every role. */
  @Property({ type: 'json' })
  visibleToRoles: string[] = [];

  /** Plain text column, not @Enum — a two-value status flag doesn't warrant a shared cross-package enum. */
  @Property({ type: 'text' })
  status: HelpArticleStatus = 'draft';

  @Property({ default: 0 })
  order: number = 0;

  @ManyToOne(() => UserEntity, { nullable: true })
  createdBy?: UserEntity | null;

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;
}
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm migration:create`
Expected: a new `Migration<timestamp>.ts` file appears under `apps/api/src/migrations/` with `up`/`down` SQL creating `help_categories` and `help_articles` (including the FK from `help_articles.category_id` → `help_categories.id`, the FK from `help_articles.created_by_id` → `users.id`, and the two unique indexes on `slug`).

Open the generated file and confirm it matches this shape before proceeding — MikroORM's diff occasionally needs a manual nudge on `json`-typed defaults (`visibleToRoles`); if the generated `up()` doesn't default the column to `'[]'`, add it by hand:

```ts
this.addSql(`alter table "help_articles" alter column "visible_to_roles" set default '[]';`);
```

- [ ] **Step 4: Run the migration against the local dev database**

Run: `pnpm migration:up`
Expected: migration applies cleanly; `\d help_categories` and `\d help_articles` in `psql` show the expected columns.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/help/infrastructure apps/api/src/migrations
git commit -m "feat(api): add help_categories and help_articles entities"
```

---

## Task 3: `HelpService` — category CRUD

**Files:**
- Create: `apps/api/src/modules/help/presentation/dto/help-category.dto.ts`
- Create: `apps/api/src/modules/help/help.service.ts`
- Test: `apps/api/src/modules/help/help.service.spec.ts`

**Interfaces:**
- Consumes: `pageParams`/`paginated` from `apps/api/src/common/pagination/paginate.ts` (signatures shown in Task 4 — categories don't paginate, so unused here).
- Produces: `HelpService.createCategory(dto): Promise<HelpCategoryResponseDto>`, `HelpService.listCategoriesAdmin(): Promise<HelpCategoryResponseDto[]>`, `HelpService.updateCategory(id, dto): Promise<HelpCategoryResponseDto>`, `HelpService.deleteCategory(id): Promise<void>`. `HelpCategoryResponseDto` shape: `{ id: string; name: string; slug: string; order: number; icon: string | null }`.

- [ ] **Step 1: Write the category DTOs**

```ts
// apps/api/src/modules/help/presentation/dto/help-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateHelpCategoryDto {
  @ApiProperty() @IsString() @MaxLength(150) name!: string;
  @ApiProperty() @IsString() @MaxLength(150) slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) icon?: string;
}

export class UpdateHelpCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) icon?: string;
}

export class HelpCategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() order!: number;
  @ApiPropertyOptional() icon?: string | null;
}
```

- [ ] **Step 2: Write the failing test for `createCategory` and `updateCategory` conflict handling**

```ts
// apps/api/src/modules/help/help.service.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { HelpService } from './help.service';

function buildEm(overrides: Partial<Record<string, unknown>> = {}) {
  const em = {
    findOne: jest.fn(async () => null),
    findOneOrFail: jest.fn(),
    find: jest.fn(async () => []),
    findAndCount: jest.fn(async () => [[], 0]),
    create: jest.fn((_entity: unknown, data: unknown) => data),
    persistAndFlush: jest.fn(),
    flush: jest.fn(),
    removeAndFlush: jest.fn(),
    getReference: jest.fn((entity: unknown, id: unknown) => ({ __ref: entity, id })),
    ...overrides,
  };
  return em;
}

describe('HelpService categories', () => {
  it('creates a category', async () => {
    const em = buildEm();
    const service = new HelpService(em as never);

    const result = await service.createCategory({ name: 'Engagements', slug: 'engagements', order: 1 });

    expect(em.persistAndFlush).toHaveBeenCalled();
    expect(result).toMatchObject({ name: 'Engagements', slug: 'engagements', order: 1 });
  });

  it('rejects a duplicate slug on create', async () => {
    const em = buildEm({ findOne: jest.fn(async () => ({ id: 'cat-1' })) });
    const service = new HelpService(em as never);

    await expect(
      service.createCategory({ name: 'Engagements', slug: 'engagements' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException updating a missing category', async () => {
    const em = buildEm({
      findOneOrFail: jest.fn(async () => {
        throw new NotFoundException('Help category not found');
      }),
    });
    const service = new HelpService(em as never);

    await expect(service.updateCategory('missing', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @abdcshare/api test -- help.service.spec.ts`
Expected: FAIL — `Cannot find module './help.service'` (it doesn't exist yet).

- [ ] **Step 4: Implement `HelpService` (category methods only for now)**

```ts
// apps/api/src/modules/help/help.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { HelpCategoryEntity } from './infrastructure/persistence/help-category.entity';
import type {
  CreateHelpCategoryDto,
  UpdateHelpCategoryDto,
} from './presentation/dto/help-category.dto';
import { HelpCategoryResponseDto } from './presentation/dto/help-category.dto';

@Injectable()
export class HelpService {
  constructor(private readonly em: EntityManager) {}

  private toCategoryDto(c: HelpCategoryEntity): HelpCategoryResponseDto {
    return { id: c.id, name: c.name, slug: c.slug, order: c.order, icon: c.icon ?? null };
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
    await this.em.removeAndFlush(category);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @abdcshare/api test -- help.service.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/help/presentation/dto/help-category.dto.ts apps/api/src/modules/help/help.service.ts apps/api/src/modules/help/help.service.spec.ts
git commit -m "feat(api): add HelpService category CRUD"
```

---

## Task 4: `HelpService` — article CRUD, role-visibility filtering, search

**Files:**
- Create: `apps/api/src/modules/help/presentation/dto/help-article.dto.ts`
- Modify: `apps/api/src/modules/help/help.service.ts`
- Modify: `apps/api/src/modules/help/help.service.spec.ts`

**Interfaces:**
- Consumes: `AuthenticatedUser` (`apps/api/src/common/interfaces/authenticated-user.ts`) — `{ userId, role, partnerDesignation }`; `hasPermission` from `@abdcshare/shared`; `pageParams`/`paginated` from `apps/api/src/common/pagination/paginate.ts`.
- Produces: `HelpService.createArticle(dto, actorId): Promise<HelpArticleResponseDto>`, `HelpService.updateArticle(id, dto): Promise<HelpArticleResponseDto>`, `HelpService.publishArticle(id): Promise<HelpArticleResponseDto>`, `HelpService.unpublishArticle(id): Promise<HelpArticleResponseDto>`, `HelpService.deleteArticle(id): Promise<void>`, `HelpService.listArticlesAdmin(query): Promise<Paginated<HelpArticleSummaryDto>>`, `HelpService.getCategoriesForViewer(user): Promise<HelpCategoryWithArticlesDto[]>`, `HelpService.getArticleBySlug(slug, user): Promise<HelpArticleResponseDto>`, `HelpService.searchArticles(q, user): Promise<HelpArticleSummaryDto[]>`.

- [ ] **Step 1: Write the article DTOs**

```ts
// apps/api/src/modules/help/presentation/dto/help-article.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ROLE_NAMES, type PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateHelpArticleDto {
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty() @IsString() @MaxLength(255) title!: string;
  @ApiProperty() @IsString() @MaxLength(255) slug!: string;
  @ApiProperty({ description: 'Tiptap/ProseMirror document JSON.' }) @IsObject() bodyJson!: Record<string, unknown>;
  @ApiProperty({ description: 'editor.getText() plain-text extract, for search.' }) @IsString() bodyText!: string;
  @ApiPropertyOptional({ enum: ROLE_NAMES, isArray: true })
  @IsOptional() @IsArray() @IsIn(ROLE_NAMES, { each: true }) visibleToRoles?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
}

export class UpdateHelpArticleDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() bodyJson?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() bodyText?: string;
  @ApiPropertyOptional({ enum: ROLE_NAMES, isArray: true })
  @IsOptional() @IsArray() @IsIn(ROLE_NAMES, { each: true }) visibleToRoles?: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
}

export class HelpArticleListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional() @IsIn(['draft', 'published']) status?: 'draft' | 'published';
}

export class HelpArticleResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() bodyJson!: Record<string, unknown>;
  @ApiProperty({ type: [String] }) visibleToRoles!: string[];
  @ApiProperty({ enum: ['draft', 'published'] }) status!: 'draft' | 'published';
  @ApiProperty() order!: number;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() publishedAt?: Date | null;
}

export class HelpArticleSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: ['draft', 'published'] }) status!: 'draft' | 'published';
  @ApiProperty() order!: number;
}

export class HelpArticleListResponseDto {
  @ApiProperty({ type: [HelpArticleSummaryDto] }) data!: HelpArticleSummaryDto[];
  @ApiProperty() meta!: PageMeta;
}

export class HelpCategoryWithArticlesDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() order!: number;
  @ApiPropertyOptional() icon?: string | null;
  @ApiProperty({ type: [HelpArticleSummaryDto] }) articles!: HelpArticleSummaryDto[];
}
```

- [ ] **Step 2: Write the failing tests for visibility filtering and search**

Append to `apps/api/src/modules/help/help.service.spec.ts`:

```ts
import { HelpArticleEntity } from './infrastructure/persistence/help-article.entity';

describe('HelpService articles', () => {
  function article(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'art-1',
      category: { id: 'cat-1' },
      title: 'How to raise a request',
      slug: 'how-to-raise-a-request',
      bodyJson: { type: 'doc', content: [] },
      bodyText: 'How to raise a request',
      visibleToRoles: [],
      status: 'published',
      order: 0,
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      publishedAt: new Date('2026-08-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  const clientUser = { userId: 'u-1', role: 'Client' as const, partnerDesignation: null };
  const platformAdmin = { userId: 'u-2', role: 'Platform Admin' as const, partnerDesignation: null };

  it('hides a draft article from a non-manager role by slug', async () => {
    const em = buildEm({ findOne: jest.fn(async () => article({ status: 'draft' })) });
    const service = new HelpService(em as never);

    await expect(service.getArticleBySlug('how-to-raise-a-request', clientUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('shows a draft article to a help:manage role by slug', async () => {
    const em = buildEm({ findOne: jest.fn(async () => article({ status: 'draft' })) });
    const service = new HelpService(em as never);

    const result = await service.getArticleBySlug('how-to-raise-a-request', platformAdmin);
    expect(result.status).toBe('draft');
  });

  it('hides an article scoped to other roles from a Client viewer', async () => {
    const em = buildEm({
      findOne: jest.fn(async () => article({ visibleToRoles: ['Staff', 'Super Admin'] })),
    });
    const service = new HelpService(em as never);

    await expect(service.getArticleBySlug('how-to-raise-a-request', clientUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('shows a role-scoped article to a matching role', async () => {
    const em = buildEm({
      findOne: jest.fn(async () => article({ visibleToRoles: ['Client'] })),
    });
    const service = new HelpService(em as never);

    const result = await service.getArticleBySlug('how-to-raise-a-request', clientUser);
    expect(result.slug).toBe('how-to-raise-a-request');
  });

  it('search excludes drafts and role-mismatched articles', async () => {
    const em = buildEm({ find: jest.fn(async () => [article()]) });
    const service = new HelpService(em as never);

    const results = await service.searchArticles('raise', clientUser);
    expect(em.find).toHaveBeenCalledWith(
      HelpArticleEntity,
      expect.objectContaining({
        status: 'published',
        $or: [{ title: { $ilike: '%raise%' } }, { bodyText: { $ilike: '%raise%' } }],
      }),
      expect.anything(),
    );
    expect(results).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @abdcshare/api test -- help.service.spec.ts`
Expected: FAIL — `getArticleBySlug`/`searchArticles` are not functions yet.

- [ ] **Step 4: Implement the article methods on `HelpService`**

Add to `apps/api/src/modules/help/help.service.ts` (alongside the existing imports and category methods):

```ts
import { ForbiddenException } from '@nestjs/common';
import type { FilterQuery } from '@mikro-orm/postgresql';
import { hasPermission, type Paginated, type PartnerDesignation, type RoleName } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { HelpArticleEntity } from './infrastructure/persistence/help-article.entity';
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

interface ViewerContext {
  role: RoleName;
  partnerDesignation?: PartnerDesignation | null;
}
```

Inside the `HelpService` class, add:

```ts
  private canManage(viewer: ViewerContext): boolean {
    return hasPermission(viewer.role, 'help:manage', viewer.partnerDesignation);
  }

  private isVisibleTo(article: HelpArticleEntity, viewer: ViewerContext): boolean {
    if (article.visibleToRoles.length === 0) return true;
    return article.visibleToRoles.includes(viewer.role);
  }

  private toArticleDto(a: HelpArticleEntity): HelpArticleResponseDto {
    return {
      id: a.id,
      categoryId: a.category.id,
      title: a.title,
      slug: a.slug,
      bodyJson: a.bodyJson,
      visibleToRoles: a.visibleToRoles,
      status: a.status,
      order: a.order,
      updatedAt: a.updatedAt,
      publishedAt: a.publishedAt ?? null,
    };
  }

  private toSummaryDto(a: HelpArticleEntity): HelpArticleSummaryDto {
    return {
      id: a.id,
      categoryId: a.category.id,
      title: a.title,
      slug: a.slug,
      status: a.status,
      order: a.order,
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

  async getCategoriesForViewer(viewer: ViewerContext): Promise<HelpCategoryWithArticlesDto[]> {
    const categories = await this.em.find(HelpCategoryEntity, {}, { orderBy: { order: 'asc', name: 'asc' } });
    const articles = await this.em.find(
      HelpArticleEntity,
      { status: 'published' },
      { populate: ['category'], orderBy: { order: 'asc', title: 'asc' } },
    );
    const visible = articles.filter((a) => this.isVisibleTo(a, viewer));
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      order: c.order,
      icon: c.icon ?? null,
      articles: visible.filter((a) => a.category.id === c.id).map((a) => this.toSummaryDto(a)),
    }));
  }

  async getArticleBySlug(slug: string, viewer: ViewerContext): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOne(HelpArticleEntity, { slug }, { populate: ['category'] });
    if (!article) throw new NotFoundException('Help article not found');
    const manage = this.canManage(viewer);
    if (!manage && article.status !== 'published') throw new NotFoundException('Help article not found');
    if (!manage && !this.isVisibleTo(article, viewer)) throw new NotFoundException('Help article not found');
    return this.toArticleDto(article);
  }

  async searchArticles(q: string, viewer: ViewerContext): Promise<HelpArticleSummaryDto[]> {
    const term = `%${q.trim()}%`;
    const rows = await this.em.find(
      HelpArticleEntity,
      {
        status: 'published',
        $or: [{ title: { $ilike: term } }, { bodyText: { $ilike: term } }],
      } as FilterQuery<HelpArticleEntity>,
      { populate: ['category'], orderBy: { title: 'asc' }, limit: 20 },
    );
    return rows.filter((a) => this.isVisibleTo(a, viewer)).map((a) => this.toSummaryDto(a));
  }
```

Add the `HelpCategoryEntity` import at the top of `help.service.ts` if not already present (it was added in Task 3).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @abdcshare/api test -- help.service.spec.ts`
Expected: PASS (all tests from Task 3 + Task 4).

- [ ] **Step 6: Typecheck the API**

Run: `pnpm --filter @abdcshare/api typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/help
git commit -m "feat(api): add HelpService article CRUD, role-visibility filtering, and search"
```

---

## Task 5: Inline image upload + read-time URL rehydration

**Files:**
- Create: `apps/api/src/modules/help/presentation/dto/help-image.dto.ts`
- Modify: `apps/api/src/modules/help/help.service.ts`
- Modify: `apps/api/src/modules/help/help.service.spec.ts`

**Interfaces:**
- Consumes: `StoragePort` (`apps/api/src/common/storage/storage.port.ts`) — `upload(input): Promise<{storageKey}>`, `presignDownload(storageKey): Promise<string>`.
- Produces: `HelpService.uploadImage(dto): Promise<{storageKey: string}>`. `HelpService.toArticleDto` (from Task 4) now resolves image `src` fields via storage before returning — signature unchanged, but it becomes `private async toArticleDto(...)`, so `getArticleBySlug`, `createArticle`, `updateArticle`, `publishArticle`, `unpublishArticle` all become callers of an async version (update their `return this.toArticleDto(article)` to `return this.toArticleDto(article)` awaited — see Step 4 note).

Rich-text image nodes persist as `{ type: 'image', attrs: { src: '', alt: string | null, storageKey: string } }` — the client never persists a real `src`; the API fills it in on every read from a freshly presigned URL, the same way `UsersService` resolves `avatarUrl` from `avatarPath` on every `toDto()` call.

- [ ] **Step 1: Write the image upload DTO**

```ts
// apps/api/src/modules/help/presentation/dto/help-image.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** Browser → API upload, same shape as AvatarUploadDto (avoids R2 CORS issues). */
export class HelpImageUploadDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
  @ApiProperty({ description: 'Base64-encoded image bytes.' }) @IsString() data!: string;
}

export class HelpImageUploadResponseDto {
  @ApiProperty() storageKey!: string;
}
```

- [ ] **Step 2: Write the failing tests**

Append to `apps/api/src/modules/help/help.service.spec.ts`:

```ts
describe('HelpService images', () => {
  it('rejects a non-image content type', async () => {
    const em = buildEm();
    const storage = { upload: jest.fn(), presignDownload: jest.fn() };
    const service = new HelpService(em as never, storage as never);

    await expect(
      service.uploadImage({ fileName: 'x.pdf', contentType: 'application/pdf', data: 'abc' }),
    ).rejects.toThrow('Use a JPEG, PNG, or WebP image');
  });

  it('rejects an image over 5 MB', async () => {
    const em = buildEm();
    const storage = { upload: jest.fn(), presignDownload: jest.fn() };
    const service = new HelpService(em as never, storage as never);
    const big = Buffer.alloc(6 * 1024 * 1024).toString('base64');

    await expect(
      service.uploadImage({ fileName: 'x.png', contentType: 'image/png', data: big }),
    ).rejects.toThrow('5 MB');
  });

  it('uploads a valid image and returns its storage key', async () => {
    const em = buildEm();
    const storage = {
      upload: jest.fn(async () => ({ storageKey: 'help-images/abc.png' })),
      presignDownload: jest.fn(),
    };
    const service = new HelpService(em as never, storage as never);

    const result = await service.uploadImage({
      fileName: 'diagram.png',
      contentType: 'image/png',
      data: Buffer.from('fake-bytes').toString('base64'),
    });

    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({ keyPrefix: 'help-images', fileName: 'diagram.png', contentType: 'image/png' }),
    );
    expect(result).toEqual({ storageKey: 'help-images/abc.png' });
  });

  it('rehydrates image src attributes on read', async () => {
    const storage = {
      upload: jest.fn(),
      presignDownload: jest.fn(async (key: string) => `https://r2.example/${key}?sig=1`),
    };
    const bodyJson = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '', alt: null, storageKey: 'help-images/abc.png' } }],
    };
    const em = buildEm({
      findOne: jest.fn(async () => ({
        id: 'art-1',
        category: { id: 'cat-1' },
        title: 'T',
        slug: 's',
        bodyJson,
        visibleToRoles: [],
        status: 'published',
        order: 0,
        updatedAt: new Date(),
        publishedAt: new Date(),
      })),
    });
    const service = new HelpService(em as never, storage as never);

    const result = await service.getArticleBySlug('s', { role: 'Client', partnerDesignation: null });

    expect((result.bodyJson as any).content[0].attrs.src).toBe(
      'https://r2.example/help-images/abc.png?sig=1',
    );
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @abdcshare/api test -- help.service.spec.ts`
Expected: FAIL — `HelpService` constructor doesn't accept a second `storage` argument yet, `uploadImage` doesn't exist.

- [ ] **Step 4: Implement image upload and rehydration**

In `apps/api/src/modules/help/help.service.ts`, update the constructor and imports:

```ts
import { Inject } from '@nestjs/common';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class HelpService {
  constructor(
    private readonly em: EntityManager,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}
```

Add the upload method and the rehydration walker to the class:

```ts
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
```

Add `BadRequestException` to the `@nestjs/common` import at the top of the file.

Now make `toArticleDto` async and resolve images inside it — replace the existing `private toArticleDto` (from Task 4) with:

```ts
  private async toArticleDto(a: HelpArticleEntity): Promise<HelpArticleResponseDto> {
    return {
      id: a.id,
      categoryId: a.category.id,
      title: a.title,
      slug: a.slug,
      bodyJson: (await this.resolveImageUrls(a.bodyJson)) as Record<string, unknown>,
      visibleToRoles: a.visibleToRoles,
      status: a.status,
      order: a.order,
      updatedAt: a.updatedAt,
      publishedAt: a.publishedAt ?? null,
    };
  }
```

Then update every caller of `this.toArticleDto(article)` from Task 4 (`createArticle`, `updateArticle`, `publishArticle`, `unpublishArticle`, `getArticleBySlug`) to `await` it — e.g. `return this.toArticleDto(article);` becomes `return this.toArticleDto(article);` inside an already-`async` method, so simply ensure each call site is `return await this.toArticleDto(article);` is unnecessary since `return this.toArticleDto(article)` on an async-returning function already awaits correctly through the Promise chain — no change needed there, since the method's return type is `Promise<HelpArticleResponseDto>` and `toArticleDto` now returns `Promise<HelpArticleResponseDto>` too, TypeScript will flatten it correctly. Just double check no caller does `const dto = this.toArticleDto(article); return { ...dto, other: 1 };` (none do).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @abdcshare/api test -- help.service.spec.ts`
Expected: PASS (all tests from Tasks 3, 4, 5).

Also re-check the Task 3/4 category tests still construct `HelpService` with only one argument (`new HelpService(em as never)`) — since the constructor now requires a second `storage` param, TypeScript will only complain if strict arg-count checking is on for plain JS-level calls (it isn't enforced at runtime, but `tsc` will flag missing required constructor args in test files during `typecheck`). Update every `new HelpService(em as never)` call in the spec file (Tasks 3 and 4's tests) to `new HelpService(em as never, buildStorage() as never)`, adding this helper near the top of the spec file:

```ts
function buildStorage() {
  return { upload: jest.fn(), presignDownload: jest.fn(async () => 'https://example.com/x') };
}
```

- [ ] **Step 6: Run the full spec file again and typecheck**

Run: `pnpm --filter @abdcshare/api test -- help.service.spec.ts && pnpm --filter @abdcshare/api typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/help
git commit -m "feat(api): add help article image upload and read-time URL rehydration"
```

---

## Task 6: `HelpController`, `HelpModule`, wire into `AppModule` and the BFF proxy

**Files:**
- Create: `apps/api/src/modules/help/help.controller.ts`
- Create: `apps/api/src/modules/help/help.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/web/src/app/api/bff/proxy/[...path]/route.ts`

**Interfaces:**
- Consumes: `HelpService` (Tasks 3-5), `RequirePermission` decorator, `CurrentUser` decorator.
- Produces: HTTP surface —
  - `GET /help/categories` (any authenticated role)
  - `GET /help/articles/:slug` (any authenticated role)
  - `GET /help/search?q=` (any authenticated role)
  - `POST /help/images` (`help:manage`)
  - `GET /help/admin/categories` (`help:manage`)
  - `POST /help/categories` / `PATCH /help/categories/:id` / `DELETE /help/categories/:id` (`help:manage`)
  - `GET /help/admin/articles` (`help:manage`)
  - `POST /help/articles` / `PATCH /help/articles/:id` / `DELETE /help/articles/:id` (`help:manage`)
  - `POST /help/articles/:id/publish` / `POST /help/articles/:id/unpublish` (`help:manage`)

- [ ] **Step 1: Write `HelpController`**

```ts
// apps/api/src/modules/help/help.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { HelpService } from './help.service';
import {
  CreateHelpCategoryDto,
  HelpCategoryResponseDto,
  UpdateHelpCategoryDto,
} from './presentation/dto/help-category.dto';
import {
  CreateHelpArticleDto,
  HelpArticleListQueryDto,
  HelpArticleListResponseDto,
  HelpArticleResponseDto,
  HelpCategoryWithArticlesDto,
  UpdateHelpArticleDto,
} from './presentation/dto/help-article.dto';
import { HelpImageUploadDto, HelpImageUploadResponseDto } from './presentation/dto/help-image.dto';

@ApiTags('help')
@ApiBearerAuth()
@Controller('help')
export class HelpController {
  constructor(private readonly help: HelpService) {}

  // --- reader surface (any authenticated role) ---

  @Get('categories')
  getCategories(@CurrentUser() user: AuthenticatedUser): Promise<HelpCategoryWithArticlesDto[]> {
    return this.help.getCategoriesForViewer(user);
  }

  @Get('articles/:slug')
  getArticle(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HelpArticleResponseDto> {
    return this.help.getArticleBySlug(slug, user);
  }

  @Get('search')
  search(@Query('q') q: string, @CurrentUser() user: AuthenticatedUser) {
    return this.help.searchArticles(q ?? '', user);
  }

  // --- authoring surface (help:manage) ---

  @Post('images')
  @RequirePermission('help:manage')
  uploadImage(@Body() dto: HelpImageUploadDto): Promise<HelpImageUploadResponseDto> {
    return this.help.uploadImage(dto);
  }

  @Get('admin/categories')
  @RequirePermission('help:manage')
  listCategoriesAdmin(): Promise<HelpCategoryResponseDto[]> {
    return this.help.listCategoriesAdmin();
  }

  @Post('categories')
  @RequirePermission('help:manage')
  createCategory(@Body() dto: CreateHelpCategoryDto): Promise<HelpCategoryResponseDto> {
    return this.help.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequirePermission('help:manage')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateHelpCategoryDto,
  ): Promise<HelpCategoryResponseDto> {
    return this.help.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @RequirePermission('help:manage')
  deleteCategory(@Param('id') id: string): Promise<void> {
    return this.help.deleteCategory(id);
  }

  @Get('admin/articles')
  @RequirePermission('help:manage')
  listArticlesAdmin(@Query() query: HelpArticleListQueryDto): Promise<HelpArticleListResponseDto> {
    return this.help.listArticlesAdmin(query);
  }

  @Post('articles')
  @RequirePermission('help:manage')
  createArticle(
    @Body() dto: CreateHelpArticleDto,
    @CurrentUser('userId') userId: string,
  ): Promise<HelpArticleResponseDto> {
    return this.help.createArticle(dto, userId);
  }

  @Patch('articles/:id')
  @RequirePermission('help:manage')
  updateArticle(
    @Param('id') id: string,
    @Body() dto: UpdateHelpArticleDto,
  ): Promise<HelpArticleResponseDto> {
    return this.help.updateArticle(id, dto);
  }

  @Post('articles/:id/publish')
  @RequirePermission('help:manage')
  publishArticle(@Param('id') id: string): Promise<HelpArticleResponseDto> {
    return this.help.publishArticle(id);
  }

  @Post('articles/:id/unpublish')
  @RequirePermission('help:manage')
  unpublishArticle(@Param('id') id: string): Promise<HelpArticleResponseDto> {
    return this.help.unpublishArticle(id);
  }

  @Delete('articles/:id')
  @RequirePermission('help:manage')
  deleteArticle(@Param('id') id: string): Promise<void> {
    return this.help.deleteArticle(id);
  }
}
```

Note the route order: `admin/categories` and `admin/articles` must be declared as literal segments, not conflicting with `:slug`/`:id` params on the reader routes — since they live under different literal prefixes (`categories` vs `articles/:slug` vs `admin/categories`), Nest's router resolves them unambiguously by segment count and literal match; no reordering needed.

- [ ] **Step 2: Write `HelpModule`**

```ts
// apps/api/src/modules/help/help.module.ts
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { HelpCategoryEntity } from './infrastructure/persistence/help-category.entity';
import { HelpArticleEntity } from './infrastructure/persistence/help-article.entity';
import { HelpService } from './help.service';
import { HelpController } from './help.controller';

@Module({
  imports: [MikroOrmModule.forFeature([HelpCategoryEntity, HelpArticleEntity])],
  controllers: [HelpController],
  providers: [HelpService],
})
export class HelpModule {}
```

- [ ] **Step 3: Wire `HelpModule` into `AppModule`**

In `apps/api/src/app.module.ts`, add the import near the other feature modules:

```ts
import { HelpModule } from './modules/help/help.module';
```

And add `HelpModule,` to the `imports` array, right after `CompanyProfileModule,` and before `DemoModule,`.

- [ ] **Step 4: Allow `help` through the web BFF proxy**

In `apps/web/src/app/api/bff/proxy/[...path]/route.ts`, add `'help'` to `ALLOWED_PREFIXES`:

```ts
const ALLOWED_PREFIXES = [
  'users',
  'roles',
  'clients',
  'engagement-types',
  'request-classes',
  'request-types',
  'request-stages',
  'request-statuses',
  'departments',
  'reference',
  'company-profiles',
  'dashboard',
  'search',
  'engagements',
  'requests',
  'submissions',
  'messages',
  'documents',
  'reviews',
  'final-reports',
  'partner-reports',
  'notifications',
  'audit',
  'help',
] as const;
```

- [ ] **Step 5: Start the API and smoke-test the routes**

Run: `pnpm dev:api`

In another terminal, once it's up on `:4000`, confirm the routes are registered:

Run: `curl -s http://localhost:4000/api-json | python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(p for p in d['paths'] if p.startswith('/help')))"`
Expected: prints the 13 `/help...` paths from Step 1.

- [ ] **Step 6: Run the full API test suite**

Run: `pnpm --filter @abdcshare/api test`
Expected: PASS — no regressions in other modules.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/help/help.controller.ts apps/api/src/modules/help/help.module.ts apps/api/src/app.module.ts apps/web/src/app/api/bff/proxy/[...path]/route.ts
git commit -m "feat(api): expose help module via HelpController and wire into AppModule"
```

---

## Task 7: Web — types, TanStack Query hooks (reader), widen jest testRegex

**Files:**
- Create: `apps/web/src/features/help/types.ts`
- Create: `apps/web/src/features/help/hooks/use-help.ts`
- Create: `apps/web/src/features/help/lib/plain-text.ts`
- Create: `apps/web/src/features/help/lib/plain-text.spec.ts`
- Modify: `apps/web/jest.config.js`

**Interfaces:**
- Consumes: `bffApi` from `apps/web/src/lib/bff/client.ts`.
- Produces: `HelpArticleSummary`, `HelpCategoryWithArticles`, `HelpArticle` types. `useHelpCategories()`, `useHelpArticle(slug)`, `useHelpSearch(query)` hooks. `extractPlainText(doc: unknown): string` pure helper (used by the editor in Task 13 to populate `bodyText` before submit).

- [ ] **Step 1: Write the shared types**

```ts
// apps/web/src/features/help/types.ts
export interface HelpArticleSummary {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  order: number;
}

export interface HelpCategoryWithArticles {
  id: string;
  name: string;
  slug: string;
  order: number;
  icon?: string | null;
  articles: HelpArticleSummary[];
}

export interface HelpCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
  icon?: string | null;
}

export interface HelpArticle {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  bodyJson: Record<string, unknown>;
  visibleToRoles: string[];
  status: 'draft' | 'published';
  order: number;
  updatedAt: string;
  publishedAt?: string | null;
}
```

- [ ] **Step 2: Write the reader hooks**

```ts
// apps/web/src/features/help/hooks/use-help.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import type { HelpArticle, HelpArticleSummary, HelpCategoryWithArticles } from '../types';

export function useHelpCategories() {
  return useQuery({
    queryKey: ['help', 'categories'],
    queryFn: () => bffApi<HelpCategoryWithArticles[]>('/api/help/categories'),
  });
}

export function useHelpArticle(slug: string) {
  return useQuery({
    queryKey: ['help', 'article', slug],
    queryFn: () => bffApi<HelpArticle>(`/api/help/articles/${encodeURIComponent(slug)}`),
    enabled: Boolean(slug),
  });
}

export function useHelpSearch(query: string) {
  return useQuery({
    queryKey: ['help', 'search', query],
    queryFn: () => bffApi<HelpArticleSummary[]>(`/api/help/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 1,
  });
}
```

- [ ] **Step 3: Write the failing test for `extractPlainText`**

```ts
// apps/web/src/features/help/lib/plain-text.spec.ts
import { extractPlainText } from './plain-text';

describe('extractPlainText', () => {
  it('joins text nodes across paragraphs with spaces', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'world' }] },
      ],
    };
    expect(extractPlainText(doc)).toBe('Hello world');
  });

  it('ignores image nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: '', storageKey: 'k' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'caption' }] },
      ],
    };
    expect(extractPlainText(doc)).toBe('caption');
  });

  it('returns an empty string for an empty doc', () => {
    expect(extractPlainText({ type: 'doc', content: [] })).toBe('');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run (from `apps/web/`): `../api/node_modules/.bin/jest --config jest.config.js`
Expected: FAIL — the jest config's `testRegex` only matches `lib/bff/client-ip\.spec\.ts$`, so `plain-text.spec.ts` isn't even picked up yet (and the module it imports doesn't exist either). Confirm by eye that only `client-ip.spec.ts` ran; Step 5 fixes the pattern so the new file is picked up.

- [ ] **Step 5: Widen the web jest `testRegex`**

In `apps/web/jest.config.js`, change:

```js
testRegex: 'lib/bff/client-ip\\.spec\\.ts$',
```

to:

```js
testRegex: '\\.spec\\.ts$',
```

(Leave `moduleFileExtensions` and the `ts-jest` transform untouched — `.tsx` files are still excluded since there's no jsdom/React Testing Library setup; only plain `.ts` unit tests run here.)

- [ ] **Step 6: Implement `extractPlainText`**

```ts
// apps/web/src/features/help/lib/plain-text.ts
interface DocNode {
  type?: string;
  text?: string;
  content?: DocNode[];
}

export function extractPlainText(doc: unknown): string {
  const parts: string[] = [];
  walk(doc as DocNode, parts);
  return parts.join(' ').trim().replace(/\s+/g, ' ');
}

function walk(node: DocNode | undefined, parts: string[]): void {
  if (!node) return;
  if (node.type === 'text' && node.text) parts.push(node.text);
  if (node.content) node.content.forEach((child) => walk(child, parts));
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `apps/web/`): `../api/node_modules/.bin/jest --config jest.config.js`
Expected: PASS — both `client-ip.spec.ts` and `plain-text.spec.ts` run and pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/help/types.ts apps/web/src/features/help/hooks/use-help.ts apps/web/src/features/help/lib/plain-text.ts apps/web/src/features/help/lib/plain-text.spec.ts apps/web/jest.config.js
git commit -m "feat(web): add help reader types, TanStack Query hooks, and plain-text extraction"
```

---

## Task 8: Web — `Sheet` UI primitive

**Files:**
- Create: `apps/web/src/components/ui/sheet.tsx`

**Interfaces:**
- Produces: `Sheet`, `SheetTrigger`, `SheetContent` (accepts `side?: 'right' | 'left'`, default `'right'`), `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetClose` — same export shape as `dialog.tsx`, built on the same `@radix-ui/react-dialog` primitive already used there.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/components/ui/sheet.tsx
'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetPortal = DialogPrimitive.Portal;
const SheetClose = DialogPrimitive.Close;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/40', className)}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const sheetVariants = cva(
  'fixed z-50 flex h-full flex-col gap-4 border-border bg-card p-6 shadow-aca transition ease-in-out',
  {
    variants: {
      side: {
        right: 'inset-y-0 right-0 w-full max-w-md border-l',
        left: 'inset-y-0 left-0 w-full max-w-md border-r',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ side, className, children, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
          <IconX className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  ),
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />;
}

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export { Sheet, SheetPortal, SheetOverlay, SheetClose, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription };
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @abdcshare/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/sheet.tsx
git commit -m "feat(web): add Sheet UI primitive"
```

---

## Task 9: Web — Tiptap read-only rendering, `/help` sidebar entry, `/help` home page

**Files:**
- Create: `apps/web/src/features/help/lib/tiptap-extensions.ts`
- Create: `apps/web/src/features/help/components/article-body.tsx`
- Create: `apps/web/src/app/(app)/help/page.tsx`
- Create: `apps/web/src/app/(app)/help/layout.tsx`
- Modify: `apps/web/src/components/layout/app-sidebar.tsx`

**Interfaces:**
- Consumes: `useHelpCategories` (Task 7), `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` (existing `components/ui/accordion.tsx`), `useHelpSearch` (Task 7).
- Produces: `HELP_TIPTAP_EXTENSIONS` array (reused by the editor in Task 13). `<ArticleBody bodyJson={...} />` component (reused by the article reader in Task 10 and the editor preview in Task 13).

- [ ] **Step 1: Add the Tiptap dependencies**

Run: `pnpm --filter @abdcshare/web add @tiptap/react @tiptap/core @tiptap/starter-kit @tiptap/extension-image`

- [ ] **Step 2: Write the shared extension set**

```ts
// apps/web/src/features/help/lib/tiptap-extensions.ts
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

/** Image node gains a persisted `storageKey` attribute; `src` is always server-resolved on read. */
const HelpImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      storageKey: { default: null },
    };
  },
});

export const HELP_TIPTAP_EXTENSIONS = [StarterKit, HelpImage];
```

- [ ] **Step 3: Write the read-only body renderer**

```tsx
// apps/web/src/features/help/components/article-body.tsx
'use client';

import { generateHTML } from '@tiptap/core';
import { HELP_TIPTAP_EXTENSIONS } from '../lib/tiptap-extensions';

export function ArticleBody({ bodyJson }: { bodyJson: Record<string, unknown> }) {
  const html = generateHTML(bodyJson as never, HELP_TIPTAP_EXTENSIONS);
  return (
    <div
      className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-a:text-primary"
      // eslint-disable-next-line react/no-danger -- content is authored in-app by help:manage roles only, via the Tiptap editor.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 4: Add the Help sidebar entry**

In `apps/web/src/components/layout/app-sidebar.tsx`, add `IconHelpCircle` to the `@tabler/icons-react` import list, and add a new item to the `"Account"` section, above `"Settings"`:

```ts
      {
        label: "Help",
        href: "/help",
        icon: IconHelpCircle,
      },
```

No `permission` field — every role sees it, matching `"Settings"`.

- [ ] **Step 5: Write the `/help` layout and home page**

```tsx
// apps/web/src/app/(app)/help/layout.tsx
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</div>;
}
```

```tsx
// apps/web/src/app/(app)/help/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/data/empty-state';
import { useHelpCategories, useHelpSearch } from '@/features/help/hooks/use-help';

export default function HelpHomePage() {
  const [query, setQuery] = useState('');
  const categories = useHelpCategories();
  const search = useHelpSearch(query);
  const searching = query.trim().length > 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Help Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find out how to complete tasks in the portal.
        </p>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search help articles…"
        aria-label="Search help articles"
      />

      {searching ? (
        <div className="space-y-2">
          {search.isPending ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : search.data && search.data.length > 0 ? (
            search.data.map((article) => (
              <Link
                key={article.id}
                href={`/help/${article.slug}`}
                className="block rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground hover:bg-muted/40"
              >
                {article.title}
              </Link>
            ))
          ) : (
            <EmptyState message="No articles match your search" />
          )}
        </div>
      ) : (
        <Accordion type="multiple" className="w-full">
          {(categories.data ?? []).map((category) => (
            <AccordionItem key={category.id} value={category.id}>
              <AccordionTrigger>{category.name}</AccordionTrigger>
              <AccordionContent>
                {category.articles.length === 0 ? (
                  <EmptyState message="No articles in this category yet" />
                ) : (
                  <div className="space-y-1">
                    {category.articles.map((article) => (
                      <Link
                        key={article.id}
                        href={`/help/${article.slug}`}
                        className="block rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted/40"
                      >
                        {article.title}
                      </Link>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @abdcshare/web typecheck`
Expected: no errors.

- [ ] **Step 7: Manual verification**

Run: `pnpm dev` (starts shared/api/worker/web). Log in, confirm "Help" appears in the sidebar under Account for every role you can test, and that `/help` renders (empty categories is fine — none exist yet).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/help/lib/tiptap-extensions.ts apps/web/src/features/help/components/article-body.tsx apps/web/src/app/\(app\)/help apps/web/src/components/layout/app-sidebar.tsx apps/web/package.json apps/web/../../pnpm-lock.yaml
git commit -m "feat(web): add Help Center home page, sidebar entry, and Tiptap read-only renderer"
```

---

## Task 10: Web — `/help/[slug]` article reader page

**Files:**
- Create: `apps/web/src/app/(app)/help/[slug]/page.tsx`

**Interfaces:**
- Consumes: `useHelpArticle` (Task 7), `ArticleBody` (Task 9).

- [ ] **Step 1: Write the reader page**

```tsx
// apps/web/src/app/(app)/help/[slug]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { ArticleBody } from '@/features/help/components/article-body';
import { useHelpArticle } from '@/features/help/hooks/use-help';
import { EmptyState } from '@/components/data/empty-state';

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = useHelpArticle(slug);

  if (article.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (article.isError || !article.data) {
    return <EmptyState message="This article isn't available." />;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Back to Help Center
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{article.data.title}</h1>
      <ArticleBody bodyJson={article.data.bodyJson} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @abdcshare/web typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification**

With the API and web dev servers running, visit `/help/some-nonexistent-slug` and confirm the "This article isn't available." empty state renders instead of a crash.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(app)/help/[slug]"
git commit -m "feat(web): add help article reader page"
```

---

## Task 11: Web — `HelpTip` contextual drawer + wire into the Engagements page

**Files:**
- Create: `apps/web/src/features/help/components/help-tip.tsx`
- Modify: `apps/web/src/app/(app)/engagements/page.tsx` (or the Engagements list header component it renders — confirm the exact file when implementing; the goal is one page header gaining a `<HelpTip slug="..." />` next to its title)

**Interfaces:**
- Consumes: `useHelpArticle` (Task 7), `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetTrigger` (Task 8), `ArticleBody` (Task 9).
- Produces: `<HelpTip slug={string} label?={string} />`.

- [ ] **Step 1: Write `HelpTip`**

```tsx
// apps/web/src/features/help/components/help-tip.tsx
'use client';

import Link from 'next/link';
import { IconHelpCircle } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ArticleBody } from './article-body';
import { useHelpArticle } from '../hooks/use-help';

export function HelpTip({ slug, label = 'Help' }: { slug: string; label?: string }) {
  const article = useHelpArticle(slug);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <IconHelpCircle className="h-4 w-4" />
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        {article.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : article.isError || !article.data ? (
          <p className="text-sm text-muted-foreground">This article isn&apos;t available.</p>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{article.data.title}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <ArticleBody bodyJson={article.data.bodyJson} />
            </div>
            <Link href={`/help/${slug}`} className="text-sm font-medium text-primary hover:underline">
              View full article
            </Link>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Locate the Engagements page header**

Run: `grep -rn "Engagements" apps/web/src/app/\(app\)/engagements/page.tsx | head -5`

Find the `<h1>` (or equivalent) rendering the page title, and add `<HelpTip slug="engagements-overview" />` next to it, importing `HelpTip` from `@/features/help/components/help-tip`. Match the existing header's flex layout so the button sits inline with the title (e.g. wrap both in a `<div className="flex items-center justify-between">` if not already structured that way — read the surrounding ~20 lines before editing to match the existing layout exactly rather than guessing).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @abdcshare/web typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification**

With dev servers running, open the Engagements page, click the new "Help" button, confirm the drawer opens from the right showing "This article isn't available." (correct — no article with slug `engagements-overview` exists yet; Task 13 lets an admin create one to verify the full loop).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/help/components/help-tip.tsx "apps/web/src/app/(app)/engagements/page.tsx"
git commit -m "feat(web): add HelpTip contextual drawer and wire into the Engagements page"
```

---

## Task 12: Web — admin hooks + `/admin/help` list page

**Files:**
- Create: `apps/web/src/features/help/hooks/use-help-admin.ts`
- Create: `apps/web/src/features/help/components/help-admin-page.tsx`
- Create: `apps/web/src/app/(app)/admin/help/page.tsx`
- Modify: `apps/web/src/components/layout/app-sidebar.tsx`

**Interfaces:**
- Consumes: `bffApi` (`apps/web/src/lib/bff/client.ts`), `useAuthContext().can` (`apps/web/src/components/providers/auth-provider.tsx`), `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` (existing `components/ui/table.tsx`), `Badge` (existing `components/ui/badge.tsx`), `EmptyState` (existing).
- Produces: `useHelpCategoriesAdmin()`, `useHelpArticlesAdmin(params)`, `useCreateHelpCategory()`, `useUpdateHelpCategory()`, `useDeleteHelpCategory()`, `useDeleteHelpArticle()`, `usePublishHelpArticle()`, `useUnpublishHelpArticle()` hooks.

- [ ] **Step 1: Write the admin hooks**

```ts
// apps/web/src/features/help/hooks/use-help-admin.ts
'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import type { HelpArticleSummary, HelpCategory } from '../types';

interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface HelpArticleListResponse {
  data: HelpArticleSummary[];
  meta: PageMeta;
}

const categoriesKey = ['help', 'admin', 'categories'] as const;

export function useHelpCategoriesAdmin() {
  return useQuery({
    queryKey: categoriesKey,
    queryFn: () => bffApi<HelpCategory[]>('/api/help/admin/categories'),
  });
}

export function useHelpArticlesAdmin(params: { categoryId?: string; status?: 'draft' | 'published'; page?: number }) {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.status) qs.set('status', params.status);
  qs.set('page', String(params.page ?? 1));
  qs.set('pageSize', '50');
  return useQuery({
    queryKey: ['help', 'admin', 'articles', qs.toString()],
    queryFn: () => bffApi<HelpArticleListResponse>(`/api/help/admin/articles?${qs.toString()}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateHelpCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; slug: string; order?: number; icon?: string }) =>
      bffApi<HelpCategory>('/api/help/categories', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey }),
  });
}

export function useUpdateHelpCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string; name?: string; slug?: string; order?: number; icon?: string }) =>
      bffApi<HelpCategory>(`/api/help/categories/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey }),
  });
}

export function useDeleteHelpCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi<void>(`/api/help/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey }),
  });
}

function invalidateArticles(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ['help', 'admin', 'articles'] });
}

export function useDeleteHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi<void>(`/api/help/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateArticles(qc),
  });
}

export function usePublishHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi(`/api/help/articles/${id}/publish`, { method: 'POST' }),
    onSuccess: () => invalidateArticles(qc),
  });
}

export function useUnpublishHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi(`/api/help/articles/${id}/unpublish`, { method: 'POST' }),
    onSuccess: () => invalidateArticles(qc),
  });
}
```

- [ ] **Step 2: Write the admin list page component**

```tsx
// apps/web/src/features/help/components/help-admin-page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/data/empty-state';
import {
  useCreateHelpCategory,
  useDeleteHelpArticle,
  useHelpArticlesAdmin,
  useHelpCategoriesAdmin,
  usePublishHelpArticle,
  useUnpublishHelpArticle,
} from '../hooks/use-help-admin';

export function HelpAdminPage() {
  const categories = useHelpCategoriesAdmin();
  const articles = useHelpArticlesAdmin({});
  const createCategory = useCreateHelpCategory();
  const deleteArticle = useDeleteHelpArticle();
  const publish = usePublishHelpArticle();
  const unpublish = useUnpublishHelpArticle();

  const [newCategoryName, setNewCategoryName] = useState('');

  const categoryName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Help Center content</h1>
        <Link href="/admin/help/articles/new">
          <Button type="button">New article</Button>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Categories</h2>
        <div className="flex gap-2">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category name"
          />
          <Button
            type="button"
            variant="outline"
            disabled={!newCategoryName.trim() || createCategory.isPending}
            onClick={() => {
              const slug = newCategoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              createCategory.mutate(
                { name: newCategoryName.trim(), slug },
                { onSuccess: () => setNewCategoryName('') },
              );
            }}
          >
            Add category
          </Button>
        </div>
        {categories.data && categories.data.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {categories.data.map((c) => (
              <li key={c.id}>
                <Badge variant="secondary">{c.name}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="No categories yet" />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Articles</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-aca">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(articles.data?.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No articles yet
                  </TableCell>
                </TableRow>
              ) : (
                articles.data!.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-foreground">{a.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{categoryName(a.categoryId)}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'published' ? 'default' : 'secondary'}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/help/articles/${a.id}/edit`}>
                          <Button type="button" size="sm" variant="outline">
                            Edit
                          </Button>
                        </Link>
                        {a.status === 'published' ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => unpublish.mutate(a.id)}>
                            Unpublish
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="ghost" onClick={() => publish.mutate(a.id)}>
                            Publish
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteArticle.mutate(a.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Write the route file**

```tsx
// apps/web/src/app/(app)/admin/help/page.tsx
import { HelpAdminPage } from '@/features/help/components/help-admin-page';

export default function Page() {
  return <HelpAdminPage />;
}
```

- [ ] **Step 4: Add the admin sidebar entry**

In `apps/web/src/components/layout/app-sidebar.tsx`, add to the `"Admin"` section (after `"Activity log"`):

```ts
      {
        label: "Help content",
        href: "/admin/help",
        icon: IconHelpCircle,
        permission: "help:manage",
      },
```

(Reuses the `IconHelpCircle` import added in Task 9.)

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @abdcshare/web typecheck`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Log in as a Platform Admin (or Super Admin) seed user, open `/admin/help`, create a category, confirm it appears in the badge list, confirm the empty-articles table renders correctly.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/help/hooks/use-help-admin.ts apps/web/src/features/help/components/help-admin-page.tsx "apps/web/src/app/(app)/admin/help/page.tsx" apps/web/src/components/layout/app-sidebar.tsx
git commit -m "feat(web): add help admin category/article list page"
```

---

## Task 13: Web — Tiptap editor + article create/edit page

**Files:**
- Create: `apps/web/src/features/help/hooks/use-help-image-upload.ts`
- Create: `apps/web/src/features/help/components/article-editor.tsx`
- Create: `apps/web/src/features/help/components/article-editor-page.tsx`
- Create: `apps/web/src/app/(app)/admin/help/articles/new/page.tsx`
- Create: `apps/web/src/app/(app)/admin/help/articles/[id]/edit/page.tsx`
- Modify: `apps/web/src/features/help/hooks/use-help-admin.ts` (add `useCreateHelpArticle`, `useUpdateHelpArticle`)

**Interfaces:**
- Consumes: `HELP_TIPTAP_EXTENSIONS` (Task 9), `extractPlainText` (Task 7), `useHelpCategoriesAdmin` (Task 12), `bffApi` (existing).
- Produces: `<ArticleEditor initial? onSubmit />` presentational component; two route pages (`new`, `[id]/edit`) that wire it to mutations.

- [ ] **Step 1: Add the article-admin CRUD hooks**

There is no `GET /help/articles/:id` route — only `GET /help/articles/:slug`, which 404s on drafts for non-managers but succeeds for `help:manage` callers regardless of status (per the service's `canManage` check from Task 4). So the edit page loads an existing article by slug, reusing the `useHelpArticle` reader hook from Task 7 — it does not need its own admin get-by-id hook. This means the edit route needs the article's slug, not just its id: change the admin list's edit link to carry it as a query param.

In `apps/web/src/features/help/components/help-admin-page.tsx` (Task 12), change the edit link from:

```tsx
<Link href={`/admin/help/articles/${a.id}/edit`}>
```

to:

```tsx
<Link href={`/admin/help/articles/${a.id}/edit?slug=${encodeURIComponent(a.slug)}`}>
```

Append the create/update mutations to `apps/web/src/features/help/hooks/use-help-admin.ts`:

```ts
export interface HelpArticleWriteDto {
  categoryId: string;
  title: string;
  slug: string;
  bodyJson: Record<string, unknown>;
  bodyText: string;
  visibleToRoles?: string[];
  order?: number;
}

export function useCreateHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: HelpArticleWriteDto) =>
      bffApi<{ id: string }>('/api/help/articles', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => invalidateArticles(qc),
  });
}

export function useUpdateHelpArticle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<HelpArticleWriteDto>) =>
      bffApi<{ id: string }>(`/api/help/articles/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
    onSuccess: () => invalidateArticles(qc),
  });
}
```

- [ ] **Step 2: Write the image upload hook**

```ts
// apps/web/src/features/help/hooks/use-help-image-upload.ts
'use client';

import { useMutation } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.replace(/^data:[^;]+;base64,/, ''));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useUploadHelpImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const data = await fileToBase64(file);
      return bffApi<{ storageKey: string }>('/api/help/images', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, contentType: file.type, data }),
      });
    },
  });
}
```

- [ ] **Step 3: Write the editor component**

```tsx
// apps/web/src/features/help/components/article-editor.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { IconBold, IconItalic, IconList, IconPhoto } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_NAMES, type RoleName } from '@abdcshare/shared';
import { HELP_TIPTAP_EXTENSIONS } from '../lib/tiptap-extensions';
import { extractPlainText } from '../lib/plain-text';
import { useUploadHelpImage } from '../hooks/use-help-image-upload';
import type { HelpCategory } from '../types';

export interface ArticleFormValues {
  title: string;
  slug: string;
  categoryId: string;
  bodyJson: Record<string, unknown>;
  bodyText: string;
  visibleToRoles: string[];
}

export interface ArticleEditorProps {
  categories: HelpCategory[];
  initial?: Partial<ArticleFormValues>;
  onSubmit: (values: ArticleFormValues) => void;
  submitting?: boolean;
}

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

export function ArticleEditor({ categories, initial, onSubmit, submitting }: ArticleEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<string>(initial?.categoryId ?? categories[0]?.id ?? '');
  const rolesRef = useRef<string[]>(initial?.visibleToRoles ?? []);
  const uploadImage = useUploadHelpImage();

  const editor = useEditor({
    extensions: HELP_TIPTAP_EXTENSIONS,
    content: initial?.bodyJson ?? EMPTY_DOC,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && initial?.bodyJson) editor.commands.setContent(initial.bodyJson);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the loaded article identity changes
  }, [editor, initial?.slug]);

  const handleImagePick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;
      const { storageKey } = await uploadImage.mutateAsync(file);
      editor.chain().focus().setImage({ src: '', alt: file.name }).run();
      // setImage doesn't accept custom attrs directly — patch the just-inserted node's storageKey.
      const { state } = editor;
      const pos = state.selection.from - 1;
      editor.chain().command(({ tr }) => {
        tr.setNodeAttribute(pos, 'storageKey', storageKey);
        return true;
      }).run();
    };
    input.click();
  };

  const toggleRole = (role: RoleName, checked: boolean) => {
    rolesRef.current = checked
      ? [...rolesRef.current, role]
      : rolesRef.current.filter((r) => r !== role);
  };

  const handleSubmit = () => {
    if (!editor) return;
    onSubmit({
      title: titleRef.current?.value.trim() ?? '',
      slug: slugRef.current?.value.trim() ?? '',
      categoryId: categoryRef.current,
      bodyJson: editor.getJSON(),
      bodyText: extractPlainText(editor.getJSON()),
      visibleToRoles: rolesRef.current,
    });
  };

  return (
    <div className="space-y-4">
      <Input ref={titleRef} defaultValue={initial?.title} placeholder="Article title" />
      <Input ref={slugRef} defaultValue={initial?.slug} placeholder="article-slug" />

      <Select defaultValue={categoryRef.current} onValueChange={(v) => (categoryRef.current = v)}>
        <SelectTrigger>
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Visible to (none selected = every role)
        </p>
        <div className="flex flex-wrap gap-3">
          {ROLE_NAMES.map((role) => (
            <label key={role} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                defaultChecked={rolesRef.current.includes(role)}
                onChange={(e) => toggleRole(role, e.target.checked)}
              />
              {role}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <div className="flex gap-1 border-b border-border p-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleBold().run()}>
            <IconBold className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <IconItalic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <IconList className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={handleImagePick} disabled={uploadImage.isPending}>
            <IconPhoto className="h-4 w-4" />
          </Button>
        </div>
        <EditorContent editor={editor} className="prose prose-sm max-w-none p-3" />
      </div>

      <Button type="button" onClick={handleSubmit} disabled={submitting}>
        Save
      </Button>
    </div>
  );
}
```

Note: `SelectItem` cannot take an empty-string `value` per Radix's Select contract, so category `id`s (UUIDs) are safe here.

- [ ] **Step 4: Write the page-level wiring component**

```tsx
// apps/web/src/features/help/components/article-editor-page.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArticleEditor, type ArticleFormValues } from './article-editor';
import { useHelpArticle } from '../hooks/use-help';
import {
  useCreateHelpArticle,
  useHelpCategoriesAdmin,
  useUpdateHelpArticle,
} from '../hooks/use-help-admin';

export function ArticleEditorPage({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') ?? '';
  const categories = useHelpCategoriesAdmin();
  const existing = useHelpArticle(slug);
  const create = useCreateHelpArticle();
  const update = useUpdateHelpArticle(articleId ?? '');

  if (articleId && (existing.isPending || categories.isPending)) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const handleSubmit = (values: ArticleFormValues) => {
    if (articleId) {
      update.mutate(values, { onSuccess: () => router.push('/admin/help') });
    } else {
      create.mutate(values, { onSuccess: () => router.push('/admin/help') });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {articleId ? 'Edit article' : 'New article'}
      </h1>
      <ArticleEditor
        categories={categories.data ?? []}
        initial={
          articleId && existing.data
            ? {
                title: existing.data.title,
                slug: existing.data.slug,
                categoryId: existing.data.categoryId,
                bodyJson: existing.data.bodyJson,
                visibleToRoles: existing.data.visibleToRoles,
              }
            : undefined
        }
        onSubmit={handleSubmit}
        submitting={create.isPending || update.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 5: Write the two route files**

```tsx
// apps/web/src/app/(app)/admin/help/articles/new/page.tsx
import { ArticleEditorPage } from '@/features/help/components/article-editor-page';

export default function Page() {
  return <ArticleEditorPage />;
}
```

```tsx
// apps/web/src/app/(app)/admin/help/articles/[id]/edit/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { ArticleEditorPage } from '@/features/help/components/article-editor-page';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <ArticleEditorPage articleId={id} />;
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @abdcshare/web typecheck`
Expected: no errors. If `Select`/`SelectItem`/`SelectTrigger`/`SelectValue` don't match `components/ui/select.tsx`'s actual export names, fix the import to match (check the file — it exists per the earlier `components/ui` listing).

- [ ] **Step 7: Manual, end-to-end verification (do not skip)**

With `pnpm dev` running and logged in as Platform Admin:
1. Go to `/admin/help`, create a category (e.g. "Engagements").
2. Click "New article", fill in title "Engagements overview", slug `engagements-overview`, pick the category, write a paragraph, insert an image, leave "Visible to" empty (all roles), save.
3. Confirm redirect to `/admin/help` and the new article shows status "draft".
4. Click "Publish".
5. Go to `/help`, confirm the article appears under its category and the image renders.
6. Go to `/engagements`, click the "Help" button added in Task 11, confirm the drawer now shows the "Engagements overview" article (since its slug now matches `engagements-overview`) with the image rendering correctly (proves read-time URL rehydration works end to end).
7. Log in as a Client-role seed user, confirm "Help content" does not appear under Admin, and confirm `/help` still shows the published article (visibleToRoles was empty = all roles).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/help apps/web/src/app/\(app\)/admin/help
git commit -m "feat(web): add Tiptap article editor and create/edit admin pages"
```

---

## Task 14: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full API test suite**

Run: `pnpm --filter @abdcshare/api test`
Expected: PASS, including all `help.service.spec.ts` cases.

- [ ] **Step 2: Run the full web test suite**

Run (from `apps/web/`): `../api/node_modules/.bin/jest --config jest.config.js`
Expected: PASS, including `plain-text.spec.ts`.

- [ ] **Step 3: Typecheck and lint everything**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors in either app or `packages/shared`.

- [ ] **Step 4: Re-run the Task 13 Step 7 manual walkthrough once more end to end**

Confirms nothing regressed across the full set of commits. Pay particular attention to the Client-role visibility check (Step 7 of Task 13) — this is the one behavior a passing test suite cannot fully prove, since it depends on the interaction between `visibleToRoles` filtering and the live sidebar/permission system together.

- [ ] **Step 5: Update `PROGRESS.md`**

Read the file's existing format (`PROGRESS.md` at the repo root) and add an entry describing the Help Center feature, following whatever section/heading convention the most recent entries use.

- [ ] **Step 6: Commit**

```bash
git add PROGRESS.md
git commit -m "docs: log Help Center feature in PROGRESS.md"
```
