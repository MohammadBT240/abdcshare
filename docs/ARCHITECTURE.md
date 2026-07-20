# Quantum — Technical Architecture & Conventions

> How Quantum is built. Read after DOMAIN_MODEL.md and USER_STORIES.md.
> This is the engineering contract: follow these patterns so the codebase stays consistent.
>
> **v2 — monorepo direction.** Quantum is a **pnpm + Turborepo monorepo** with a standalone **NestJS**
> backend (DDD) and a **Next.js** web client, modeled on the `ondoo` house standard and elevated where
> noted. The monorepo root is `abdcshare/`.

---

## 1. Tech stack (decided)

| Concern | Choice | Notes |
|---------|--------|-------|
| Monorepo | **pnpm workspace + Turborepo** | Cached, orchestrated tasks across apps/packages; single lockfile; `.npmrc` `node-linker=hoisted`. |
| Language | **TypeScript (strict)** everywhere | `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. |
| Backend framework | **NestJS** | Modular monolith (`apps/api`) + separate worker service (`apps/worker`), DDD/hexagonal. |
| ORM | **MikroORM** | Identity map + unit of work fit DDD; migrations per app. (Matches ondoo.) |
| Database | **PostgreSQL** | One DB shared by `api` and `worker`. |
| Cache / queue transport | **Redis** | Backing store for BullMQ. |
| Async jobs | **BullMQ** + **transactional outbox** | Reliable domain-event → job delivery; see §8. |
| Scheduling | **BullMQ repeatable/delayed jobs** (+ `@nestjs/schedule` for the outbox drain) | Reminders, digests. |
| API auth | **JWT access + rotating refresh** issued by `api` | Guards + RBAC; web holds tokens in httpOnly cookies via a thin BFF. |
| Web framework | **Next.js (App Router)** | Server Components for reads where possible; client where interactive. |
| Web ↔ API | **OpenAPI-generated typed client** + **TanStack Query** | FE/BE types can't drift. |
| Web forms | **react-hook-form + Zod** (shared schemas from `packages/shared`) | |
| Styling | **Tailwind CSS + shadcn/ui** | ACA green identity (DESIGN_SYSTEM.md). |
| Tables / grids | **TanStack Table** | Server-side pagination (§7). |
| Charts | **Recharts** | Dashboards. |
| File storage | **Cloudflare R2** (S3 SDK) + local fallback | Private; presigned downloads. |
| Email | **Resend** + **React Email** | Sent **only from the worker**; typed templates. |
| Validation | **Zod** (web + shared) / **class-validator DTOs** (Nest) | Validate at every boundary. |
| Testing | **Vitest**/**Jest** (unit) · **Supertest** (API e2e) · **Playwright** (web e2e) | |
| Lint/format | **ESLint** + **Prettier** + `tsc` | Shared presets in `packages/config`. |
| Package manager | **pnpm** (v10+) | |
| Runtime | **Node LTS** | |

> **Versions:** pin **latest stable** for every package at scaffold time by resolving live (`pnpm add`
> resolves newest stable) — not from memory. Expect current-majors around Nest 11, MikroORM 6, Next 15,
> React 19, TanStack Query 5, BullMQ 5, Tailwind (latest). Confirm each at Phase 0.

---

## 2. Guiding principles

1. **Separation of concerns across the wire.** The **API owns all business logic and data**; the web app
   is a presentation client. No domain rules live in the frontend.
2. **DDD in the backend.** Each Nest module is split into `presentation` / `application` / `domain` /
   `infrastructure`. Simple modules may stay flatter, but the dependency direction always points inward.
3. **One shared contract.** DTO shapes, enums, the pagination contract, and event payloads live in
   `packages/shared` (+ the generated API client). Both sides import them — types never drift.
4. **Validate and authorise at every boundary.** Every controller validates DTOs and checks a permission
   before work. The web re-gates for UX only; the API is the real gate.
5. **Reliable async.** Anything triggered by a domain change that must not be lost goes through the
   **outbox** → BullMQ → **worker**. The worker is a **separate service** from day one.
6. **Typed end-to-end**, `any` banned, small units, features/modules are islands.
7. **Every list is paginated** (§7) — no exceptions.

---

## 3. Monorepo layout

```
abdcshare/                      # monorepo root
├─ package.json                 # private root; workspace scripts
├─ pnpm-workspace.yaml
├─ turbo.json                   # task graph + caching
├─ .npmrc                       # node-linker=hoisted
├─ tsconfig.base.json
├─ apps/
│  ├─ api/                      # NestJS — HTTP API (modular monolith, DDD)
│  ├─ worker/                   # NestJS — async worker (BullMQ consumers + schedulers)
│  └─ web/                      # Next.js — frontend client
├─ packages/
│  ├─ shared/                   # Zod schemas, TS types, enums, pagination + event contracts, queue names
│  ├─ config/                   # eslint / tsconfig / prettier presets
│  └─ api-client/               # OpenAPI-generated typed client (consumed by web)
├─ deploy/                      # Dockerfiles, docker-compose stack, Postgres/Redis init
├─ ansible/                     # provisioning (adopted from ondoo, elevated)
├─ .github/workflows/           # per-app build + staging/prod deploy
└─ docs/                        # these planning docs
```

**Turborepo** wires `build`, `lint`, `test`, `typecheck`, `dev` across the graph with caching, so
`packages/shared` builds once and both apps consume it; CI only rebuilds what changed.

**Local `pnpm dev`:** Turbo runs every workspace `dev` script in parallel — `packages/shared`
(`tsc --watch`), `apps/api` + `apps/worker` (`nest start --watch`), and `apps/web` (`next dev`).
Postgres/Redis stay outside that command (compose infra or a host Postgres + compose Redis). Full
containerized apps use `docker compose --profile full` (see DEPLOYMENT.md §2).

---

## 4. Backend — `apps/api` (NestJS, DDD)

```
apps/api/src/
  main.ts
  app.module.ts
  bootstrap/          # configureApp, Swagger/OpenAPI, versioning, global pipes/filters/interceptors
  common/             # dto, enums, decorators, guards, filters, pagination, utils
  config/             # env.schema (Zod-validated), ConfigModule
  database/           # mikro-orm.config.ts, base repository, request-scoped EM
  migrations/
  health/             # GET /health (no /api prefix)
  modules/
    auth/             # JWT access/refresh, guards, RBAC (@RequirePermission)
    users/  roles/  clients/  departments/
    engagement-types/  fs-lines/  request-types/  request-stages/  request-statuses/
    engagements/  requests/  documents/  submissions/  discussions/  reviews/
    notifications/    # writes notifications + outbox rows (fan-out happens in worker)
    company-profile/
    outbox/           # transactional outbox + publisher (§8)
    audit/            # activity-log writer (synchronous, in-transaction)
```

**Inside a non-trivial module** (hexagonal — mirrors ondoo):

```
engagements/
  engagements.module.ts
  presentation/       # controllers + DTOs (request/response, incl. *-paginated-response.dto.ts)
  application/        # use cases (CreateEngagement, TransitionEngagementStatus, ...)
  domain/             # entities, value objects, repository PORTS (interfaces), domain events
  infrastructure/
    persistence/      # MikroORM entities + repository ADAPTERS (implement the ports)
```

**Dependency rule (hexagonal):** `presentation → application → domain`; `infrastructure` implements
`domain` ports and is wired by the module. **Domain never imports Nest, MikroORM, or infrastructure.**
Simple catalogue modules (stages, statuses) may stay flat (`*.controller.ts` + `*.service.ts`) like
ondoo's smaller modules — but never invert the dependency direction.

**Layer responsibilities**
- **Controllers** (presentation): route, validate DTOs, check permissions (guards/decorators), call a
  use case, shape the response DTO. No logic.
- **Use cases** (application): orchestrate one operation; own the **unit of work / transaction**;
  emit domain events and write the outbox row **in the same transaction**.
- **Domain**: entities with behaviour, value objects, invariants, repository ports. Pure TS.
- **Repositories** (infrastructure): MikroORM adapters implementing ports; parameterised queries,
  pagination, `select`/`populate`. No business rules.

**API surface:** REST under `/api/<domain>/v1/...`, versioned; global `ValidationPipe`; consistent error
filter; **Swagger/OpenAPI** generated at build → feeds `packages/api-client`.

---

## 5. Worker — `apps/worker` (NestJS, separate service)

A standalone Nest application (its own deployable, its own container) that shares the Postgres DB and the
`packages/shared` contracts, and consumes Redis/BullMQ.

```
apps/worker/src/
  main.ts             # boots Nest app context (no HTTP server)
  app.module.ts
  config/             # env.schema (Zod): DATABASE_URL, REDIS_URL, RESEND_API_KEY, R2_*
  database/           # MikroORM (same DB as api) for outbox/notifications/document updates
  queue/              # BullMQ connection + queue registrations (names from packages/shared)
  consumers/          # notification.consumer, document.consumer  (BullMQ Workers)
  schedulers/         # registers repeatable jobs: deadline reminders, digests
  email/              # Resend dispatch + React Email templates
```

- **Consumers** process jobs (send email via Resend, fan out in-app notifications, generate previews,
  build zip exports) and **update the outbox row status directly** in the shared DB (Pending → Queued →
  Sent/Failed). Because the worker shares the DB, we skip ondoo's Redis-stream "seal" hop — simpler, still
  reliable. (If the worker is ever split to its own DB, reintroduce the stream seal.)
- **Schedulers** register BullMQ **repeatable** jobs on boot (e.g. nightly reminder scan) and enqueue
  **delayed** jobs (e.g. a reminder scheduled at request-create time for `dueDate − 1d`).
- Graceful shutdown: close workers/queues on `OnModuleDestroy`.

---

## 6. Frontend — `apps/web` (Next.js)

```
apps/web/src/
  app/                # App Router: (auth) + (app) route groups, pages, layouts
  app/api/bff/        # thin BFF route handlers: proxy to NestJS, manage httpOnly auth cookies
  features/<name>/    # components / hooks / schema / types (per feature)  — NO server-side domain logic
  components/         # ui (shadcn), layout (AppSidebar/Header/PageToolbar), data-table
  hooks/  lib/        # shared client hooks + utils (cn, formatting, http)
  middleware.ts       # coarse route gating from the session cookie
```

- **Data access:** the web app talks to the API through the **generated `@quantum/api-client`** wrapped
  in **TanStack Query** hooks (`features/*/hooks.ts`). Components never `fetch` inline.
- **Reads** happen in Server Components where possible (server calls the API with the request's token);
  interactive lists/mutations use TanStack Query hooks on the client.
- **No Server Actions as a backend.** Server Actions may be used only as trivial passthroughs to the BFF
  where convenient; all real logic is in the NestJS API.
- **Auth (BFF pattern):** the browser never holds raw JWTs. Login/refresh go through `app/api/bff/*`
  route handlers that set **httpOnly, Secure, SameSite** cookies holding the access/refresh tokens and
  proxy authenticated calls to the API (attaching the bearer token server-side). `middleware.ts` does
  coarse route gating; the API remains the real authorization gate. This keeps tokens out of JS and
  handles silent refresh centrally.

---

## 7. Pagination standard — **every list endpoint is paginated**

**Rule:** no endpoint returns an unbounded collection. Every list — grids, dropdown sources, reports,
notification feeds, discussions, audit log — paginates, caps page size, and returns `meta`. Enforced by
DoD and code review. The contract lives in `packages/shared` so API and web agree exactly.

```ts
// packages/shared/pagination.ts
export const paginationQuery = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),  // hard cap 100
  cursor:   z.string().optional(),                                // cursor mode
  sort:     z.string().optional(),                                // "dueDate:desc" (allow-listed)
  q:        z.string().trim().max(200).optional(),
});
export type PageMeta = {
  page: number; pageSize: number; total: number; totalPages: number;
  hasNext: boolean; hasPrev: boolean; nextCursor?: string | null;
};
export type Paginated<T> = { data: T[]; meta: PageMeta };
```

Rules: **offset mode** (default) for admin grids/reports (MikroORM `limit/offset` + `count`);
**cursor mode** for high-volume feeds (notifications, discussion, audit — MikroORM cursor on an indexed
sort key). `pageSize` hard-capped server-side; **deterministic sort with an `id`/`createdAt` tiebreaker**;
sortable/filterable columns **allow-listed** (no SQL injection of columns); every filter/sort key backed
by a **DB index**; exports stream in batched pages, never whole-table. Nest exposes typed
`*-paginated-response.dto.ts` (mirrors ondoo); web consumes `Paginated<T>` via TanStack Query
(`keepPreviousData` for grids, `useInfiniteQuery` for feeds). Pagination/filter state lives in the URL.

---

## 8. Async architecture (outbox → BullMQ → worker)

Adopted from ondoo (transactional outbox + BullMQ/Redis + a **separate** worker service) — the worker is
its own deployable from day one.

```
[api use case] --tx--> Postgres (domain rows + OUTBOX row, one transaction)
      outbox publisher (@nestjs/schedule cron, short interval)
             │  reads Pending rows → enqueue BullMQ job (jobId = outbox.id) → mark Queued
             ▼
        Redis (BullMQ queues: notifications, documents, scheduled)
             ▼
[apps/worker consumers] → send email (Resend) / fan out notifications / process docs
             │  on success/failure → update OUTBOX row status directly (shared DB)
             ▼  retries + backoff + DLQ handled by BullMQ
```

**Why:** the outbox is written **in the same transaction** as the domain change, so we never emit an
event for a rolled-back operation and never lose one for a committed operation (solves the dual-write
problem). BullMQ gives retries, backoff, **rate limiting** (respects Resend limits), **delayed** jobs
(deadline reminders scheduled at create time) and **repeatable** jobs (digests). A failed email can
never roll back a business operation — they're decoupled by the queue.

**Queues:** `notifications` (email + in-app fan-out), `documents` (preview/thumbnail, virus scan, zip
export), `scheduled` (reminders, digests via repeatable jobs). Job idempotency via `jobId = outbox.id`.
Add a **dead-letter queue** + a **Bull Board** dashboard for observability (elevation over ondoo).

---

## 9. Auth & RBAC

- **`api` issues JWTs:** short-lived **access** (~15 min) + long-lived **rotating refresh** (with reuse
  detection → revoke the token family). Refresh tokens are stored **hashed** in a `refresh_tokens` table
  (see ERD.md). `must_change_password` gates all but the change-password + logout routes.
- **Guards:** `JwtAuthGuard` (authenticate) → `PermissionsGuard` reading `@RequirePermission('...')`
  decorators. Resource-scoped checks (e.g. "is this user on the engagement team?") live in the use case.
- **Permission model** (replaces ACA's `_permissions.php`): a typed permission set mapped per role in
  `packages/shared`, consumed by the API guard **and** by the web to drive the sidebar/menu — **one
  source**, so menu and access can never drift (fixes a known ACA bug).
- Governance writes = **Platform Admin only**; Super Admin is read-only on governance — enforced in use
  cases, tested per role.
- **Defence in depth:** web middleware (route) → BFF (cookie/token) → API guard (permission) → use case
  (resource scope). The web check is UX only.

---

## 10. Shared packages (anti-drift backbone)

- **`packages/shared`** — Zod schemas + inferred types for common shapes, **enums mirroring the ERD**
  (`EngagementStatus`, `DocumentCategory`, …), the **pagination contract**, **queue names + job payload
  types**, permission definitions, and error codes. Imported by `api`, `worker`, and `web`.
- **`packages/api-client`** — generated from the API's **OpenAPI** spec (e.g. `openapi-typescript` /
  `orval`) on build; the only way `web` calls the API. Regenerated in CI when the API contract changes.
- **`packages/config`** — shared `tsconfig.base`, ESLint (incl. boundary rules), Prettier.

---

## 11. Validation, errors, logging

- **API:** class-validator DTOs on every controller input; a global exception filter maps typed domain
  errors (`ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError`) to HTTP status +
  a consistent JSON error body `{ error, code?, fieldErrors? }`.
- **Web:** Zod at form/BFF boundaries; TanStack Query surfaces errors to toasts + field errors.
- **Env:** validated once at boot with a Zod schema in each app's `config/env.schema.ts`; crash fast.
- **Logging:** structured (pino/Nest logger) with correlation IDs; never log secrets/tokens; no
  `console.log` in committed code. Every significant mutation writes an **audit-log** entry (synchronous).

---

## 12. File storage & uploads

- Uploads stream to **R2** via the S3 SDK from the API (or presigned direct-PUT for large files); DB stores
  a `storageKey` (`{prefix}/{engagementId}/{fsLineId}/{basename}`) + metadata + version.
- Validate size + MIME server-side (`file-type`); reject executables; never trust client MIME.
- Downloads/previews only through an authenticated API endpoint (presigned GET redirect / local stream) —
  no public bucket URLs. Heavy processing (thumbnails, virus scan, zip export) runs in the **worker**.

---

## 13. Testing & quality gates

- **API:** unit tests for use cases/domain/RBAC (mock repository ports); e2e with **Supertest** against a
  test Postgres (Testcontainers). Pagination correctness tests (no overlap/skip).
- **Worker:** unit tests for consumers/schedulers with a mocked queue; integration against Redis+PG in CI.
- **Web:** unit (Vitest) for hooks/utils; **Playwright** e2e per role for critical flows.
- **CI (Turbo-aware):** typecheck → lint → unit → build → integration/e2e, only for affected projects.
  Migrations gated in CI. Red = no merge.

---

## 14. Deployment

- **Docker** image per app (`api`, `worker`, `web`); **docker-compose stack** with Postgres, Redis, a
  one-shot migrate job, api, worker, web (adopted from ondoo's `docker-compose.stack.yml`).
- **Ansible** provisioning (adopted, elevated); **GitHub Actions** per-app build + staging/prod deploy.
- **Elevations over ondoo:** container registry + health-gated/blue-green deploys; consider Terraform for
  cloud infra; Bull Board + metrics for the worker.
- **Migrations** (MikroORM) run as a gated deploy step, never by hand.

---

## 15. Data migration from ACA

- Model the MikroORM schema on DOMAIN_MODEL/ERD, not the legacy tables.
- One-off scripts map `aca.sql` → new schema: users/roles, clients, request types → default FS line,
  documents → backfilled "legacy" engagement per client, activity log. Dry-run → verify → cutover.
- Legacy service lines → **departments**; legacy request types assigned to FS lines during import.

---

## 16. Naming & conventions (cross-cutting)

| Thing | Convention |
|-------|-----------|
| Files | kebab-case (`engagement.controller.ts`, `create-engagement.usecase.ts`, `engagement-form.tsx`) |
| Nest providers | PascalCase classes; `*Controller`, `*Service`, `*Repository`, `*UseCase` |
| Web components | PascalCase; hooks `useX` |
| DTOs | `Create*Dto`, `Update*Dto`, `*ResponseDto`, `*PaginatedResponseDto` |
| MikroORM entities | PascalCase → snake_case table via `@Entity({ tableName })` |
| Shared enums/schemas | one source in `packages/shared` |
| Env vars | SCREAMING_SNAKE, Zod-validated |
| Imports | workspace aliases (`@quantum/shared`), `@/*` within an app; no deep cross-package/feature imports |

---

## 17. Open technical questions

1. **Hosting/runtime** — single VPS via Ansible/Docker (like ondoo), or a managed platform? Affects Redis/PG hosting and deploy.
2. **Web rendering** — how much SSR vs client — do we need SEO-grade SSR anywhere, or is this an authed app (mostly client)? 
3. **Realtime** — notifications/discussions via polling first, or SSE/WebSocket (a future worker/gateway) soon?
4. **Refresh-token storage** — DB table (planned) vs Redis; confirm rotation + reuse-detection policy.
5. **Legacy migration** — full historical import, or start fresh + keep ACA read-only for archives?
