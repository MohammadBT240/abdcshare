# Help Center — Design

**Status:** Approved for planning
**Date:** 2026-09-01

## Problem

abdcshare has five roles (Platform Admin, Super Admin, Staff, Client, Guest) with materially
different screens and permissions (`packages/shared/src/permissions.ts`). There is no in-app
reference for how to perform role-specific operations (raising a request, responding to a
submission, running a partner report, managing catalogues, etc.). New users — especially
Clients and Guests, who get no formal onboarding — have no way to self-serve an answer.

## Goals

- A browsable, searchable Help Center (`/help`) with content scoped to what the viewing role can
  actually do.
- Contextual "?" entry points on complex pages that deep-link straight to the relevant article.
- Non-technical staff (Platform Admin, Super Admin) can author and publish articles from within
  the app — no code change, no deploy.
- Rich content: headings, lists, bold/italic, inline images/screenshots.

## Non-goals (v1)

- Article revision history / version diffing (draft + published state is enough for now).
- Video embeds.
- Full-text search infrastructure (Postgres `tsvector`) — plain `ILIKE` is sufficient at expected
  content volume (tens of articles) and can be upgraded later without a data-model change.
- Per-article feedback ("was this helpful?") — worth adding later, not required for launch.
- AI-driven or automatic matching of contextual help to a page — entry points are wired by hand,
  one article per placement.

## Approaches considered

1. **Bespoke `help` module in the existing stack (chosen).** New DB-backed content
   (categories + articles), authored via an in-app rich-text editor, gated by a new `help:manage`
   permission. Built as a new NestJS module mirroring the existing `audit` module, and a new
   `features/help/` on the web side mirroring `features/activity-log/`. Fully reuses existing
   auth, RBAC, storage, and testing conventions.
2. **Code-authored MDX/Markdown, no admin editor.** Cheaper to build (no DB tables, no editor, no
   upload plumbing) but fails the core requirement: every content edit needs a developer and a
   deploy. Rejected.
3. **Third-party help widget (Intercom/Helpscout/Notion-embed).** Fastest to stand up, ships
   search and an editor for free, but adds a new vendor/cost, moves content outside the app's
   infra, and doesn't understand this app's specific 5-role RBAC model — role-scoping would be
   awkward. Rejected as unnecessary vendor surface for a containable problem.

## Data model

Two new MikroORM entities (Postgres), following the existing entity conventions
(see `apps/api/src/modules/audit/infrastructure/persistence/activity-log.entity.ts` for style):

**`HelpCategoryEntity`**
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| name | string | |
| slug | string | unique |
| order | int | display order |
| icon | string, nullable | Tabler icon name, matches sidebar's icon set |

**`HelpArticleEntity`**
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| category | ref → HelpCategoryEntity | |
| title | string | |
| slug | string | unique |
| bodyJson | jsonb | Tiptap/ProseMirror document |
| bodyText | text | plain-text extract of `bodyJson`, denormalized at save time, used for search |
| visibleToRoles | string[] (RoleName[]) | empty array = visible to all roles |
| status | enum: `draft` \| `published` | |
| order | int | display order within category |
| createdBy | ref → UserEntity | |
| updatedAt | timestamp | |
| publishedAt | timestamp, nullable | |

No revision-history table in v1 (see Non-goals). `updatedAt` + draft/published status is enough
for a firm this size; a revision table can be added later without touching existing columns.

## Permissions

Two additions to `packages/shared/src/permissions.ts`, following the existing pattern exactly:

- `help:manage` — added to `ROLE_PERMISSIONS['Platform Admin']` and
  `ROLE_PERMISSIONS['Super Admin']`. Governs create/update/delete/publish of categories and
  articles.
- **Reading is not permission-gated.** Every authenticated role can open the Help Center;
  visibility is filtered by each article's `visibleToRoles`, not by a permission check — help
  content isn't a privileged resource the way audit data is.

## API (`apps/api/src/modules/help/`)

Mirrors the `audit` module's shape (controller + service + DTOs):

- `GET /help/categories` — categories with their published, role-visible articles nested.
  Filtered server-side to the caller's role.
- `GET /help/articles/:slug` — single article. 404 if not visible to the caller's role or not
  published, *unless* the caller has `help:manage` (authors can preview drafts).
- `GET /help/search?q=` — `ILIKE` over `title` and `bodyText`, same filtering rules as above.
  Follows the existing `$ilike` filter-building pattern used in `AuditService.buildWhere`.
- Admin, `help:manage`-guarded:
  - `POST/PATCH/DELETE /help/categories`
  - `POST/PATCH/DELETE /help/articles` (including publish/unpublish as a status transition)
  - Inline image upload: reuse the existing Uppy + `@uppy/aws-s3` → R2 pipeline
    (`apps/web/src/lib/uploads/uppy-client.ts`) rather than building new upload plumbing.

## Web UX (`apps/web/src/features/help/`, mirroring `features/activity-log/`)

- **Sidebar** (`components/layout/app-sidebar.tsx`): new "Help" entry, no `permission` field set
  (visible to every role, same as "Settings").
- **`/help`** — Help Center home: search bar, categories as an accordion/card grid, filtered to
  the viewer's role.
- **`/help/[slug]`** — article reader: breadcrumb, rendered rich content, related articles from
  the same category.
- **`/admin/help`** — authoring list (categories + articles, draft/published badges), same table
  pattern as `features/catalogues/components/request-classes-types-table.tsx`.
- **`/admin/help/articles/[id]/edit`** — Tiptap-based editor (new dependency — no rich-text
  editor exists in the repo today): headings, lists, bold/italic, inline images via the upload
  endpoint, role-visibility multi-select, draft/publish toggle, live preview.
- **Contextual entry points**: a `HelpTip` component (a "?" affordance) placed next to page
  headers on complex screens (Engagements, Requests, Reviews, etc.), each hand-wired to one
  article slug. Opens a right-side `Sheet` with that article inline, plus a "view full article"
  link to `/help/[slug]`.

## Error handling

- A `HelpTip` pointing at an article that's since been unpublished/deleted shows a graceful
  "this article isn't available" state in the drawer, not a broken link.
- Non-`help:manage` users hitting an `/admin/help` route get the same 403/redirect treatment as
  every other admin section.
- Empty search results get a plain empty state — no fabricated suggestions.

## Testing

- API: service-level tests for role-visibility filtering and the `help:manage` guard, in the
  style of `apps/api/src/modules/audit/audit.service.spec.ts`.
- Web: component tests for role-filtered rendering of categories/articles.
- Manual: drive the editor → publish → view flow in a real browser across at least one internal
  role and one external (Client) role before calling this done, per this project's UI-testing
  expectations.

## Open questions

None blocking. Two deliberate deferrals to revisit if usage shows a need: revision history, and
promoting search from `ILIKE` to Postgres full-text.
