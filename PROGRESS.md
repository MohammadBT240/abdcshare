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

## Pending / next
1. Commit + push the above; merge to `main`.
2. **Extract shared persistence** — `apps/worker/src/database/outbox.entity.ts` duplicates the api
   entity; move both to a shared `@abdcshare/persistence` package (noted in the file).
3. **(optional) Prove async pipeline** — `pnpm dev` (or `pnpm dev:api` + `pnpm dev:worker`), then
   `curl -X POST localhost:4000/api/demo/outbox -d '{"message":"hi"}' -H 'content-type: application/json'`
   → worker seals the outbox row to `Sent`.
4. **Phase 1 — Auth & RBAC (next feature slice):** JWT access + rotating refresh (using `refresh_tokens`),
   login / refresh / logout, forced password change, `JwtAuthGuard` + `PermissionsGuard`/`@RequirePermission`
   wired to `@abdcshare/shared` ROLE_PERMISSIONS, and the users module. Then Phase 2 catalogues CRUD.
   See `docs/EXECUTION_PLAN.md`.

## Open decisions still outstanding
- Hosting/runtime, realtime vs polling, legacy data migration scope.
- Continuity/automation: remote/background agent (needs the GitHub remote — now in place — plus a
  token/App + the gated feature enabled) vs. machine-awake sessions.
