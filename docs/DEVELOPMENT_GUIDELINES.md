# Quantum — Development Guidelines & Guardrails

> The rules of the road. ARCHITECTURE.md says *what* the system is; this says *how to write code in it*
> so it stays clean, consistent, and free of spaghetti. **Guardrails, not suggestions** — code review
> and CI enforce them. When in doubt, follow the pattern already in the codebase.
>
> **v2 — monorepo.** Rules cover the whole workspace: NestJS **`api`** (DDD), NestJS **`worker`**,
> Next.js **`web`**, and shared **`packages/*`**.

---

## 0. The ten golden rules

1. **One responsibility per unit** (file, class, function, component, hook, use case). If you need "and"
   to describe it, split it.
2. **Respect the layers.** Web → API (HTTP). Inside the API: `presentation → application → domain`, with
   `infrastructure` implementing domain ports. Never invert the arrow; the domain imports nothing framework.
3. **Validate and authorise at every boundary.** Every controller/BFF route validates input and checks a
   permission before work. The web hides controls for UX; the **API is the real gate**.
4. **Type everything. `any` is banned.** Reach for `unknown` at boundaries and narrow.
5. **Modules/features/packages are islands.** Talk through public entry points, never deep imports.
6. **No business logic in controllers, components, hooks, or the web.** Logic lives in **use cases +
   domain** in the API. The web renders; hooks wire; controllers route.
7. **Every list is paginated** (ARCHITECTURE §7).
8. **Async that matters goes through the outbox → worker**, never fire-and-forget inline.
9. **Small units.** Soft caps: components/classes ≤ 200 lines, functions/use cases ≤ 50, files ≤ 300.
10. **Leave it cleaner.** No "temporary" hacks without `// TODO(owner):` + a ticket.

---

## 0.1 Debugging discipline — diagnose before you fix

**Rule: critically examine the error and its root cause *before* proposing any solution.** Do not
pattern-match an error to a quick fix. A wrong first guess wastes a full build/run cycle and often
stacks a second bug on the first.

Before writing a fix:

1. **Read the whole error.** The important line is often not the first — read the *cause* chain, the file
   and line it points at, and the expected-vs-actual types in full.
2. **Form a hypothesis about the root cause** and state it in one sentence. If you can't, you don't
   understand it yet — investigate more (read the failing file, the types, the docs) before touching code.
3. **Confirm the layer.** Is it a type error, a runtime error, a config/tooling issue, a data/DB issue, or
   an environment issue? Fixes differ completely — don't apply a code fix to an environment problem.
4. **Prefer the fix that removes the root cause**, not the one that silences the symptom. Casting to
   `any`, `// @ts-ignore`, `catch {}`, or disabling a lint rule are almost never the real fix.
5. **Check whether the approach itself is wrong.** Some errors mean "this pattern can't work" (e.g. a
   generic wrapper over a library's path-typed generics), not "add another cast." When two fixes in a row
   fail, stop and re-diagnose the *design*, don't try a third patch.
6. **State the diagnosis in the PR/commit** when non-obvious, so the next person understands *why*.

This applies to build errors, failing tests, flaky infra, and production incidents alike. Time spent
understanding the failure is never wasted; time spent guessing usually is.

---

## 1. Monorepo structure & boundaries

```
apps/api  ·  apps/worker  ·  apps/web  ·  packages/shared  ·  packages/config  ·  packages/api-client
```

**Package import rules (enforced by ESLint `boundaries` + `no-restricted-imports`):**

| Package | May depend on | Must NOT |
|---------|---------------|----------|
| `packages/shared` | nothing internal (leaf) | import from apps or other packages |
| `packages/api-client` | `shared` (types) | import app code |
| `apps/api` | `shared` | import `web`, `worker`, `api-client` |
| `apps/worker` | `shared` (+ its own persistence) | import `web`, `api` HTTP layer, `api-client` |
| `apps/web` | `shared`, `api-client` | import `api`/`worker` source, or call the DB directly |

- **No cross-app source imports.** `web` reaches the backend only via `api-client` (HTTP). `worker` and
  `api` share **contracts** via `shared` and the **DB** via their own persistence — not each other's code.
- **No circular dependencies** anywhere (CI fails via `madge`/`import/no-cycle`).
- Workspace aliases (`@quantum/shared`, `@quantum/api-client`); `@/*` within an app. Never `../../../`.

---

## 2. Backend — NestJS DDD rules (`apps/api`)

**Module shape** (non-trivial modules): `presentation/` (controllers, DTOs) · `application/` (use cases) ·
`domain/` (entities, value objects, repository **ports**, domain events) · `infrastructure/persistence/`
(MikroORM entities + repository **adapters**). Simple catalogue modules may be flat (`*.controller.ts` +
`*.service.ts`) — but the dependency direction still points inward.

- **Controllers** route only: validate the DTO (class-validator), apply guards/`@RequirePermission`,
  call **one** use case, map to a response DTO. **No logic, no MikroORM, no cross-module calls.**
- **Use cases** (application) own **one operation**: orchestrate domain + repositories, own the
  **transaction / unit of work**, emit domain events, and write the **outbox row in the same tx**. A use
  case is the only place a transaction begins.
- **Domain** is pure TypeScript: entities with behaviour and invariants, value objects, repository ports
  (interfaces), domain events. **No `@nestjs/*`, no MikroORM, no infrastructure imports.**
- **Repositories** (infrastructure) implement domain ports with MikroORM: parameterised queries,
  pagination, `select`/`populate`. **No business rules, no auth.** One aggregate = one repository.
- **DTOs** are explicit classes: `Create*Dto`, `Update*Dto`, `*ResponseDto`, `*PaginatedResponseDto`.
  Never return raw entities from a controller — always map to a response DTO.
- **Cross-module** work goes through the other module's **use case / service**, never its repository or
  entities directly.
- Every module registers cleanly in `app.module.ts`; no global singletons holding state.

---

## 3. Worker rules (`apps/worker`)

- Consumers are **thin**: pull the job, call a service/use case, update outbox status. **Idempotent** —
  a job may run more than once (dedupe on `jobId = outbox.id` / natural keys).
- **Retries/backoff/rate-limits** are BullMQ config, not hand-rolled loops. Failures after max attempts
  go to a **dead-letter queue** and are logged/observable (Bull Board).
- Schedulers register **repeatable** jobs on boot and enqueue **delayed** jobs for time-based work
  (reminders). No `setInterval`/`setTimeout` business timers.
- The worker shares contracts via `packages/shared`; it does **not** import the API's HTTP layer.
- Long/heavy work (zip export, thumbnails, scans) lives here, never in a request handler.

---

## 4. Async & the outbox (both api + worker)

- Anything triggered by a domain change that must not be lost (email, in-app notifications, downstream
  jobs) is written as an **outbox row in the same transaction** as the change — never sent inline.
- A failed side effect (e.g. email) **must never roll back** the business operation; the outbox+queue
  decouples them.
- Job payloads are **typed** in `packages/shared`; queue names are shared constants. No stringly-typed
  payloads.

---

## 5. Frontend — Next.js (`apps/web`)

- **Server Components by default;** add `'use client'` only for state/effects/handlers, pushed to leaves.
- The web calls the backend **only** through the generated **`@quantum/api-client`** wrapped in TanStack
  Query hooks. **No inline `fetch`; no direct DB access; no domain logic.**
- **No Server Actions as a backend** — real logic is in the API. Actions, if used, are trivial passthroughs.
- **Auth via the BFF:** tokens live in httpOnly cookies set by `app/api/bff/*`; the browser never holds
  raw JWTs. Never store tokens in `localStorage`/JS.
- **Composition over configuration;** props typed and minimal; no prop-drilling > ~2 levels; no business
  logic in JSX; stable keys; a11y is part of "done".

---

## 6. Hooks — rules & patterns  *(web)*

### 6.1 Rules of Hooks (non-negotiable)
Top level only — never in conditions/loops/nested fns. `eslint-plugin-react-hooks` (rules-of-hooks +
`exhaustive-deps`) is an **error**, never disabled to hide a bug.

### 6.2 When to write one
Extract a hook when logic is **stateful/effectful AND reused**, or to declutter a component's hook soup.
**Pure logic is NOT a hook** — put formatting/mapping/among in `lib/` or `packages/shared`. A hook that
calls no other hook shouldn't be a hook.

### 6.3 Conventions
- Name `useX`; return a tuple for simple pairs, a **named object** for 3+ values.
- One hook = one concern. `useEngagementFilters` does filters; it does not fetch.
- **Server calls only in feature hooks** (`features/*/hooks.ts`) via TanStack Query + `api-client`.
- One `xKeys` query-key factory per feature — never hand-written key strings.
- Mutations **invalidate** relevant keys; optimistic updates always have `onError` rollback.
- Pagination/sort/filter state lives in the **URL** and flows into the query key.
- **No god-hooks.** A `usePage()` returning 20 things is spaghetti — split by concern.

### 6.4 Shared hooks
`usePermissions`, `useDebounce`, `useConfirm`, `useMediaQuery` live in `web/hooks`, generic, domain-agnostic.

### 6.5 Client vs server state *(web — Ondoo-aligned)*
Split state by concern; do not put everything in one store.

| Concern | Tool | Location |
|--------|------|----------|
| Server / async API data | TanStack Query | `features/*/hooks` via BFF / `api-client` |
| Client UI chrome (sidebar, etc.) | Zustand | `apps/web/src/store/useUIStore.ts` |
| Session user metadata (no tokens) | Zustand + persist | `apps/web/src/store/useAuthStore.ts` (synced from `/me` Query) |
| Shareable list filters / page | URL search params | `useListParams` |
| Forms | react-hook-form + zod | feature forms |
| Theme | `next-themes` | root `Providers` (not a Zustand theme store) |

**Hard rules:** never duplicate API entities (users, clients, catalogues, …) in Zustand; never store
access/refresh tokens in Zustand (httpOnly BFF cookies only). Subscribe with selectors
(`useUIStore((s) => s.sidebarCollapsed)`), not the whole store.

---

## 7. Forms (web)
`react-hook-form` + `zodResolver` using the **shared** Zod schema (`packages/shared`) that also types the
API request. Field errors from the API's `{ fieldErrors }` map back onto the form.

---

## 8. TypeScript rules (all packages)
- `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. No loosening.
- `any` banned (error). No `as` to silence the compiler (only `as const`). No non-null `!` except right
  after a proven guard.
- **Derive, don't duplicate:** infer from Zod (`z.infer`), MikroORM entities, and the generated client.
  One source per shape, in `packages/shared` when cross-cutting.
- Discriminated unions over boolean soup for state.

---

## 9. Validation & data integrity
- **API:** class-validator DTOs on every input; **web/BFF:** Zod. Validate once at each boundary.
- Env validated at boot with Zod (`config/env.schema.ts`) in each app; crash fast on misconfig.
- Trust nothing from the client; re-check ownership/permission server-side even if the UI hid it.
- DB constraints (FKs, unique, NOT NULL, enums, checks) are the last line — model them in MikroORM.

---

## 10. Security & RBAC
- **Defence in depth:** web middleware → BFF cookies → **API guard (`@RequirePermission`)** → use-case
  resource scope. The web check is UX only.
- **One permission source** in `packages/shared` drives the API guard **and** the web menu — they can't drift.
- Governance writes = **Platform Admin only**; Super Admin read-only on governance — enforced in use cases.
- JWT: short access + **rotating refresh with reuse detection**; refresh tokens stored **hashed**. Never
  log secrets/tokens. Downloads only via authenticated endpoints. Uploads validated (MIME+size) server-side.
- Every significant mutation writes an **audit-log** entry.

---

## 11. Pagination guardrail
Restated: **no endpoint returns an unbounded list.** Shared `paginationQuery` + `Paginated<T>`, `pageSize`
capped at 100 server-side, deterministic sort with a tiebreaker, allow-listed sort/filter columns, every
key index-backed, exports streamed in batches. Grids = offset + `keepPreviousData`; feeds = cursor +
`useInfiniteQuery`. See ARCHITECTURE §7.

---

## 12. Database & MikroORM
- Schema changes via **migrations** (reviewed in PRs). Never edit shared DBs by hand.
- Deliberate `select`/`populate` — no accidental over-fetch. Avoid **N+1** (batch/`populate`).
- Index every column used in `where`/`orderBy` on a hot path (composite where needed); pagination keys indexed.
- Multi-write ops run in a **unit of work / transaction** inside the use case.
- Entities/enums/relations mirror ERD.md; the MikroORM schema is the source of truth for data shape.

---

## 13. Email (Resend)
- Templates are **React Email** components (typed props), rendered and sent via **Resend** — only from the
  **worker** (`apps/worker/src/email`). No app code imports the Resend SDK directly except the dispatch service.
- Triggered by the **outbox → worker**, respecting user notification preferences — never fired from a
  controller/component. A failed send never rolls back business state; it retries via BullMQ.
- Config via validated env; test key in non-prod; never send real mail from dev.

---

## 14. Styling (web: Tailwind + shadcn)
- Use **theme tokens** (DESIGN_SYSTEM.md), never raw hex. Compose with `cn()`. Extend shadcn variants
  centrally in `components/ui` — don't fork primitives per feature. No inline `style` except dynamic values.
- Reuse shared `DataTable`, `PageToolbar`, `Card` — don't rebuild tables per page.

### 14.1 Skeleton-first loading (web — mandatory)

Every async UI surface ships with a **matching skeleton** before real content. No blank screens or
spinner-only pages.

1. **Three loading layers:**
   - **Route:** `loading.tsx` per route segment (App Router suspense boundary).
   - **Query:** TanStack Query `isPending` / `isFetching` → render the feature skeleton (not `null`).
   - **Mutation:** Form submit → disable inputs + inline skeleton or `aria-busy` on the primary action.
2. **1:1 layout match:** Skeleton mirrors final layout (same grid, card count, sidebar width) to avoid layout shift.
3. **Centralized skeleton folder (locked):** All domain/page skeleton components live **only** under
   `apps/web/src/components/skeletons/`. Do **not** co-locate skeletons in `features/*`, route folders,
   or next to layout components. The shadcn base primitive stays in `components/ui/skeleton.tsx`.
4. **Barrel export:** `components/skeletons/index.ts` re-exports every skeleton; pages, `loading.tsx`,
   and hooks import from `@/components/skeletons` (never deep paths).
5. **Naming:** `<Feature><Part>Skeleton` — e.g. `AuthCardSkeleton`, `AppHeaderSkeleton`. One file per skeleton.
6. **No fetch in components:** Data via BFF + hooks only (ARCHITECTURE §6).

---

## 15. Error handling
- **API:** typed domain errors (`ValidationError`, `Forbidden`, `NotFound`, `Conflict`) → global exception
  filter → consistent status + `{ error, code?, fieldErrors? }`.
- **Web:** errors surface via toast + field errors; route `error.tsx`/`not-found.tsx`.
- **Never swallow errors** (`catch {}`). No `console.log` in committed code (ESLint error). Structured
  logging (pino/Nest) with correlation IDs. User messages generic; diagnostics to logs.

---

## 16. Testing
- Write tests with the code (DoD). **API:** use-case/domain/RBAC unit (mock ports) + Supertest e2e +
  pagination correctness. **Worker:** consumer/scheduler unit + integration (PG+Redis). **Web:** Vitest
  hooks/utils + Playwright per role.
- Test **behaviour, not implementation**. Cover the guardrails (RBAC per role, pagination cap, outbox idempotency).

---

## 17. Git, commits & PRs
- Trunk-based, short-lived branches (`feat/engagement-create`). **Conventional Commits**. Small PRs
  (< ~400 lines) linking the **Q-ID** + touched modules/tables. Squash-merge; delete branch.
- No direct pushes to `main`; CI + review checklist (§19) required.

---

## 18. Anti-patterns catalog (reject in review)

| Anti-pattern | Do instead |
|--------------|-----------|
| Logic in a controller/component/hook | Use case + domain (API) |
| MikroORM/DB call in a controller or the web | Repository → use case → controller; web → api-client |
| `web` importing `api`/`worker` source | Call the API via `@quantum/api-client` |
| Domain importing Nest/MikroORM | Keep domain pure; wire in infrastructure |
| `fetch()` in a client component | A TanStack Query hook + api-client |
| God-hook / god-component / god use-case | Split by single concern |
| `any`, `as any`, non-null `!` to silence TS | Model the type; narrow `unknown` |
| Deep cross-package/feature import | Go through the public entry / `shared` |
| Hand-mirrored FE/BE types | `packages/shared` + generated `api-client` |
| Unpaginated list | `paginationQuery` + `Paginated<T>` |
| Inline/fire-and-forget email or job | Outbox row → worker |
| Returning raw entities from a controller | Map to a `*ResponseDto` |
| Raw hex / inline styles | Theme tokens + `cn()` |
| Empty `catch {}` / `console.log` | Typed error handling + pino |
| Menu says one thing, API allows another | Single shared permission source |

---

## 19. Code review checklist
- [ ] Layer/dependency direction respected (domain pure; no logic in controllers/components/hooks).
- [ ] Input validated; permission checked in the API; audit entry written; side effects via outbox→worker.
- [ ] Lists paginated; filters/sorts indexed.
- [ ] Types sound — no `any`/`as any`/unjustified `!`; shapes from one source (`shared`/generated client).
- [ ] Hooks obey rules; no god units; web calls backend only via api-client.
- [ ] No cross-app source imports; no circular deps; boundaries honoured.
- [ ] Styling uses tokens + shared components; a11y states present.
- [ ] Tests cover behaviour + guardrails; CI green.
- [ ] Errors typed/handled; user messages generic; secrets never logged.

---

## 20. Automated enforcement (Phase 0)
- **ESLint:** `@typescript-eslint` (no-explicit-any, no-floating-promises, consistent-type-imports),
  `eslint-plugin-react-hooks` (errors), `eslint-plugin-boundaries` (§1 matrix + hexagonal layer rules),
  `import/no-cycle`, `no-console` (allow warn/error), `no-restricted-imports` (block MikroORM outside
  repositories, block Resend SDK outside the worker email service, block cross-app source imports).
- **Prettier** + Tailwind class sorter; format on save + pre-commit.
- **TypeScript** `tsc --noEmit` per package in CI and pre-commit.
- **madge** fails the build on circular deps. **OpenAPI drift check** fails if `api-client` is stale.
- **lint-staged + Husky** on changed files. **CI (Turbo affected):** typecheck → lint → test → build →
  e2e. Red = no merge. Optional **danger.js** for PR hygiene (size, linked Q-ID, tests present).
