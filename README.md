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

## Getting started

```bash
pnpm install
cp .env.example .env
docker compose -f deploy/docker-compose.yml up -d postgres redis
pnpm --filter @abdcshare/api migration:up
pnpm dev            # runs api + worker + web via turbo
```

See **docs/** for architecture, ERD, execution plan, and development guidelines.
