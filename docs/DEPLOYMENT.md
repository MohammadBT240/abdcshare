# abdcshare — Deployment (VM, multi-environment)

> How abdcshare deploys to a VM across **local → staging → production**, modeled on the ondoo house
> standard (Docker Compose stack + Ansible + GitHub Actions) and elevated. Read with ARCHITECTURE.md §14.

---

## 1. Topology

Each environment runs the **same Docker Compose stack** on a VM; only configuration differs.

```
                        VM (staging or production)
  ┌──────────────────────────────────────────────────────────────┐
  │  reverse proxy (Caddy/Traefik/nginx) — TLS, routes            │
  │        ├── web   (Next.js)         :3000                      │
  │        └── api   (NestJS)          :4000  ── /api             │
  │  worker (NestJS, no port) ── consumes queues                  │
  │  postgres (17)   :5432 (internal)                             │
  │  redis (7)       :6379 (internal)                             │
  │  migrate (one-shot job) — runs on each deploy, then exits     │
  └──────────────────────────────────────────────────────────────┘
```

- **web/api** are public (behind the proxy + TLS); **postgres/redis** are internal-only (not published).
- **worker** shares the DB + Redis, no inbound ports.
- **migrate** is a short-lived container that runs DB migrations before api/worker start (see §4).

---

## 2. Environments

| Env | Where | DB / Redis | Config source | Deploy trigger |
|-----|-------|------------|---------------|----------------|
| **local** | your Mac | your local Postgres + Docker Redis | per-app `.env` (gitignored) | manual (`pnpm dev`) |
| **staging** | staging VM | containers in the stack | `compose.env.staging` (on the VM, from Ansible Vault) | auto on merge to `main` |
| **production** | prod VM | containers (or managed PG) | `compose.env` (on the VM, from Ansible Vault) | on git **tag** + manual approval |

The **code is identical** across environments. What changes is the **environment file** (`compose.env*`)
and the image **tag** deployed. This mirrors ondoo's `compose.env.example` / `compose.env.staging.example`.

---

## 3. Configuration & secrets

- **Never in git.** `.env` and `compose.env*` are gitignored. The repo ships only `*.example` templates.
- **Per-env values** (DB URL, JWT secrets, `RESEND_API_KEY`, `R2_*`, `API_BASE_URL`, domains) live in an
  environment file **on the VM**, rendered by **Ansible** from an encrypted **Ansible Vault** file.
- Compose injects them via `env_file:` per service. Rotating a secret = update Vault → re-run the deploy
  playbook (no image rebuild).
- CI holds only what it needs to build/push images and reach the VM: a **registry token** and a
  **deploy SSH key / Ansible Vault password**, stored as GitHub **Environments** secrets (with required
  reviewers on `production`).

---

## 4. Database migrations on deploy

Migrations are **committed to the repo** (`apps/api/src/migrations/*`) — never generated on the server.

On every deploy the pipeline runs the one-shot **migrate** step **before** api/worker start:

```bash
# inside the api image, against the env's DATABASE_URL
pnpm --filter @abdcshare/api db:migrate     # = ensureDatabase + migrator.up()  (NO seed in prod)
```

- `db:migrate` ensures the database exists and applies pending migrations only. **Seeding is skipped in
  production** (`SKIP_SEED=1` / `NODE_ENV=production`) — the default admin is created deliberately, once,
  with a real password, not auto-seeded.
- Migrations are **forward-only** in prod. A bad migration is fixed with a new forward migration; we don't
  auto-`down` in production.
- The deploy is **health-gated**: api/worker only start (or traffic only cuts over) after `migrate` exits 0.

---

## 5. CI/CD pipeline (GitHub Actions)

```
push / PR ──► CI: turbo affected (typecheck · lint · test · build)         [.github/workflows/ci.yml]
                     │ green
merge to main ─► build & push images (api, worker, web) ──► deploy:staging  [ondoo-style build + deploy]
                     │ smoke tests pass on staging
git tag vX.Y.Z ─► build/tag images ──► deploy:production (manual approval)
```

- **Build:** one image per app (`deploy/Dockerfile.{api,worker,web}`), tagged with the git SHA (and a
  semver tag for prod), pushed to a container registry (GHCR/ECR/etc.). Turbo caching keeps builds fast.
- **Deploy job:** connects to the VM (SSH/Ansible), pulls the new image tags, runs the `migrate` step,
  then `docker compose up -d` to roll api/worker/web to the new images. Old images stay for rollback.
- **Staging** deploys automatically on merge to `main`; **production** requires a tag **and** a manual
  approval (GitHub Environment protection rule).

---

## 6. Provisioning with Ansible

`ansible/` provisions a bare VM to a deployable state (adopted from ondoo, elevated):

- Install Docker + Compose, create a deploy user, set up the firewall (only 80/443 public), directories,
  and log rotation.
- Render `compose.env*` from **Ansible Vault**, place `docker-compose.stack.yml`, configure the reverse
  proxy + TLS (auto-cert).
- Playbooks: `provision` (one-time host setup) and `deploy` (pull images → migrate → up). The deploy
  playbook is what CI invokes for staging/prod.

---

## 7. Promotion & rollback

- **Promotion:** the *same image* that passed on staging is what gets tagged and deployed to production —
  no rebuild between environments, so "works on staging" means the identical artifact runs in prod.
- **Rollback:** re-deploy the previous image tag (`docker compose up -d` with the prior SHA) — fast,
  because old images are retained. DB changes are handled forward-only (§4), so keep migrations additive
  and backward-compatible when a rollback of code (but not schema) is possible.

---

## 8. Elevations over ondoo (planned)

- Container **registry** + immutable SHA tags (not building on the VM).
- **Health-gated / blue-green** cutover so a bad release never takes traffic.
- **Bull Board** + metrics/log shipping for the worker and queues.
- Optional **managed Postgres/Redis** in production (instead of in-stack containers) for backups/HA;
  the app only needs the connection strings to change.
- Consider **Terraform** for the cloud VM/network/DNS, with Ansible for in-host config.

---

## 9. Environment-file templates to add (Phase 0/6)

- `deploy/compose.env.example` — production stack vars (DB, Redis, JWT, R2, Resend, domains).
- `deploy/compose.env.staging.example` — staging equivalents.
- These mirror the per-app `.env.example` files but use in-stack hostnames (`postgres`, `redis`) instead
  of `localhost`, and real secrets come from Vault, not the templates.
