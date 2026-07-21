# abdcshare — Progress Ledger

Resumable status so any session (or dev) can continue exactly where we stopped.

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
  scoping** applies (must be on the engagement). Clients have no `document:view` → no access. Guards
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

## Pending / next
1. **R2 adapter** — implement `R2StorageAdapter` (real presigned S3 URLs) once `@aws-sdk/*` is installed;
   flip `STORAGE_DRIVER=r2`. Then **submission_files** (deferred) reuse the same StoragePort.
2. **Partner weekly reports** (deferred by request) + **request-assigned** notification hook (not yet wired).
3. **Extract shared persistence** — worker duplicates `outbox.entity.ts`; notifications email_sent update
   uses raw SQL to avoid duplicating the entity. A shared persistence package would clean this up.
4. **Web frontend** + `api-client` generation (deferred by request).
5. **Data note (Mac):** migrate any `role = 'Auditor'` users to `Staff` (likely none).
6. **Jest on the Mac:** sandbox can't run it (jest 30 vs ts-jest 29 + pnpm preset resolution).

## Open decisions still outstanding
- Hosting/runtime, realtime vs polling, legacy data migration scope.
- Continuity/automation: remote/background agent (needs the GitHub remote — now in place — plus a
  token/App + the gated feature enabled) vs. machine-awake sessions.
