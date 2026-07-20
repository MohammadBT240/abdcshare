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

## Pending / next
1. **Install + build verification** — NOT yet run to completion (sandbox registry was throttled).
   Run locally: `pnpm install` then `pnpm build` / `pnpm typecheck`. Fix any version pin issues
   (versions were set to recent-stable caret ranges; `pnpm` will resolve latest stable).
2. **First migration** — `pnpm --filter @abdcshare/api migration:create` then `migration:up`
   (Postgres via `docker compose -f deploy/docker-compose.yml up -d postgres redis`).
3. **Prove the async pipeline end-to-end** — start api + worker, `POST /api/demo/outbox`, confirm the
   worker consumes and seals the outbox row to `Sent`.
4. **Extract shared persistence** — `apps/worker/src/database/outbox.entity.ts` duplicates the api entity;
   move to a shared `@abdcshare/persistence` package (noted in the file).
5. **Phase 1** — auth (JWT access/refresh + `refresh_tokens`), users, roles, RBAC guard wired to the
   shared permission map. See `docs/EXECUTION_PLAN.md`.

## Open decisions still outstanding
- Hosting/runtime, realtime vs polling, refresh-token storage (DB planned), legacy data migration scope.
- Continuity/automation (remote agent vs machine-awake) and a GitHub remote for the repo.
