# Quantum — Execution Plan

> How we build Quantum from the docs (DOMAIN_MODEL, USER_STORIES, ERD, ARCHITECTURE, DESIGN_SYSTEM,
> DEVELOPMENT_GUIDELINES). Delivery roadmap: phases, sprints, sequencing, exit criteria, risks.
>
> **v2 — monorepo direction.** Quantum is a **pnpm + Turborepo monorepo**: NestJS **`api`** + separate
> NestJS **`worker`** + Next.js **`web`** + shared packages, modeled on `ondoo`.

---

## 0. Working assumptions

Recommended defaults; tell me if any differ and I'll re-cut the calendar.

| Assumption | Value | Effect if changed |
|------------|-------|-------------------|
| Team | Small team (2–4) | Solo → serial, ~1.8× calendar. Larger → BE/FE squads in parallel. |
| v1 scope | **Engagements core + full ACA parity** (notifications, audit). Reviews, dashboards, versioning, search, reminders → **v1.x**. | "Core + enhancements" pulls Phase 6 forward. |
| Timeline | No hard deadline — build it right. | Aggressive → private beta after Phase 4; harden later. |
| Backend | Modular monolith `api` + **separate `worker` service from day one**. | — |
| Stack | pnpm+Turbo · NestJS · MikroORM · PostgreSQL · Redis/BullMQ · Next.js · Resend · R2. **Latest stable pinned at scaffold.** | — |
| Hosting | Docker + Ansible (ondoo-style) + managed PG/Redis. | Managed PaaS shifts Phase 0 infra tasks. |
| Sprint | 2 weeks | — |

**Rough calendar (small team):** Phase 0 ≈ 1.5 sprints; Phases 1–5 (v1) ≈ **8–9 sprints**; Phase 6
(v1.x enhancements) ≈ 4 sprints; Phase 7 (migration + launch) ≈ 2 sprints. Ranges, not commitments,
until stories are pointed (§7).

---

## 1. Delivery strategy

1. **Vertical slices per domain, API-first then web.** For each module, ship the API slice (domain →
   use case → controller → migration → tests → OpenAPI), then the web slice (generated client → hooks →
   UI → e2e). Something is demoable every sprint.
2. **Walking skeleton first.** Phase 0 delivers a deployable monorepo — `api` + `worker` + `web` +
   Postgres + Redis on CI with auth, one real endpoint, and the async pipeline proven end-to-end.
3. **Contract-driven.** The API's OpenAPI + `packages/shared` are the source of truth; the web consumes
   the generated client. No hand-mirrored types.
4. **Parity before enhancement.** Re-create ACA (restructured around engagements/FS lines) before 🆕 items.
5. **Guardrails are built in, not retrofitted:** pagination, RBAC, outbox, and the DDD layering are part
   of the Phase 0/1 scaffolding, so no feature is ever built without them.
6. **Definition of Done is non-negotiable** (§8).

---

## 2. Phases

### Phase 0 — Monorepo, infra & walking skeleton  *(Sprint 1 – 1.5)*
**Goal:** a deployable monorepo with auth and the async pipeline working end-to-end.

- Monorepo scaffold: pnpm workspace + Turborepo, `.npmrc` (hoisted), `tsconfig.base`, `packages/config`
  (eslint/prettier/tsconfig), `packages/shared` (enums, pagination contract, permission map, queue names).
- **`apps/api`**: Nest bootstrap, Zod-validated config, MikroORM + first migration, health, global
  validation/exception filter, Swagger/OpenAPI, `packages/api-client` generation.
- **`apps/worker`**: Nest app context, BullMQ connection, one demo consumer, scheduler skeleton.
- **Outbox pipeline proven:** api writes an outbox row in a tx → publisher enqueues → worker consumes →
  seals status. (The "hello async" slice.)
- **`apps/web`**: Next App Router + Tailwind/shadcn (ACA theme from DESIGN_SYSTEM), BFF auth cookies,
  TanStack Query provider, shared paginated `DataTable`, `AppSidebar/Header/PageToolbar`.
- **Auth foundation:** JWT access/refresh in api, `refresh_tokens` table, login/refresh/logout, forced
  password change; web BFF + middleware gate.
- Infra: `deploy/` Dockerfiles (api/worker/web) + docker-compose (PG, Redis, migrate, api, worker, web);
  CI (Turbo affected: typecheck/lint/test/build) + preview deploy; Ansible skeleton.

**Exit:** login → forced password change → role-based shell; a seeded list renders via the paginated
`DataTable` through the generated client; the outbox→worker path demonstrably delivers a job. Green CI.

---

### Phase 1 — Auth, users, roles & RBAC  *(Sprint 2)*
- **Epic A** (A-1…A-7), **Epic B** (B-1…B-6). Full permission map in `packages/shared` wired to the API
  guard **and** the web menu (one source). Last-Platform-Admin guard.

**Exit:** all auth + user/role flows working API+web; RBAC verified per role by tests; mutations audited.

---

### Phase 2 — Catalogues, departments, company profile  *(Sprint 3)*
- **Epic C** (FS lines, request types under FS lines, stages, statuses, per-type scoping), **Epic D**
  (departments), **Epic O** (company profile). Paginated admin grids.

**Exit:** all reference data manageable; Super Admin read-only on governance; audited.

---

### Phase 3 — Engagements, FS lines & requests (the core)  *(Sprints 4–5)*
- **Epic E** (E-1…E-9): engagement CRUD, status lifecycle + history, team assignment, workspace (FS
  lines with grouped requests + progress), add FS lines. (Templates/clone → Phase 6.)
- **Epic F** (F-1…F-8): requests from request types (auto FS line), stage/status, assign, due dates,
  paginated grids, bulk update, history.

**Exit:** open engagement → staff → add FS lines → create requests grouped by FS line → drive stages;
paginated, permission-checked, audited, e2e happy-path green.

---

### Phase 4 — Documents, client portal & collaboration  *(Sprints 6–7)*  → **v1 RC**
- **Epic G** (uploads by FS line, secure download/preview, zip export via worker, delete),
  **Epic H** (client submissions, accept/return), **Epic I** (I-1…I-3 discussions + read-tracking),
  **Epic L** (L-1…L-3 notifications + Resend email via worker), **Epic N** (audit viewer).

**Exit:** full ACA parity in the new structure; document loop works with no public URLs; emails/
notifications fire via the worker on the right events. **v1 feature-complete → UAT.**

---

### Phase 5 — v1 hardening  *(Sprint 8)*
- Security review (authz matrix, uploads, headers/CORS, refresh rotation), performance/index pass on
  every paginated query, a11y, empty/loading/error states, observability (logs, Bull Board, metrics).

**Exit:** green security/perf/a11y gates; v1 signed off.

---

### Phase 6 — Enhancements (v1.x)  *(Sprints 9–12)*
- **Epic J** reviews/sign-off · **Epic K** dashboards (Recharts) · **G-4** versioning · **E-6/E-7**
  templates & clone · **I-4/I-5** mentions & attachments · **Epic M** (M-1, M-4) search + status report ·
  **L-4** deadline reminders (BullMQ delayed/repeatable jobs in the worker).

**Exit:** each enhancement shipped as a vertical slice with tests; no v1 regression.

---

### Phase 7 — Data migration & launch  *(Sprints 13–14)*
- Migration scripts `aca.sql` → new schema (dry-run → verify → cutover); load test heavy grids/exports;
  backups + runbook; UAT sign-off; production cutover; ACA kept read-only as archive.

**Exit:** verified data parity, green gates, successful cutover, rollback plan.

---

## 3. Dependency map

```
Phase 0 (monorepo + infra + auth + async skeleton)
  └─> Phase 1 (auth/users/RBAC)
        └─> Phase 2 (catalogues/departments/profile)   ← engagements need FS lines + request types
              └─> Phase 3 (engagements + requests)      ← the core
                    └─> Phase 4 (documents, portal, discussions, notifications, audit) → v1 RC
                          └─> Phase 5 (hardening) → v1
                                └─> Phase 6 (enhancements)
                                      └─> Phase 7 (migration + launch)
```

**Parallelism levers (larger team):** within each phase, an **API squad** and a **web squad** work the
same module a step apart (API contract lands first, web follows the generated client). The **worker**
track (outbox consumers, email, reminders) can run alongside once Phase 0's pipeline exists.

---

## 4. Sprint calendar (small team, v1 = Phases 0–5)

| Sprint | Focus |
|--------|-------|
| 1–1.5 | Phase 0 — monorepo, api/worker/web scaffold, auth, outbox pipeline, CI, compose |
| 2 | Phase 1 — auth flows, users/roles, RBAC map |
| 3 | Phase 2 — FS lines/request types/stages, departments, company profile |
| 4–5 | Phase 3 — engagements (E) + requests (F) |
| 6–7 | Phase 4 — documents (G), client portal (H), discussions (I), notifications (L), audit (N) → v1 RC |
| 8 | Phase 5 — hardening → v1 |
| 9–12 | Phase 6 — reviews (J), dashboards (K), versioning, search, reminders |
| 13–14 | Phase 7 — migration + launch |

---

## 5. Cross-cutting tracks (every sprint)

- **Testing:** API unit (use cases/domain/RBAC) + Supertest e2e; worker consumer tests; web Vitest +
  Playwright; pagination correctness tests. Written with the code.
- **CI/CD (Turbo-aware):** typecheck → lint → test → build for **affected** projects; per-app Docker
  build; migrations gated; preview deploys. Red = no merge.
- **Environments:** `local` (docker-compose) → `preview` (PR) → `staging` → `production`.
- **Contract:** regenerate `packages/api-client` from OpenAPI whenever the API changes; CI fails on drift.
- **Security & a11y:** RBAC test per endpoint; keyboard/contrast per screen — continuous.
- **Docs/ADRs:** keep `docs/` current; log notable decisions.

---

## 6. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Two-service + monorepo overhead early | Slower start | Phase 0 walking skeleton proves api+worker+web+CI before features. |
| FE/BE contract drift | Bugs | OpenAPI-generated client + `packages/shared`; CI drift check. |
| Async correctness (lost/duplicate jobs) | Data integrity | Transactional outbox + `jobId` idempotency + DLQ; pipeline tested in Phase 0. |
| Engagement/FS-line model misunderstood late | Rework | Phase 3 demo early vs user stories; confirm open questions before Sprint 4. |
| Legacy data mapping (types → FS lines) | Migration slip | Dry-run migration early (Phase 2) with real `aca.sql`. |
| RBAC menu/access drift (ACA pitfall) | Security | Single permission source drives API guard + web menu; RBAC tests. |
| Redis/infra as new moving parts | Ops | Compose stack + managed Redis in prod; health checks; Bull Board. |
| Scope creep of 🆕 into v1 | Timeline | Enhancements ring-fenced in Phase 6. |

---

## 7. Estimation & tracking

- Groom USER_STORIES into a backlog and **story-point** each; only then do sprint ranges become dates.
- Track velocity from Sprint 2; re-forecast Phases 6–7 after three real sprints.
- Each ticket links its **Q-ID** (USER_STORIES) and touched **ERD tables** / **modules**.

---

## 8. Definition of Done (every story)

1. Input validated (DTO/Zod) at the boundary; **authorised** server-side via the RBAC map (not UI-only).
2. Any list is **paginated** (ARCHITECTURE §7) with indexes backing filters/sorts.
3. Mutations write an **audit-log** entry; side effects (email/notifications) go through the **outbox →
   worker**, never inline.
4. API contract reflected in OpenAPI; `packages/api-client` regenerated; web consumes it (no hand types).
5. Tests: API use-case/RBAC unit + e2e; web hook/flow; worker consumer where relevant. CI green.
6. Web matches DESIGN_SYSTEM (ACA theme) with loading/empty/error + a11y. No `any`; typed end-to-end.
7. Respects module/package boundaries (DDD direction; no deep cross imports). Docs/ADR updated if a decision changed.

---

## 9. Immediate next actions

1. **Resolve open questions** (USER_STORIES product, ARCHITECTURE §17 technical, ERD §7 data) — esp.
   hosting, realtime vs polling, refresh-token storage, legacy migration.
2. **Confirm team & v1 scope** so §4 becomes a real calendar.
3. **Kick off Phase 0** — scaffold the monorepo (`apps/api`, `apps/worker`, `apps/web`, `packages/*`),
   translate the MikroORM schema from ERD.md, stand up Postgres+Redis+compose, prove the outbox pipeline.
4. **Groom & point** the backlog from USER_STORIES.
