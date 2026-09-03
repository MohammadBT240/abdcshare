# abdcshare — Progress Ledger

Resumable status so any session (or dev) can continue exactly where we stopped.

## Done — deployment pipeline (house standard, shared VM)
- Full deploy layer built (see `docs/DEPLOYMENT.md` for the runbook):
  - **Prod Dockerfiles** (`deploy/Dockerfile.{api,worker,web}`) — multi-stage, prod-only deps,
    Next `output: 'standalone'`; root `.dockerignore` added (the old single-stage files copied
    `.env` + `.pnpm-store` into images).
  - **`deploy/docker-compose.stack.yml`** — GHCR pull-only stack (postgres 17, redis 7 AOF, api,
    worker, web + `migrate`/`seed` one-shot profiles); ports bind 127.0.0.1 only; volumes prefixed
    by `COMPOSE_PROJECT_NAME` (`abdcshare` / `abdcshare-staging`); `compose.env*.example` templates.
  - **`ansible/`** — deploy playbook (rsync → render `.env` from Vault → pull → migrate → up →
    health smoke checks → project-scoped image GC keeping 5 tags) + `abdcshare_nginx` role
    (4 vhosts, Certbot webroot bootstrap, coexists with abdchub/QET site files on the shared host).
  - **Workflows** — `deploy-staging.yml` (push to `staging`) and `deploy.yml` (push to `main`,
    `environment: production` approval gate); CI-gated, Buildx + GHA cache, SHA-pinned deploys,
    concurrency groups.
- Domains: `abdcshare.com`/`www` + `api.` (prod), `staging.` + `staging-api.` (staging).
  Host ports 3100/4100 (prod), 3101/4101 (staging) — verified free on the VM (abdchub: 3000/8080,
  3002/8081; QET: 3001, 3003).
- Migrate runs the api image's compiled `dist/database/setup.js` (`SKIP_SEED=1`); seed is a manual
  one-shot profile (idempotent, creates Platform Admin from `SEED_ADMIN_*`).
- Remaining manual steps before first deploy: DNS records, encrypted `vault.yml` per env, R2
  buckets, GitHub secrets + `production` environment reviewer (DEPLOYMENT.md §7).

## Done — CI gate repaired (was red repo-wide, blocked the deploy pipeline)
- **Lint was broken everywhere**: ESLint 9 flat configs were never created per package, so every
  `eslint src` died with "couldn't find eslint.config". Added `eslint.config.mjs` to api, worker,
  web, shared, api-client (re-export `@abdcshare/config/eslint`); web's also loads
  `@next/eslint-plugin-next` (recommended) + `react-hooks/rules-of-hooks`(error)/`exhaustive-deps`(warn)
  — the classic pair `next lint` (removed in Next 16) used to enforce. The react-hooks plugin's full
  recommended set (React Compiler-era rules) flags ~43 existing patterns — adopt separately.
- Auto-fixed ~180 accumulated violations (mostly `import type`), removed dead imports, added
  `argsIgnorePattern: '^_'` to the shared no-unused-vars rule.
- **Two type errors** only surfaced by `next build`'s checker (would have broken the web image):
  invalid Button variant `"secondary"` in `requests/[id]/page.tsx`, unchecked index in
  `request-history-list.tsx`.
- **web/worker `test` scripts** invoked jest that was never installed — now explicit no-op
  placeholders until the planned Vitest/consumer tests exist (api keeps its real jest run).
- Verified green with cold cache: typecheck 7/7, lint 5/5, build 5/5, test 5/5; all three Docker
  images build (api 1.0GB, worker 1.7GB incl. LibreOffice, web 419MB); web container serves /login
  (standalone), worker has `soffice` on PATH, api image resolves `@abdcshare/shared` and carries
  `dist/database/{setup,seed}.js` + `dist/migrations` for the one-shot profiles.

## Done
- **Planning docs** complete in `docs/` (domain, user stories, traceability, ERD, architecture,
  design system, execution plan, development guidelines).
- **Phase 0 scaffold committed** (`git log`: "chore: scaffold abdcshare monorepo (Phase 0)"):
  - pnpm + Turborepo workspace (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `tsconfig.base.json`).
  - `packages/shared` — enums (mirror ERD), pagination contract, permission map, queue names + job payloads, event types, error codes.
  - `packages/config` — eslint + prettier presets.
  - `apps/api` — NestJS + MikroORM + config (Zod env) + health + global exception filter + **transactional outbox** (entity, service, cron publisher → BullMQ) + demo endpoint proving the outbox write.
  - `apps/worker` — NestJS app context + BullMQ **notification consumer** (seals outbox) + Resend email dispatch stub + MikroORM.
  - `apps/web` — Next.js App Router + Tailwind (ACA theme tokens) + TanStack Query provider + app shell (sidebar/header) + dashboard page + BFF health proxy + middleware stub.
  - `deploy/` — docker-compose (Postgres 17, Redis 7, api/worker/web + profiles) + Dockerfiles; `.github/workflows/ci.yml`.

## Done — branch `feature/first-migration`
- Pushed to GitHub: `MohammadBT240/abdcshare` (personal). `main` up to date.
- **Initial-schema MikroORM entities authored** (`apps/api/src/modules/*/infrastructure/persistence/*.entity.ts`):
  roles, departments, clients, users, refresh_tokens, password_reset_tokens, engagement_types,
  fs_lines, fs_line_engagement_types, request_types, request_stages, request_statuses,
  company_profile, activity_log (+ existing outbox). These are the source for the initial migration.
- **Seed script** `apps/api/src/database/seed.ts` — roles, departments, base catalogues, stages,
  statuses, and a default Platform Admin (`admin@abdcshare.local` / `ChangeMe!123`, mustChangePassword).
  Password hashing uses `bcryptjs` (pure JS, no native build). Seed via `seed:dev` (ts-node).

## Environment notes (root-cause fixes)
- **pnpm 11 build gate:** pnpm 11.15 uses `allowBuilds:` (boolean map) in `pnpm-workspace.yaml`, not
  the old `onlyBuiltDependencies`. Placeholders it seeds ("set this to true or false") are invalid and
  keep native builds "ignored" — which pnpm treats as fatal for `pnpm run`. Fixed with real booleans
  (`sharp: true`, others `false`) and by removing the one mandatory native dep (bcrypt → **bcryptjs**).
- **Per-app `.env`:** each app (`apps/api`, `apps/worker`, `apps/web`) has its own `.env` (ondoo-style),
  because CLI/dev commands run with cwd inside the app, so a root `.env` isn't found. Configs
  `import 'dotenv/config'` to load it before evaluation. MikroORM CLI runs via **ts-node** (`useTsNode`),
  so no build/dist dance for migrations.

## Run locally to finish the first migration (your Mac: fast network + Docker)
```bash
cd /Applications/Projects/Quantum/abdcshare
pnpm install                                             # updates + commits pnpm-lock.yaml

cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
docker compose -f deploy/docker-compose.yml up -d postgres redis   # if not already running

pnpm --filter @abdcshare/shared build                    # entities import @abdcshare/shared → build it first
pnpm --filter @abdcshare/api exec mikro-orm migration:create --initial   # -> src/migrations/Migration*.ts
pnpm --filter @abdcshare/api migration:up                # applies it (ts-node)
pnpm --filter @abdcshare/api seed:dev                    # roles/departments/catalogues + Platform Admin

# prove the async pipeline (or start everything with `pnpm dev`):
pnpm dev          # turbo: shared watch + api :4000 + worker + web :3000
# (or only api+worker: pnpm dev:api & pnpm dev:worker)
curl -X POST localhost:4000/api/demo/outbox -H 'content-type: application/json' -d '{"message":"hello"}'
# -> worker logs "Processing user.created"; the outbox row flips Pending -> Queued -> Sent
```
If the first real TS compile (`shared build` / `migration:create`) flags a type or MikroORM nit, paste it.

## ✅ First migration + seed VERIFIED (local)
- `db:setup` / migration flow works. `Migration20260720205259` created + applied — all 16 tables built.
- Seed populated: 5 roles, 6 departments, 3 engagement types, 6 FS lines, 4 stages, 5 statuses,
  Platform Admin `admin@abdcshare.local` / `ChangeMe!123` (mustChangePassword).
- Local DB = the developer's own Postgres via `DATABASE_URL` (auto-creates the database). Docker
  Postgres unused locally (port 5432 conflict); Redis still from compose.
- One-command bootstrap available: `pnpm --filter @abdcshare/api db:setup`.

## Commit this work (branch `feature/first-migration`)
```bash
git add -A
git commit -m "feat: initial schema, migration, seed + monorepo hardening (pnpm allowBuilds, bcryptjs, per-app env, db:setup)"
git push -u origin feature/first-migration   # open PR -> main
```

## Phase 1 — Auth & RBAC + Users (BUILT, branch `feature/auth-user`)
- **RBAC guards** (`apps/api/src/common`): `JwtAuthGuard` (verifies access token, `@Public` bypass,
  attaches user), `PermissionsGuard` (`@RequirePermission` → `roleHasPermission` from `@abdcshare/shared`),
  registered **globally** in `app.module` (auth-by-default). Decorators `@Public`, `@RequirePermission`,
  `@CurrentUser`; pagination helper `common/pagination/paginate.ts`.
- **Auth module**: `TokenService` (access JWT + rotating refresh w/ **reuse detection** on `refresh_tokens`),
  `AuthService`, `AuthController` — `POST /api/auth/login|refresh|logout`, `GET /api/auth/me`,
  `POST /api/auth/change-password`. bcryptjs. New dep `@nestjs/jwt`.
- **Users module**: create (hashed temp password + `user.created` outbox event), paginated list + filters,
  get/update/deactivate, guarded by `user:manage` / `user:view`, with the **last-Platform-Admin guard**.
- `health` + `demo` marked `@Public`. No new migration (refresh_tokens already in the initial one).

## Test Phase 1 locally
```bash
pnpm install                          # picks up @nestjs/jwt
pnpm --filter @abdcshare/shared build
pnpm --filter @abdcshare/api build    # FIRST compile of the slice — paste any TS error
pnpm dev:api
curl -sX POST localhost:4000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@abdcshare.local","password":"ChangeMe!123"}'
# use the returned accessToken:
curl -s localhost:4000/api/auth/me -H "authorization: Bearer <accessToken>"
curl -sX POST localhost:4000/api/users -H "authorization: Bearer <accessToken>" \
  -H 'content-type: application/json' -d '{"fullName":"Jane Auditor","email":"jane@x.co","roleId":2}'
```

## Genesis re-foundation (docs rebuilt to FULL parity)
- `LEGACY_AUDIT.md` — forensic extraction of legacy ACA (66 tables / 351 cols + full endpoint inventory).
- `ERD.md` v3, `USER_STORIES.md` v2, `permissions.ts`, `EXECUTION_PLAN` (parity gate in DoD) all rebuilt.
- Decisions: keep core lookups (HR-ish flagged), RBAC (drop users_access), unify documents,
  final-report upload = **Super Admin only**, single phone, **partner designations + weekly reports**.

## Users retrofit slice 1 (branch `feature/auth-user`) — full profile + partner designation
- **Reference lookup entities** (11): titles, genders, marital_statuses, client_types, industries,
  categories, banks, general_statuses, states, lgas(→state), wards(→lga) — `modules/reference/...`.
- **UserEntity** expanded: title/gender/marital FKs, first/middle/surname (+cached fullName), phone,
  official/residential address, **partner_designation** enum (PrincipalPartner|Partner).
- **ClientEntity** expanded to full org profile (type, industry, category, bank, incorporation, addresses, state/lga/ward).
- **RBAC designation wired**: JWT payload + `AuthenticatedUser` carry `partnerDesignation`; `PermissionsGuard`
  uses `hasPermission(role, perm, designation)`; token/auth services pass it.
- **Users module**: create with full profile (derives fullName); `PATCH /users/:id/designation`
  (Super-Admin-only, **single Principal Partner** guard). Seed admin updated (firstName/surname).
- `ERD.mermaid` regenerated to v3 (48 entities, validated).

## To run this slice locally (needs a NEW migration — schema changed)
```bash
pnpm install
pnpm --filter @abdcshare/shared build
pnpm --filter @abdcshare/api build        # first compile of the retrofit — paste any TS nit
pnpm --filter @abdcshare/api exec mikro-orm migration:create   # delta migration for new tables/columns
# THEN add this partial unique index to the generated migration's up() (one Principal Partner):
#   this.addSql(`CREATE UNIQUE INDEX users_one_principal_partner ON "users" (partner_designation) WHERE partner_designation = 'PrincipalPartner';`);
pnpm --filter @abdcshare/api migration:up
pnpm --filter @abdcshare/api seed:dev
```

## Users retrofit slice 2a — bulk import + export (BUILT)
- `common/utils/csv.ts` — dependency-free RFC-4180-ish CSV parse/stringify.
- `bulk_import_jobs` entity (kind/status/counts/result jsonb) — **NEW table → additive migration needed**.
- `BulkUsersService`: `template()`, `preview(csv)` (parse + per-row validation: required fields, email
  format/uniqueness/in-file-dupes, role/department lookup by name — records a Validated job),
  `import(csv)` (creates valid rows + `user.created` outbox each; skips + reports invalid), `exportCsv()`.
- Controller: `GET /api/users/bulk/template`, `POST /api/users/bulk/preview|import` (`bulk-import:run`),
  `GET /api/users/export` (`user:view`). Static routes ordered before `:id`.

## Run slice 2a (purely additive — no DB reset)
```bash
pnpm --filter @abdcshare/api exec mikro-orm migration:create   # adds bulk_import_jobs table
pnpm --filter @abdcshare/api migration:up
# test (with a token): GET /api/users/bulk/template -> edit CSV -> POST /api/users/bulk/preview {"csv":"..."}
```

## Slice 2b (part) — Clients CRUD + test harness (BUILT)
- **Clients CRUD** (`modules/clients`): create/list(paginated,filter)/get/update/deactivate with FK
  references (type/industry/category/bank/state/lga/ward), guarded `client:manage`/`client:view`,
  wired into `app.module`. **No migration** — `clients` table already exists.
- **Test harness**: jest + ts-jest configured (`apps/api/jest.config.js`); first unit test
  `common/utils/csv.spec.ts` (4 cases, pure, no DB). Pattern established for per-module tests going forward.

## Run
- Clients: `dev` hot-reloads (no migration). `POST/GET /api/clients` (needs a token + client:manage/view).
- Tests: `pnpm install` (gets jest/ts-jest) → `pnpm --filter @abdcshare/api test` → 4 CSV tests green.

## Slice 2b (complete) — Reference-data CRUD
- `modules/reference`: `reference.registry.ts` (URL type → entity map, incl. parent for lgas→state,
  wards→lga), `ReferenceService` (list/create/update via `em.find` **without** typed find-options +
  in-memory sort/paginate — sidesteps the MikroORM-generic trap; casts confined to em boundaries),
  `ReferenceController` (`GET /api/reference`, `GET/POST /api/reference/:type`, `PATCH /:type/:id`),
  guarded `reference-data:view`/`manage`. Wired into `app.module`. Unit test `reference.registry.spec.ts`.
- **Users + clients + reference parity now closed.** No migration (all lookup tables already exist).

## Slice 2c (complete) — Client trim + primary-contact login  ⚠️ **has a migration**
- **Client trimmed:** dropped `industry/category/bank/state/lga/ward` FKs from `ClientEntity` (those
  lookups stay as reference data; the client just no longer captures them). `CreateClientDto` slimmed.
- **Primary contact = login:** `ClientEntity.primary_contact_id` (OneToOne → users, UQ, nullable).
  `POST /api/clients` now takes a required nested `contact` block and `ClientsService.create` provisions
  it atomically — creates a `Client`-role `UserEntity` (client_id set, bcrypt temp password,
  `mustChangePassword`), sets `client.primaryContact`, emits `EVENT.UserCreated` to the outbox
  (worker emails credentials), one `persistAndFlush`. Response adds `primaryContactName/Email`.
- **Migration `Migration20260721102641.ts`** — drops the 6 client FKs, adds `primary_contact_id` (+FK+UQ).
  (Also resolved a stale-snapshot drift: `company_profile.id` is `serial` per the initial migration; the
  snapshot now records that, so it no longer leaks into diffs.)
- Test `clients.service.spec.ts` (4 cases: provisions contact + emails creds; dup name; dup contact email;
  missing Client role). Typecheck green (`tsc --noEmit` exit 0). Docs updated: ERD §4 + C-1/C-2 + open item 3.
- **Env note:** the sandbox couldn't run jest (workspace has **jest 30 vs ts-jest 29** + pnpm preset
  resolution) — verify on the Mac: if `pnpm --filter @abdcshare/api test` fails the same way, align versions
  (pin `jest@^29` or bump `ts-jest`). Not a code issue; `tsc` passes.

## Run this slice (has a migration)
- `pnpm --filter @abdcshare/api migration:up` (applies `Migration20260721102641`), then `pnpm dev`.
- Try: `POST /api/clients {"name":"Acme Ltd","contact":{"firstName":"Ada","surname":"Bello","email":"ada@acme.com"}}`
  → creates the client + emails the contact login; response shows `primaryContactEmail`.

## Run
- `dev` hot-reloads. Tests: `pnpm --filter @abdcshare/api test` (now 4 spec files).
- Try: `GET /api/reference` → types; `POST /api/reference/titles {"name":"Mr"}`;
  `POST /api/reference/lgas {"name":"Ikeja","parentId":<stateId>}`.
- **Compile risk to watch:** the registry assigns concrete entity classes to `EntityName<LookupRow>`.
  If tsc rejects it, cast each entity `as EntityName<LookupRow>` — paste the error and I'll fix.

## Phase 2 (complete) — Catalogues  ✅ **NO migration** (all catalogue tables already existed)
Seven catalogue modules, each paginated + guarded, wired into `app.module`:
- **fs-lines** (`catalogue:*`) — code?/name/description/isActive; name+code uniqueness on create/update.
- **request-types** (`catalogue:*`) — under an FS line; name, expectedDocuments, isActive; enforces the
  `(fsLine, name)` unique pair + validates the FS line exists. Filter by `fsLineId`. Test (3 cases).
- **request-stages** + **request-statuses** (`catalogue:*`) — share `common/catalogue/OrderedCatalogueService`
  (`{id,name,sortOrder,isActive}`; `em.find` untyped + in-memory sort/paginate — same trick as reference).
- **engagement-types** (`catalogue:*`) — name/isActive **+** `PUT /:id/fs-lines` replaces the allowed-FS-line
  set via the `fs_line_engagement_types` junction (empty ⇒ all allowed); response carries `allowedFsLineIds`.
  Test (2 cases: validate+replace; reject unknown FS line).
- **departments** (`department:manage` write / `catalogue:view` read) — name/isActive.
- **company-profile** (`company-profile:view/manage`) — singleton `GET` + `PATCH` (upsert, sets `updatedBy`
  from the current user); auto-creates the row on first access.
- **Root fix (permanent):** `company_profile.id` had `= 1` initializer → phantom `default: 1` that fought the
  `serial` PK and re-emitted a bogus migration on every regen. Removed the initializer (singleton is enforced
  in the service) + aligned the snapshot; `migration:create` now reports **"No changes required."**
- Typecheck green (`tsc --noEmit` exit 0). 5 spec files total. `Migration20260721110744.ts.bak` = the
  discarded drift-noise migration (renamed out of the glob; safe to delete on the Mac).

## Run Phase 2 (no migration)
- `pnpm dev` — hot reload. All under `/api`: `fs-lines`, `request-types`, `request-stages`,
  `request-statuses`, `engagement-types` (+ `PUT /engagement-types/:id/fs-lines`), `departments`,
  `company-profile` (GET/PATCH). Need a token with `catalogue:*` / `department:manage` / `company-profile:*`.
- Try: `POST /api/fs-lines {"name":"Cash & Bank","code":"CB"}` →
  `POST /api/request-types {"fsLineId":<id>,"name":"Bank statement","expectedDocuments":2}`.

## Phase 3a (complete) — Engagements core  ⚠️ **has a migration** (`Migration20260721112640`)
Four new tables (uuid domain PKs), module wired into `app.module`:
- **engagements** — client + engagement_type + **single owning department** FK, auto `reference_code`
  (`ENG-{year}-{0001}`, sequential within the year), title, period_label, `status`
  (Planning→Fieldwork→Review→Completed→Archived), start/target/completed dates, created_by.
- **engagement_team_members** (PK engagement+user) — **cross-department people**: member_role
  (Partner/Manager/Auditor), assigned_by/at. Confirmed model: one owning dept, any-dept team.
- **engagement_fs_lines** (PK engagement+fs_line) — which FS lines are in scope (requests will group here),
  sort_order, added_by.
- **engagement_status_history** — append-only audit of every transition (from/to, changed_by, note).
- **Service:** create (validates client/type/dept, generates ref code, seeds Planning history + optional
  initial FS lines), list (paginated; filter client/department/status; q on title/ref), getOne (detail with
  team + fsLines), update, **transition** (enforces `ENGAGEMENT_TRANSITIONS`, stamps completed_at, writes
  history), add/remove team member (upserts role; cross-dept), add/remove FS line. Guarded
  `engagement:create/update/transition/view`.
- Test `engagements.service.spec.ts` (ref-code gen + Planning seed; rejects Planning→Completed; rejects
  no-op transition). Typecheck green; `migration:create` → "No changes required" after the migration.

## Run Phase 3a (has a migration)
- `pnpm --filter @abdcshare/api migration:up` (applies `Migration20260721112640`), then `pnpm dev`.
- Flow: `POST /api/engagements {clientId, engagementTypeId, departmentId, title, fsLineIds?}` →
  `POST /api/engagements/:id/team {userId, memberRole}` (any department) →
  `POST /api/engagements/:id/fs-lines {fsLineId}` →
  `POST /api/engagements/:id/transition {toStatus:"Fieldwork"}`.

## Phase 3b (complete) — Requests core  ⚠️ **has a migration** (`Migration20260721123912`)
Three new tables (uuid domain PKs), module wired into `app.module`:
- **requests** — engagement FK (cascade), request_type FK, stage/status FK (→ request_stages/statuses
  catalogues), description, due_date, created_by. **FS line is DERIVED** via `request_type.fs_line` (no
  column) per ERD §7.
- **request_assignees** (PK request+user) — assigned_by/at.
- **request_history** — append-only audit (actor, event_type, module, from/to_value, note, created_at).
- **Core rule enforced:** on create, the request type's FS line **must be in the engagement's scope**
  (`engagement_fs_lines`) — otherwise 400 "add it first". This is what makes "requests grouped by in-scope
  FS lines" real. Stage/status default to the lowest-sortOrder active catalogue row when omitted (400 if
  none configured).
- **Service:** create (+ optional initial assignees; writes Created history), list (paginated; filter by
  engagement / fsLine / stage / status / assignee; q on description), getOne (detail with assignees),
  update, **setStage** / **setStatus** (record Stage/StatusChanged with from→to names + note), assign /
  unassign (record Assigned/Unassigned). Every mutation writes `request_history`. Guarded
  `request:create/update/assign/view`.
- Test `requests.service.spec.ts` (rejects out-of-scope FS line; setStage records history + swaps stage).
  Note: the reusable "first ordered row" helper was **de-generified** into concrete `firstStage()`/
  `firstStatus()` — the generic version hit the MikroORM `AutoPath`/`FilterQuery` trap (DEV guidelines).
- Typecheck green; `migration:create` → "No changes required" after the migration. 7 spec files total.

## Run Phase 3b (has a migration)
- `pnpm --filter @abdcshare/api migration:up` (applies `Migration20260721123912`), then `pnpm dev`.
- Flow: put an FS line in engagement scope → `POST /api/requests {engagementId, requestTypeId, description}`
  (the type's FS line must be in scope) → `POST /api/requests/:id/assignees {userId}` →
  `POST /api/requests/:id/stage {stageId}` / `.../status {statusId}`.

## Phase 3c (complete) — Client submissions & review  ⚠️ **has a migration** (`Migration20260721130245`)
One new table + module wired into `app.module`:
- **client_submissions** — request FK (cascade), submitted_by FK, message text, `status`
  (Pending/Accepted/Returned), reviewed_by / review_reason / reviewed_at (BaseEntity uuid + timestamps).
- **Service:** create (client responds → **Pending**), list-by-request (paginated; filter by status),
  getOne, **review** (staff Accept/Return + reason; stamps reviewed_by/at; **only from Pending** — 400 if
  already reviewed).
- **Controller routes:** `POST /api/requests/:requestId/submissions` (`submission:respond`, Client),
  `GET /api/requests/:requestId/submissions` + `GET /api/submissions/:id` (`request:view`),
  `POST /api/submissions/:id/review` (`submission:review`, staff/SA).
- Test `submissions.service.spec.ts` (accept stamps reviewer; reject re-review). Typecheck green;
  `migration:create` → "No changes required". 8 spec files total.
- **Submission FILES deferred** to the documents/R2 slice (they need presigned upload — built once, reused).

## Run Phase 3c (has a migration)
- `pnpm --filter @abdcshare/api migration:up` (applies `Migration20260721130245`), then `pnpm dev`.
- Flow: client → `POST /api/requests/:id/submissions {message}` → staff →
  `POST /api/submissions/:sid/review {decision:"Accepted"|"Returned", reason?}`.

## Row-level client scoping (complete) — SECURITY  ✅ **NO migration**
Client-role users now see **only their own** client's rows (tenancy), not just capability-gated access:
- **JWT carries `clientId`** — added to `TokenSubject` → access-token payload → `AccessPayload` →
  `req.user` (`AuthenticatedUser.clientId`). Populated from `user.client?.id` on login + refresh-rotate.
- **`common/security/client-scope.ts` → `clientIdIfScoped(user)`** — returns the `client_id` to scope by
  for a `Client` user (throws 403 if a Client has no client link), or `null` for staff/admins (unscoped).
  `undefined` user (internal service calls) ⇒ unscoped.
- **Applied** in read paths (staff pass `null` ⇒ see all; internal `getOne` calls stay unscoped):
  - engagements `list`/`getOne` → `where.client = scoped`.
  - requests `list`/`getOne` → `where.engagement = { client: scoped }` (merges with an `engagementId` filter).
  - submissions `list`/`getOne` → `where.request.engagement.client = scoped`; **`create` verifies the
    request belongs to the client** before accepting a response (can't respond to another client's request).
  - A non-owned id returns 404 (scope folded into the `findOne` where — existence isn't leaked).
- Test `common/security/client-scope.spec.ts` (staff→null, none→null, client→id, client-without-client→403).
  Typecheck green. 9 spec files. **Mutations stay staff-only by permission** (clients lack
  engagement/request `:create/:update/...`), so scoping the read paths + submission-create covers exposure.
- **Snapshot note:** resolved the recurring `company_profile.id` diff for good — the singleton's PK is a
  proper `serial` (matches the initial migration); the snapshot now records that consistently, so
  `migration:create` is clean. This slice has **no migration**. (`*.ts.bak` files in `migrations/` are
  discarded drift-noise — safe to delete on the Mac; commit the updated `.snapshot` to lock it in.)

## Run
- Scoping is code-only (no migration). Log in as a Client contact (role=Client, client_id set) → `GET
  /api/engagements` and `/api/requests` return only that client's rows; responding to another client's
  request 404s.

## Role model v5 + staff scoping (complete) — SECURITY  ✅ **NO migration**
Role model change per direction ("no Auditor role; it's a tag; every staff is a working practitioner"):
- **`Auditor` dropped as a role.** `ROLE_NAMES` = Platform Admin, Super Admin, **Staff**, Client. "Auditor"
  lives on only as the engagement **team member_role** tag (Partner/Manager/Auditor) — what a staff *is on
  a given engagement*. (`EngagementMemberRole` unchanged; `bulk-users` sample row → Staff; shared rebuilt.)
- **Staff = working practitioner** (`ROLE_PERMISSIONS.Staff`): request:create/update/assign,
  working-paper:upload, document:export, submission:review, discussion:participate, review:submit + views.
  **Engagement create/update/transition stays Super-Admin-only** (staff don't create engagements).
- **Access scope generalised** (`common/security/access-scope.ts`, replaces `client-scope.ts`):
  `resolveScope(user)` → `all` (Platform/Super Admin, internal) | `client` (own client) | `staff`
  (own team memberships). `engagementScopeWhere(scope)` primitive: `{}` | `{client}` | `{team:{user}}`.
- **Applied** — Client and Staff both scoped now:
  - engagements list/getOne → merged onto the engagement.
  - requests list/getOne **and all mutations** (update/setStage/setStatus/assign/unassign via a scoped
    `findScoped` load) + **create checks staff is on the engagement team** (403 otherwise).
  - submissions list/getOne/**review**/create → scoped via `request.engagement`.
  Non-owned ids 404; staff mutating a request outside their engagements 404s.
- Tests: `access-scope.spec.ts` (all/client/staff/forbid + where-primitive); requests + submissions specs
  updated to the new `user` signatures. Typecheck green; `migration:create` → "No changes required".
  9 spec files. **No migration** (member_role enum already had Auditor; nothing schema-level changed).

## Phase 3d (complete) — Documents (working papers / final reports)  ⚠️ **migration** (`Migration20260721172716`)
Three new tables + a storage abstraction, wired into `app.module`:
- **shared:** `DocumentStatus` (Draft/Ready/UnderReview/SignedOff), `DocumentParticipantRole`
  (Auditor/Advisor/Staff), EVENTs Document{Created,FileUploaded,StatusChanged}. Rebuilt.
- **documents** — engagement (cascade) + fs_line + request? + department FK, category
  (WorkingPaper/FinalReport), title, description, status (default Draft), current_version, created_by.
- **document_files** — versioned: document (cascade), version, storage_key, file_name, mime_type,
  size_bytes, uploaded_by/at.
- **document_participants** (PK document+user) — participant_role, added_by/at.
- **Storage port** `common/storage/` — `StoragePort` (presignUpload/presignDownload) + **dependency-free
  `LocalStorageAdapter`** (dev stub returning `/api/storage/local/...` URLs) + global `StorageModule`
  (driver from `STORAGE_DRIVER`). env: `STORAGE_DRIVER|STORAGE_PUBLIC_BASE_URL|STORAGE_UPLOAD_TTL|
  LOCAL_STORAGE_DIR|R2_*`. **R2 (S3-SDK) adapter is the one TODO** — add `R2StorageAdapter` (needs
  `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` installed) and branch in StorageModule on
  `STORAGE_DRIVER=r2`.
- **Upload flow (presign → confirm):** `POST /:id/files/presign` returns a presigned PUT (no DB write) →
  client PUTs bytes → `POST /:id/files` confirms: new `document_files` row at `current_version+1`, bumps
  the document, Draft→Ready, emits `DocumentFileUploaded`. `GET /:id/files/:fileId/download` → presigned URL.
- **Rules:** FinalReport create = **Super Admin only** (`hasPermission(final-report:upload)`); sign-off
  (status→SignedOff) = Super Admin (`review:signoff`); FS line must be in the engagement scope; **staff
  scoping** applies (must be on the engagement). (Later: Clients gained `document:view` +
  `supporting:upload` for Supporting/planning docs only — still no WP/FinalReport.) Guards
  `document:view` / `working-paper:upload`.
- Test `documents.service.spec.ts` (Staff can't create FinalReport; confirmUpload bumps version + emits).
  Typecheck green; `migration:create` → "No changes required". 10 spec files.

## Run Phase 3d (has a migration)
- `pnpm --filter @abdcshare/api migration:up` (applies `Migration20260721172716`), then `pnpm dev`.
- Flow: `POST /api/documents {engagementId, fsLineId, category, title}` →
  `POST /api/documents/:id/files/presign {fileName, contentType}` → PUT bytes to `uploadUrl` →
  `POST /api/documents/:id/files {storageKey, fileName, sizeBytes}` (version 1) → `.../status {status}`.

## Phase 3e (complete) — Notifications + Discussions + Reviews + Worker delivery  ⚠️ **2 migrations**
Migrations: `Migration20260721180713` (notifications), `Migration20260721181257` (discussions + reviews).
- **Notifications** (`@Global` module) — `notifications` + `notification_preferences`.
  `NotificationsService.emit({recipients, type, title, body?, entityType?, entityId?, link?, excludeUserId?})`
  dedupes, honours per-(user,type) prefs, creates **in-app rows synchronously** (same UoW as the domain
  change), and enqueues **one `EVENT.NotificationEmail`** outbox job for the worker. User endpoints:
  `GET /notifications` (paginated, `?unread=true`), `/unread-count`, `POST /:id/read`, `/read-all`,
  `GET/PUT /preferences[/:type]`. Guard `notification:receive`.
- **Discussions** — `discussion_messages` (threaded via parent), `discussion_mentions`, `discussion_reads`
  (read-tracking), `discussion_attachments` (via StoragePort). Post/list/edit scoped to request access;
  posting notifies the engagement team + assignees + client contact + mentioned (minus author). Routes:
  `POST/GET /requests/:id/messages`, `POST /requests/:id/messages/read`, `PATCH /messages/:id`,
  `POST /messages/:id/attachments/presign|(confirm)`. Guard `discussion:participate` (incl. Client).
- **Reviews** — `reviews` (request? XOR document?, preparer, reviewer, status ForReview/Approved/SentBack,
  notes, sent_from, submitted/decided). `POST /reviews` (`review:submit`) notifies the reviewer;
  `POST /reviews/:id/decide` (`review:decide` = Super Admin) notifies the preparer; list/getOne. Scoped.
- **Worker delivery (real now)** — `notification.consumer` `dispatch()` by eventType: `user.created` →
  credential email; `notification.email` → send each email + mark `notifications.email_sent` via raw SQL;
  everything sealed idempotently in the outbox. Email still only leaves the **worker** (`EmailDispatchService`
  → Resend, no-op if `RESEND_API_KEY` unset). **In-app** notifications now fire for: client submission
  created/reviewed, discussion posted, review requested/decided.
- Tests: `notifications.service.spec` (dedupe/exclude/email job), `reviews.service.spec` (target XOR).
  api + worker typecheck green; `migration:create` → "No changes required". 12 spec files.

## Run Phase 3e (2 migrations)
- `pnpm --filter @abdcshare/api migration:up` (applies 180713 + 181257), then `pnpm dev` (+ worker + Redis).
- Try: client `POST /api/requests/:id/submissions` → staff sees a notification (`GET /api/notifications`);
  `POST /api/requests/:id/messages {body,mentionUserIds}`; `POST /api/reviews {requestId, reviewerId}`.

## Rename (v6) — "FS line" → "Request class"  ⚠️ **regenerated migration** (`Migration20260721185958`)
Terminology change (functions unchanged): "FS line" was audit-specific; **request class** is neutral across
engagement types (Assurance/Tax/Advisory). Full rename **including the API surface**:
- Entities/tables: `fs_lines`→`request_classes`, `fs_line_engagement_types`→`request_class_engagement_types`,
  `engagement_fs_lines`→`engagement_request_classes`; columns `fs_line_id`→`request_class_id`
  (request_types, documents, junctions). Module `modules/fs-lines`→`modules/request-classes`; files renamed.
- API: routes `/fs-lines`→`/request-classes`; fields `fsLineId`→`requestClassId`, `fsLineName`→
  `requestClassName`; DTOs/classes `FsLine*`→`RequestClass*`. Seed const `REQUEST_CLASSES`.
- **Migration was regenerated (drop+recreate per request)** — `request_types`/`documents` are preserved via
  `rename column fs_line_id → request_class_id`; the lookup table + junctions are dropped/recreated (empty in
  dev). Stripped the recurring `company_profile` snapshot-drift lines so the migration is rename-only.
- All 3 packages typecheck clean; `migration:create` → "No changes required". Docs updated (LEGACY_AUDIT
  left as-is, historical). **Run:** `pnpm --filter @abdcshare/api migration:up`.

## Docs sync (complete)
All design docs now reflect the current app: the **v5 role model** (Auditor dropped as a role → Staff is
the working practitioner; Auditor survives only as the team/participant tag; engagements = Super-Admin-only;
Staff row-scoped) is corrected in USER_STORIES (legend + all `AU` story actors) and DOMAIN_MODEL (roles
table + "unchanged from ACA" fixed). The **request class** rename is reflected everywhere incl. the
DOMAIN_MODEL definition/glossary (no longer defined *as* "FS line" — it's a general grouping, FS lines
being the audit example). LEGACY_AUDIT.md left as historical. No stale `fs line`/`AU`/`Auditor`-role refs
remain in code or docs.

## Final-report client review cycle (complete)  ⚠️ **migration** (`Migration20260721192619`)
Client-facing draft-review loop for **final reports**, on top of document versioning:
- **shared:** `ReportReviewState` (NotSent/AwaitingClient/ChangesRequested/Locked/Approved/Overridden),
  `ReportReviewDecision` (Pending/Approved/ChangesRequested), `MAX_REPORT_REVIEW_ROUNDS = 3`, perms
  `report-review:manage` (SA) + `report-review:respond` (Client), EVENTs ReportSentForReview/ReportReviewDecided.
- **documents** gained `client_review_state` + `client_review_round`. New **`report_review_cycles`** table
  (one row per round: round_no, file_version, sent_by/at, decision, decided_by/at, feedback).
- **module `report-reviews`** (2 controllers):
  - **Firm (SA, `report-review:manage`):** `GET /documents/:id/final-report` (status + cycles),
    `POST /documents/:id/final-report/send` (round++ → AwaitingClient; needs an uploaded version; blocked
    once 3 sent or already awaiting/finalised), `POST /documents/:id/final-report/override` (Locked → SignedOff).
  - **Client (`report-review:respond`, row-scoped to own engagement):** `GET /final-reports` (awaiting my
    review), `GET /final-reports/:id`, `GET /final-reports/:id/download` (presigned), `POST /final-reports/:id/respond`.
  - **Rules per your decisions:** client **approval finalises** the report (`status → SignedOff`, terminal);
    changes-requested on round < 3 → ChangesRequested (SA revises + re-sends); on round 3 → **Locked**
    (needs SA override). Each transition notifies the other side.
- Test `report-reviews.service.spec.ts` (approve→SignedOff; changes<3→ChangesRequested; changes@3→Locked).
  api + worker typecheck green; `migration:create` → "No changes required". 13 spec files. Docs updated
  (ERD §8 + USER_STORIES K-8..K-11). **Run:** `pnpm --filter @abdcshare/api migration:up`.

## Gap-closing bucket 1 (complete)  ✅ **NO migration** (reuses existing tables/columns)
- **Password reset flow** — `POST /api/auth/forgot-password` (`@Public`, neutral response, mints a
  single-use `password_reset_tokens` row + `user.password_reset_requested` outbox) and
  `POST /api/auth/reset-password` (verifies token, sets password, revokes all sessions,
  `user.password_changed`). Worker sends the reset link (`WEB_APP_URL/reset-password?token=…`) + a
  change-confirmation email. env: `PASSWORD_RESET_TTL` (api), `WEB_APP_URL` (worker).
- **Own-profile self-service** — `GET/PATCH /api/users/me` (title/names/gender/marital/phone/addresses;
  no permission needed — any authed user), **avatar** via `POST /api/users/me/avatar/presign` + `.../avatar`
  (confirm → `avatar_path`; `avatarUrl` presigned in the response). Uses the StoragePort.
- **Document delete** — `DELETE /api/documents/:id` (`document:delete`, SA; scoped; cascades files +
  participants; object-storage sweep left to storage layer).
- **Request-assigned notification** — `requests.assign` now notifies the assignee (in-app + email).
- Test `auth/password-reset.spec.ts` (neutral unknown-email; invalid-token rejects). api + worker
  typecheck green; **no migration** (`Migration…145033.ts.bak` = discarded company_profile drift). 14 specs.

## Bucket 2 + 3 + 4 (this pass)
**Bucket 2 (decided):**
- **Company profile = singleton** (kept as-is at the time; docs corrected in USER_STORIES G + ERD §12).
  **Later superseded** by the company-profiles document library (`Migration20260801114012`) — see
  “UI kit polish + company profiles library” below.
- **Submission file attachments** — `submission_files` entity + `POST /api/submissions/:id/files/presign`
  + `.../files` (client, only while Pending), included in the submission response. ⚠️ migration
  `Migration…101650`.

**Bucket 3:**
- **Audit / activity log** — `AuditService.record()` + a **global `AuditInterceptor`** (zero-touch: logs
  every authenticated mutation with actor/route/entity/ip; skips `/auth/`; uuid ids only). Successful
  **LOGIN** recorded explicitly from `AuthService`. `GET /api/audit` + `GET /api/audit/export` (`audit:view`
  for **Platform Admin** and **Principal Partner** only; filters entityType/entityId/actorId/dateFrom/dateTo;
  actor name/email; CSV cap 10k). **Web:** `/admin/activity` viewer (user picker filter) + sidebar +
  governance dashboard deep-link. **No migration** (`activity_log` already in schema; entity got
  `OptionalProps`).
- **Engagement sign-offs** — `engagement_sign_offs` (per request class or engagement-wide; revocable).
  `GET/POST /api/engagements/:id/sign-offs`, `.../:signOffId/revoke` (`review:signoff`). **Completion gate:**
  can't transition to `Completed` unless an engagement-wide sign-off exists OR every in-scope request class
  is signed off. ⚠️ migration `Migration…110621`. Test: `engagement-completion.spec.ts`.
- **Global search + dashboards** (`modules/insights`, no tables) — `GET /api/search?q=` (scoped ILIKE across
  engagements/requests/documents/clients; clients see no docs, only admins see the client directory);
  `GET /api/dashboard` — **role-shaped** payload (`governance` | `firm` | `staff` | `client` | `guest`)
  with attention items + optional Partner/Principal partner strip; Guest never sees firm engagement counts.

**Bucket 4:**
- **Done:** **scheduled deadline reminders** — `DeadlineReminderService` (`@Cron` daily @07:00 +
  `@CreateRequestContext`) nudges assignees of requests **due within 24h**. **Bulk document upload** —
  `POST /api/documents/:id/files/presign-batch` + `.../files/batch` (≤50, each a new version).
- **Blocked by deps/env (documented, not built):**
  - **API e2e (Supertest)** — needs `supertest` + a live DB (sandbox has neither); 19 unit specs in place.
  - **OpenAPI → `api-client`** — deferred with the web frontend.
  - **Extract shared persistence** — worker still duplicates `outbox.entity`; larger refactor.

api + worker typecheck green; `migration:create` clean after each. **15 spec files.** Run the 3 new
migrations: `pnpm --filter @abdcshare/api migration:up`.

## Engagement stages + phase tagging + Supporting docs (v7)  ⚠️ **migration `Migration20260724115625`**
- **Stages renamed** — engagement lifecycle is now **Planning → Execution → Reporting → Completed →
  Archived** (`EngagementStatus`: Fieldwork→Execution, Review→Reporting; `ENGAGEMENT_TRANSITIONS` updated).
  Migration includes a **data fix** (UPDATE existing `Fieldwork`/`Review` rows on engagements +
  engagement_status_history, run *between* dropping and re-adding the check constraints; reverse in `down`).
- **Phase tag** — new `EngagementPhase` (Planning/Execution/Reporting) + `phaseForStatus(status)` helper in
  shared. **`requests.phase`** and **`documents.phase`** (nullable) default to the engagement's current
  stage at create; both listable by `?phase=`. Lets "planning preliminaries" (client requests + team
  uploads with `phase=Planning`) group together.
- **Supporting documents** — `DocumentCategory += Supporting`; **`documents.request_class_id` is now
  nullable**. Supporting = engagement-level reference material, **no request class** (skips the in-scope
  check). Create/upload: `engagement:update` **or** `supporting:upload`. Clients may view/upload
  Supporting and delete **their own**; firm WP/FinalReport stay firm-only. WorkingPaper/FinalReport
  still require a request class when linked.
- Tests: `documents.service.spec` (Supporting → no request class, phase defaults from stage); engagement
  specs updated to new enum values. api + worker + shared typecheck green; `migration:create` clean.
  Docs updated (ERD §6/§7/§8 + USER_STORIES H-2/H-6/H-7). **15 spec files.** Run `migration:up` on the Mac.

## Partner / Chairman reports + Guest role (v8)  ⚠️ **migration `Migration20260725202010`**
Structured periodic reports to the Chairman (Principal Partner), modelled on `chairman-reporting-portal.html`
(**excluded** sections 05 Risk/Compliance/QA and 07 Strategic Initiatives, per request).
- **Guest role (NEW):** `ROLE_NAMES += 'Guest'`; perms `partner-report:submit` + `partner-report:view` +
  `notification:receive`. Added perms `partner-report:view` + `partner-report:invite`
  (invite → PrincipalPartner designation).
- **`mustChangePassword` now ENFORCED** — new global `MustChangePasswordGuard` (after JwtAuth, before
  Permissions) blocks every route except `/auth/change-password|logout|me` until the user sets a real
  password. (Also fixes first-login for clients/staff.)
- **Invite = provision a Guest login** — Principal Partner `POST /api/partner-reports/invites {email,fullName,title?}`
  → creates a `Guest` `UserEntity` (temp password, mustChangePassword) + `partner_report_invites` row +
  emits `user.created` (worker emails **credentials + login link**). Guest logs in → forced password change →
  can submit. Returns `InviteResultDto {outcome:'invited'|'reminded'}`. **Email already exists → no new
  account; the user is simply reminded to submit** (`partner-report.reminder` notification), `outcome:'reminded'`.
- **Periodic reminder (O-6):** `PartnerReportReminderService` — `@Cron` weekly (Mondays 08:00) +
  `@CreateRequestContext` — nudges guests whose invite is still `Invited` (not yet submitted).
- **Report model:** `partner_reports` (officer name/title/dept/period, exec summary, financials
  [currency + fee/billings/collections/WIP numeric + variance text], people & capacity, outlook, status
  Draft/Submitted/Reviewed, review fields) + `partner_report_engagement_updates` (04, status
  OnTrack/Watch/AtRisk/NewWin) + `partner_report_decisions` (08, priority Urgent/ThisPeriod/ForInformation).
- **Endpoints** (`/api/partner-reports`): create/update draft + `POST /:id/submit` (`partner-report:submit`,
  authors = Partner or Guest); `GET` list + `GET /:id` (`partner-report:view` — authors see own, Chairman
  sees all); `POST /:id/review` (`partner-report:review`); `GET /dashboard` (`partner-report:view-all`);
  invites (`partner-report:invite`). Submit notifies the Chairman; review notifies the author.
- Tests: `partner-reports.service.spec` (guest provisioning + existing-email-reminds), `must-change-password.guard.spec`.
  api + worker + shared typecheck green; `migration:create` clean. **17 spec files.** Run `migration:up`
  (also seeds the `Guest` role via `ROLE_NAMES`).

## Partner reports — Staff allow-list + web UI  ⚠️ **migrations `Migration20260807123000` + `Migration20260807140000`**
- **`partner_report_reporters`** — Principal can allow existing **Staff** to submit (upsert + remind).
  Invite outcomes: `invited` (Guest) | `allowed` (Staff) | `reminded` (Partner/Guest). Other roles rejected.
- **Access:** `PermissionsGuard` + `/auth/me.partnerReportAllowed` + web `can()` treat allow-listed Staff
  as having `partner-report:submit` + `view`. Reporters list + DELETE revoke (Staff row / Guest invite).
- **Soft governance:** per-roster `cadence` / `remindersEnabled` / `reportRequestedAt` (never blocks submit).
  Principal **Request** / **Remind**; `GET me/status` for reporter banners; weekly cron nudges due/requested.
- **Export:** `GET /partner-reports/export` CSV (list); `GET /:id/export` PDF (single report letterhead).
- **Web:** `/partner-reports` list/new/detail, roster dialog (searchable enable + cadence + request),
  export menus, reporter request/due banner. BFF + middleware + Work nav.
  Run `migration:up` for roster + cadence columns.

## Infra hardening (complete) — rate limit + R2 + React Email
- **Auth rate limiting** — `@nestjs/throttler` global default (120/min) + strict limits on
  `login`/`forgot-password`/`reset-password` (5/min) and `refresh` (30/min).
- **R2 storage adapter** — `R2StorageAdapter` wired when `STORAGE_DRIVER=r2`; Zod fail-fast if R2 creds
  missing; shared `buildStorageKey` util; unit tests for key builder + adapter.
- **React Email templates** — worker renders `AccountCreated`, `PasswordReset`, `PasswordChanged`, and
  `GenericNotification` via `@react-email/render`; API notification outbox payload now `{ subject, body, link? }`.
- **Env alignment** — `.env.example` files document per-app copy (`apps/api` storage, `apps/worker` email).

## Web Slice 1 — Auth BFF, api-client, skeleton-first UI (complete)
- **`packages/api-client`** — `openapi-typescript` + `openapi-fetch`; committed auth subset OpenAPI for offline
  codegen; `pnpm generate:api-client` / `generate:api-client:live`.
- **`apps/web` auth BFF** — `/api/bff/auth/*` (login, refresh, logout, me, forgot/reset/change-password);
  httpOnly cookies (`abdc_access`, `abdc_refresh`); silent refresh on `me`.
- **shadcn primitives** — button, input, label, card, skeleton; **centralized skeletons** under
  `components/skeletons/` with barrel export (`AuthCardSkeleton`, `AppShellSkeleton`, `DashboardSkeleton`, …).
- **Auth flow** — `(auth)` route group (login, change-password, forgot/reset) + middleware cookie gate;
  `(app)` shell with `useAuth`, permission-filtered sidebar, forced password-change redirect.
- **Dashboard** — authed welcome + BFF health proxy status.
- **Docs** — DEVELOPMENT_GUIDELINES §14.1 skeleton-first rules.
- **Verify:** `pnpm --filter @abdcshare/web typecheck && build` green.

## Web Slice 2 — Admin CRUD, list infrastructure & dashboard (complete)
- **API** — `GET /api/roles` (`user:view`) for user forms; company-profile singleton `ensure()` fixed to
  look up / create `id = 1` (empty `findOne` criteria was 500ing).
- **`packages/api-client`** — full live OpenAPI regenerated (`openapi.json` + `schema.ts`); explicit
  `AuthUser` / `AuthTokens` / notification exports where Nest omits response schemas.
- **Generic BFF proxy** — `/api/bff/proxy/[...path]` with allow-listed prefixes + silent refresh;
  `bffApi()` client helper. Dedicated auth + notifications routes unchanged.
- **List infra** — TanStack Table `DataTable`, `useListParams` (URL `page/pageSize/q/sort`),
  `PageToolbar`, dialog/select/table/badge/textarea/alert-dialog; skeletons
  (`DataTableSkeleton`, `PageToolbarSkeleton`, `FormCardSkeleton`).
- **Users admin** — list/create/detail-edit/deactivate + Super Admin designation; reference/roles/
  departments/clients selects on create.
- **Catalogues admin** — engagement types (incl. allowed request-classes dialog), request
  classes/types/stages/statuses, departments — dialog CRUD + deactivate.
- **Clients + company profile** — clients list/create (primary contact)/edit/deactivate; early
  company-profile singleton form (later replaced by document library — see below).
- **Nav / middleware / dashboard** — sidebar admin links permission-gated; `/admin/*` cookie-protected;
  dashboard cards from live `GET /api/dashboard`.
- **Verify:** web typecheck + build green; BFF smoke (roles, users, engagement-types, company-profile,
  dashboard) 200 after admin login.
- **FE state (Ondoo-aligned):** TanStack Query for server data; Zustand `useUIStore` / `useAuthStore`
  for shell chrome + persisted session user metadata (no tokens). See DEVELOPMENT_GUIDELINES §6.5.
- **Icons:** `@tabler/icons-react` sole icon system (Lucide removed). See DEVELOPMENT_GUIDELINES §6.6.

## UI kit polish + company profiles library (complete, via `feature/UI-scaffold`)
- **Shared composites** — form field/select/date/dialog kit; `FilterBar`; DataTable polish; catalogues
  section shell + nav; users/clients admin migrated onto the shared kit.
- **Company profiles** — settings singleton (`company_profile`) replaced by **document library**
  `company_profiles` (upload/rename/replace/active). Migrations `Migration20260801114012` +
  `Migration20260801114039`. Web: grid + upload/rename/replace dialogs under `/admin/company-profile`.
- **Avatars** — server-side user avatar upload via StoragePort (`POST /api/users/me/avatar/…`); client
  DTOs enriched with contact/avatar fields. Seed filters legacy `Auditor` role label → `Staff`.
- **Assets** — file-type icons, illustration/pattern assets; Metronic public dump removed.

## Engagement domain API upgrades (complete, branch `feature/engagement-UI`)
Migrations: `Migration20260801143000` (status→**stage**), `Migration20260802223000` (team **Lead|Member**).

- **Lifecycle** — engagement column + history use `stage` (`Planning|Execution|Reporting|Completed|Archived`);
  dashboard + deadline reminders aligned.
- **Team roles** — Partner/Manager/Auditor → **Lead | Member**. Creator auto-Lead on create/clone;
  `POST /engagements/:id/team/:userId/elevate`; cannot remove the sole Lead. Spec:
  `engagement-lead.spec.ts`.
- **Workspace DTO** — `GET` workspace returns progress, classes, team, sign-offs, and capability flags
  (`viewerIsLead`, `canManageEngagement`, `canTransitionEngagement`, `canSignOffEngagement`). Controllers
  use `engagement:view`; real authz in the service via Lead-or-SA capabilities.
- **Sign-off mental model** — sign-off is a **completion checklist only** (blocks → Completed via
  `assertFullySignedOff` / missing request-class coverage). Hard edit freezes / `sign-off-lock` removed;
  request create/update/stage and WP uploads stay available after class sign-off.
- **Requests** — richer DTOs, history, bulk updates; engagement-type ↔ request-class mapping tightened.
- **Documents** — expanded upload/batch/working-paper flows; worker **ZIP export** consumer + env wiring.
- **Notifications** — shared type catalog for prefs/delivery; recipient helpers + preference endpoints;
  in-app event catalog documented.
- **api-client** — OpenAPI regenerated for Lead/workspace APIs. Domain docs updated (stages, Lead/Member).

## Web Slice 3 — Engagements / requests / collaboration UI (complete, branch `feature/engagement-UI`)
Staff/client product surfaces on top of Phase 3–4 APIs (plus upgrades above).

- **Engagements** — list + create/clone dialogs; workspace tabs **Overview | Requests | Documents | Settings**
  (Settings gated by manage/sign-off/transition; Documents by `document:view`). Stage header, next-action
  chips, class rail, planning supporting docs, team panel (Make Lead), sign-off panel, transition dialog.
- **Documents** — working papers + final reports live as the engagement **Documents** tab
  (`?tab=documents&category=…`); standalone `/engagements/[id]/documents` removed (app still pre-prod,
  no redirect). Sidebar global “Documents” nav item removed (docs are engagement-scoped).
- **Requests** — global inbox + engagement Requests tab; detail with overview (details + client responses
  feed), discussion tab (thread, @-mentions, attachments), history dialog, assignees, submit-for-review.
- **Submissions** — client response list/create + staff accept/return; metric cards.
- **Reviews** — `/reviews` decide queue (`review:decide`).
- **Final reports (client)** — `/final-reports` list + detail (`report-review:respond`).
- **Notifications** — header bell (unread + mark read) + `/settings/notifications` preferences UI.
- **Shell / BFF** — middleware + allow-listed BFF prefixes for engagement workflows; Tabler + file-type
  icons; accordion/alert/scroll-area/toggle-group primitives; metric cards + segmented `AppTabNav`.
- **Known small fix in-tree:** RowActions icons must be JSX elements (not component refs) on list pages.

**Still deferred from Slice 3+ (API often exists; web missing or stubbed):**
- **Global search UI** — `GET /api/search` exists; no header search.
- Bulk CSV user import; chart-library analytics (beyond Progress bars).

## Role dashboards + engagement analytics (complete)
- **Home** — `/dashboard` switches UI by `kind` (`features/dashboard/*`); deep-linked metrics + attention list.
- **Engagement Overview** — `workspace.analytics` aging buckets + workload by member (+ unassigned).
- Partner Reports UI shipped earlier; home strip reuses Principal/reporter counts.

## Per-file review + upload retry (complete)
- Reviews are per submission **file**; response status is derived (all Accepted → Accepted;
  any Returned → Returned; else Pending). Bulk “Accept all” kept.
- Returned files: append-only replacement via `replaces_file_id` (audit trail; supersedes old row).
- Metrics count **current files** by file status (not response count).
- Respond dialog: require ≥1 file; per-file Uppy progress + Retry; draft survives failures until cancel.
- Migration `Migration20260803110226`.

## Resilient large-file uploads (complete)
- **Atomic submissions** — `SubmissionStatus.Draft`; create is silent; `POST /submissions/:id/finalize`
  notifies staff; `DELETE` discards draft; hourly sweep removes Drafts older than 24h.
  Migration `Migration20260803102358`.
- **Multipart storage** — `StoragePort` create/sign/complete/abort/head; R2 + local adapters.
  Domain endpoints under submissions / documents / messages (`…/files|attachments/multipart…`).
  Complete verifies object size via HEAD.
- **Web** — Uppy (`@uppy/core` + `@uppy/aws-s3`) headless client; >50MB multipart with retries;
  wired into client responses, discussion attachments, engagement documents. Progress bars on submit.
- **Ops** — R2 CORS must include `PUT` + expose `ETag`; set bucket lifecycle to abort incomplete
  multipart uploads after 7 days (see `apps/api/.env.example`).

## Multi-contact clients + engagement client contacts (complete) ⚠️ **has a migration**
- **Org contacts:** Client-role users under a client; keep `primaryContact`; APIs
  `GET/POST /clients/:id/contacts`, patch / set-primary / reset-password / deactivate
  (block deactivate while assigned to engagements).
- **Engagement join** `engagement_client_contacts` (`is_main`, `receive_email`) —
  Migration `Migration20260806210000` + backfill from `client.primary_contact_id`.
- **Scope:** Client portal sees only engagements they are assigned to
  (`engagementScopeWhere` → `clientContacts.user`).
- **Notify:** all assigned get in-app; email only when `receiveEmail`;
  `NotifyRecipient.channels` + `engagementClientContactRecipients` wired into
  discussions, report-reviews, request.created.
- **Web:** client detail Contacts panel; create-engagement contact/main/email pickers;
  workspace Client contacts panel (SA/Lead manage).
- Run: `pnpm --filter @abdcshare/api migration:up`.

## Help Center (complete, branch `worktree-help-center`) ⚠️ **has a migration**
In-app help articles authored by admins, read by all authenticated users, gated per-article by role.
- **API** — `help_categories` / `help_articles` (Migration `Migration20260901190643`); `HelpService`
  (category + article CRUD, publish/unpublish, slug lookup, search, `help:manage`-gated image upload
  to `StoragePort` with resolved-URL rehydration on read) + `HelpController` (3 public reader routes
  under global auth — `GET /help/categories|articles/:slug|search` — plus `help:manage`-gated
  admin/mutation routes). Visibility is two-layered: `isVisibleTo` filters articles by
  `visibleToRoles` (empty = all roles) for the reader routes; `help:manage` (Platform Admin /
  Super Admin only — **not** granted to Client) gates the separate admin surface and mutations.
  New permission `help:manage` added to `packages/shared` permission map.
- **Web reader** — `/help` category/article accordion + search, `/help/[slug]` article page,
  read-only Tiptap renderer (`ArticleBody` + `HELP_TIPTAP_EXTENSIONS`), `HelpTip` contextual Sheet
  drawer wired into the Engagements page, sidebar "Help" entry (unguarded, all roles) under Account.
- **Web admin** — `/admin/help` category/article list (permission-guarded via the same
  `<RequirePermission>` pattern as other admin sections; loading/error states + delete confirm),
  Tiptap editor create/edit pages with image upload, mutation error handling, and required-field
  validation. Sidebar admin link gated by `help:manage`.
- **Verify:** API 32 suites/184 tests, web 2 suites/9 tests (`plain-text.spec.ts` +
  `client-ip.spec.ts`) — both via the real jest invocation (`apps/web`'s `pnpm test` script is a
  no-op placeholder; run `../api/node_modules/.bin/jest --config jest.config.js` from `apps/web/`).
  `pnpm typecheck && pnpm lint` clean (0 errors; pre-existing unrelated warnings only). Live E2E via
  curl: BFF + direct-API login, `GET /help/categories` and `/help/articles/engagements-overview`
  return seeded data incl. a working signed R2 image URL, 404 on unknown slug, 401 unauthenticated;
  `/help`, `/help/engagements-overview`, `/admin/help` all serve 200 with no server error digest.
  Client-role visibility was **code-verified, not live-verified** (no Client-role credentials
  available in this pass): `isVisibleTo`/`help:manage` guard logic read and confirmed correct
  (`Client` is absent from `ROLE_PERMISSIONS['help:manage']`-granting roles) — a real second-account
  browser click-through is still owed as a follow-up.
- Run: `pnpm --filter @abdcshare/api migration:up`.

## Pending / next
1. **Partner Reports web** — list/create/edit/submit (Partner/Guest), Chairman inbox + review, invite flow;
   replace sidebar `#` stub.
2. **Global search UI** — header/command search over scoped `GET /api/search`.
3. **Land `feature/engagement-UI`** — commit remaining Documents-tab + sidebar cleanup; smoke staff↔client
   loop; open PR when ready.
4. **v1 hardening (Phase 5)** — authz matrix pass, empty/error/a11y polish, observability; API e2e
   (Supertest + live DB) — unit specs ~22 files.
6. **Extract shared persistence** — worker still duplicates `outbox.entity.ts`; notifications
   `email_sent` update uses raw SQL to avoid duplicating the entity.
7. **Data note:** legacy `Auditor` role label should already be filtered in seed; confirm roles API
   returns `Staff`.

## Open decisions still outstanding
- Hosting/runtime, realtime vs polling, legacy data migration scope.
- Continuity/automation: remote/background agent (GitHub remote in place) vs. machine-awake sessions.
