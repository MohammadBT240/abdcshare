# Quantum (abdcshare) — Documentation

The successor to the ACA / ABDC practice-management portal, reorganised around **Engagements** and
**request classes**. Built as a **pnpm + Turborepo monorepo** — NestJS `api` + separate NestJS `worker` +
Next.js `web` — modeled on the `ondoo` house standard. The monorepo root is `Quantum/abdcshare/`.

## Read in this order

1. **[DOMAIN_MODEL.md](./DOMAIN_MODEL.md)** — entities, the Engagement → request class → Request type →
   Request hierarchy, roles, and glossary. Start here.
2. **[USER_STORIES.md](./USER_STORIES.md)** — product requirements: 15 epics, role-based user stories
   with acceptance criteria, MoSCoW priorities, a proposed-enhancement summary, and open questions.
3. **[TRACEABILITY.md](./TRACEABILITY.md)** — feature-parity proof: every legacy ACA action/page mapped
   to a Quantum story, plus the RBAC consistency check.
4. **[ERD.md](./ERD.md)** / **[ERD.mermaid](./ERD.mermaid)** — the 3NF relational schema (PostgreSQL via
   MikroORM): diagram, per-table specs, cardinalities, and the 1NF/2NF/3NF analysis.
5. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the engineering contract: monorepo layout, NestJS DDD
   backend, separate worker, Next.js web client, JWT auth, the **pagination standard** (§7), the
   **async/outbox architecture** (§8), shared packages, storage, testing, deployment.
6. **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** — the ACA green identity as a Tailwind + shadcn/ui theme:
   tokens, `globals.css`, app-shell layout, component mappings.
7. **[EXECUTION_PLAN.md](./EXECUTION_PLAN.md)** — the delivery roadmap: phases, sprint calendar,
   dependency map, migration plan, risks, and the global Definition of Done.
8. **[DEVELOPMENT_GUIDELINES.md](./DEVELOPMENT_GUIDELINES.md)** — the guardrails: golden rules, monorepo
   boundaries, NestJS DDD + worker + hooks rules, the anti-pattern catalog, review checklist, and the
   automated ESLint/CI enforcement that keeps the codebase out of spaghetti.

## Stack (decided)

pnpm + Turborepo monorepo · TypeScript (strict) · **NestJS** (`api` + separate `worker`, DDD) ·
**MikroORM** · PostgreSQL · **Redis + BullMQ** (async, transactional outbox) · **Next.js** App Router
(web) · TanStack Query + OpenAPI-generated client · **JWT** auth (httpOnly BFF cookies) ·
Tailwind CSS + shadcn/ui · Cloudflare R2 · **Resend** (email, from the worker). Latest stable versions
pinned at scaffold time.

## Status

Planning **complete (monorepo direction)** — user stories, traceability, ERD (3NF), architecture,
design system, execution plan, and development guidelines are drafted and awaiting sign-off. Sections
marked 🆕 in USER_STORIES.md are proposed enhancements needing an Approve / Defer / Cut decision. Open
questions live at the end of USER_STORIES.md (product), ARCHITECTURE.md §17 (technical), and ERD.md §7
(data).

## Next steps (after sign-off)

- Resolve the open questions and confirm team/timeline (see EXECUTION_PLAN §0, §9).
- Kick off **Phase 0**: scaffold the monorepo (`apps/api`, `apps/worker`, `apps/web`, `packages/*`),
  translate the MikroORM schema from ERD.md, stand up Postgres + Redis + the docker-compose stack, and
  prove the outbox → worker pipeline end to end.
- Groom & story-point the backlog from USER_STORIES to turn the sprint calendar into real dates.
