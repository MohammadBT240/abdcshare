# abdcshare

The ABDC document-share / practice-management portal (successor to ACA), reorganised around
**Engagements** and **FS lines**.

Monorepo: **pnpm + Turborepo**.

```
apps/api      NestJS HTTP API (DDD, MikroORM)
apps/worker   NestJS async worker (BullMQ, Resend)
apps/web      Next.js web client (App Router, Tailwind + shadcn)
packages/shared    contracts: enums, pagination, permissions, queue payloads
packages/config    shared tsconfig / eslint / prettier
deploy/       docker-compose stack + Dockerfiles
docs/         product + engineering documentation (start at docs/README.md)
```

## Getting started (local development)

Apps run on the host with hot reload. Postgres and Redis run in Docker (or use a local Postgres
and only start Redis in Docker).

```bash
pnpm install
cp .env.example .env
# also copy per-app env templates (CLI/dev cwd is inside each app):
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env

# Copy storage vars into apps/api/.env and email vars into apps/worker/.env
# (dev commands run with cwd inside each app — root .env is reference only).

docker compose -f deploy/docker-compose.yml up -d postgres redis
pnpm --filter @abdcshare/shared build
pnpm db:setup    # migrate + seed (or migration:up + seed:dev)

pnpm dev   # turbo: shared (tsc --watch) + api :4000 + worker + web :3000
```

One-off filters (same as the matching turbo tasks):

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

Database (api MikroORM):

```bash
pnpm migration:create
pnpm migration:up
pnpm migration:down
pnpm db:setup      # ensure DB + migrate + seed
pnpm db:migrate    # ensure DB + migrate (no seed)
pnpm seed:dev
```

## Full Docker stack (optional)

Run api, worker, and web as containers too (slower feedback — rebuild/restart images for app changes).
Use compose env with in-stack hostnames (`postgres`, `redis`), not `localhost`.

```bash
docker compose -f deploy/docker-compose.yml --profile full up -d
```

See **docs/** (start at [docs/README.md](docs/README.md)) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## End-to-end tests (Playwright)

The `e2e/` package drives the real web app in Chromium against a running stack.

```bash
pnpm dev                 # api + worker + web
pnpm seed:e2e            # test personas (@e2e.test, fixture password) — refuses NODE_ENV=production
pnpm e2e                 # all specs; E2E_BASE_URL defaults to http://localhost:3000
pnpm e2e -- specs/library-visibility.spec.ts
```

Personas live in `apps/api/src/database/e2e-personas.ts` (Platform Admin, Super Admin, Tax staff,
Assurance staff, staff with no department, client, guest). The Office → PDF specs need LibreOffice
(`soffice`) where the worker runs.

### Postgres integration tests

`*.int-spec.ts` files run against a real, migrated database (the dev one is fine — they create and
remove their own rows; library events are append-only, so test events stay with a null item):

```bash
pnpm --filter @abdcshare/api test:int   # uses DATABASE_URL from apps/api/.env
```
