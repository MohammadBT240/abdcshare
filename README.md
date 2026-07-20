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

docker compose -f deploy/docker-compose.yml up -d postgres redis
pnpm --filter @abdcshare/shared build
pnpm --filter @abdcshare/api db:setup    # migrate + seed (or migration:up + seed:dev)

pnpm dev   # turbo: shared (tsc --watch) + api :4000 + worker + web :3000
```

One-off filters (same as the matching turbo tasks):

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

## Full Docker stack (optional)

Run api, worker, and web as containers too (slower feedback — rebuild/restart images for app changes).
Use compose env with in-stack hostnames (`postgres`, `redis`), not `localhost`.

```bash
docker compose -f deploy/docker-compose.yml --profile full up -d
```

See **docs/** (start at [docs/README.md](docs/README.md)) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
