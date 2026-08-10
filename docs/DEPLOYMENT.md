# abdcshare — Deployment

> How abdcshare deploys. Staging **and** production live on the shared company VM
> (the same host that runs abdctraininghub and QET), following the house standard:
> GHCR images + Docker Compose stack + Ansible + GitHub Actions, host nginx for TLS.

---

## 1. Topology

Each environment is one Compose project on the VM. The host nginx is the only public
entrypoint; app ports bind to `127.0.0.1` only.

```
                     shared VM (Hostinger)
  ┌────────────────────────────────────────────────────────────────┐
  │  host nginx — TLS (Let's Encrypt), one site file per vhost      │
  │    abdcshare.com, www      → 127.0.0.1:3100  (web, prod)        │
  │    api.abdcshare.com       → 127.0.0.1:4100  (api, prod)        │
  │    staging.abdcshare.com   → 127.0.0.1:3101  (web, staging)     │
  │    staging-api.abdcshare…  → 127.0.0.1:4101  (api, staging)     │
  │                                                                 │
  │  per env (compose project abdcshare / abdcshare-staging):       │
  │    web (Next standalone)  api (Nest)  worker (Nest+LibreOffice) │
  │    postgres 17 (internal)  redis 7 (internal, AOF)              │
  │    migrate (one-shot, profile)  seed (one-shot, manual profile) │
  └────────────────────────────────────────────────────────────────┘
```

Ports already used by the other projects on this VM: `3000/8080` (abdchub prod),
`3002/8081` (abdchub staging), `3001` (QET prod), `3003` (QET staging).
abdcshare owns `3100/4100` (prod) and `3101/4101` (staging).

---

## 2. Environments

| Env | Config source | Deploy dir on VM | Trigger |
|-----|---------------|------------------|---------|
| local | per-app `.env` (gitignored) | — | `pnpm dev` |
| staging | `ansible/group_vars/abdcshare_staging` + Vault | `/var/www/abdcshare/staging` | push to `staging` branch |
| production | `ansible/group_vars/abdcshare_prod` + Vault | `/var/www/abdcshare/deploy` | push to `main` + approval on the `production` GitHub environment |

Images are tagged with the **git SHA** and pinned by the deploy — the same artifact that
passed staging is what production runs. The web image bakes no public env vars (all
config flows through the BFF at runtime), so images are fully promotable.

### Local development (unchanged)

```bash
docker compose -f deploy/docker-compose.yml up -d postgres redis
pnpm dev   # shared watch + api :4000 + worker + web :3000
```

`deploy/docker-compose.yml` (build-from-source, `full` profile) stays for local parity
testing. The production stack is `deploy/docker-compose.stack.yml` (GHCR pull only).

---

## 3. CI/CD pipeline (GitHub Actions)

```
push to staging ─► ci (typecheck·lint·build·test)
                    └─► build+push abdcshare-{api,worker,web}:<sha> (+ :staging)
                         └─► Ansible deploy -l abdcshare_staging  (SHA-pinned)

push to main ────► ci ─► build+push :<sha> (+ :latest)
                         └─► [production environment approval]
                              └─► Ansible deploy -l abdcshare_prod  (SHA-pinned)
```

- Workflows: `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy.yml`.
  Both are CI-gated (build only runs after the ci job passes), use Buildx with GitHub
  Actions layer cache, and have a `concurrency` group so deploys never interleave.
- The deploy job renders a CI inventory (`ansible/scripts/write_ci_inventory.py`),
  writes the Vault password from secrets, and runs `ansible/playbooks/deploy.yml`.
- Required GitHub secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_PASSWORD`,
  `ANSIBLE_VAULT_PASSWORD`; optional `DEPLOY_PORT`, `GHCR_PULL_TOKEN`.
- Protect the `production` environment with a required reviewer for a manual gate.

## 4. What a deploy does (Ansible)

`ansible/playbooks/includes/deploy_stack.yml`, per environment:

1. Assert `deploy_dir`, vault secrets, `registry_owner`.
2. Rsync `deploy/` to the VM (never `.env`).
3. Render `.env` from group_vars + Vault (`playbooks/templates/env.j2`, mode 0600).
4. `docker compose pull` → `up -d postgres redis` → run one-shot **migrate**
   (`node dist/database/setup.js`, `SKIP_SEED=1`) → `up -d` everything.
   If migrate fails the play aborts and the previous containers keep running.
5. **Smoke checks**: `GET 127.0.0.1:<api_port>/api/health` must return 200; web must respond.
6. **Image GC**: keep the 5 newest tags per abdcshare image (rollback window);
   other projects' images on the shared VM are never touched.

Then the `abdcshare_nginx` role (run once per host, `become: true`) renders
`/etc/nginx/sites-available/abdcshare-*.conf` for the four vhosts, bootstraps
Certbot (HTTP-01 webroot) for missing certs, and reloads nginx. Site files are
prefixed so they coexist with `abdchub-*` and `qet-*` configs.

---

## 5. Configuration & secrets

- Real values live in `ansible/group_vars/<env>/vault.yml`, encrypted with
  **ansible-vault** (committed encrypted; `*.example` files show the keys).
- Non-secret per-env values (ports, URLs, bucket names) live in
  `ansible/group_vars/<env>/main.yml`.
- Rotating a secret: edit the vault (`ansible-vault edit …`), commit, re-run the
  deploy workflow — no image rebuild.
- `deploy/compose.env.example` / `compose.env.staging.example` document the full
  variable surface for manual/emergency use on the VM.

## 6. Migrations & seeding

- Migrations are committed (`apps/api/src/migrations/*`) and compiled into the api
  image (`dist/migrations`) — never generated on the server.
- The migrate step is `dist/database/setup.js` with `SKIP_SEED=1`: ensure DB exists +
  `migrator.up()`. Forward-only in production; fix mistakes with a new forward migration.
- Seeding is **manual and one-time** (first deploy): set `SEED_ADMIN_EMAIL` /
  `SEED_ADMIN_PASSWORD` in the vault, then on the VM:

```bash
cd /var/www/abdcshare/staging   # or /var/www/abdcshare/deploy
docker compose -f docker-compose.stack.yml --profile seed run --rm seed
```

The seed is idempotent (reference data + Platform Admin with `mustChangePassword`).

---

## 7. First-deploy runbook

1. **DNS**: create A-records to the VM for `staging.abdcshare.com`,
   `staging-api.abdcshare.com`, `api.abdcshare.com`. The apex `abdcshare.com`
   currently serves the old host — move it only at cutover, and until then add
   `web` to `certbot_skip_ids` in `ansible/group_vars/all.yml` if issuance fails.
2. **Vaults**: `cp vault.yml.example vault.yml` in both group_vars dirs, fill in real
   values (Postgres password, JWT secrets ≥32 chars, R2 keys, Resend key, seed admin),
   `ansible-vault encrypt` each, commit.
3. **R2**: create `abdcshare-uploads` + `abdcshare-uploads-staging` buckets; CORS must
   allow PUT/GET/HEAD from the web origins with `ExposeHeaders: ETag`.
4. **GitHub**: set the secrets (§3), create the `production` environment with a
   required reviewer.
5. Push the `staging` branch → watch the pipeline → run the seed profile (§6) →
   smoke test login / upload / Office preview on `staging.abdcshare.com`.
6. Merge to `main`, approve the production gate, verify `api.abdcshare.com/api/health`,
   then cut apex DNS and re-run the nginx play so Certbot issues the apex cert.

## 8. Rollback

Old SHA images stay on the VM (5 per repo). Re-deploy any previous SHA:

```bash
cd ansible
ansible-playbook --ask-vault-pass --ask-become-pass -i inventory/production.ini \
  playbooks/deploy.yml -l abdcshare_prod -e image_tag=<previous-sha>
```

(or re-run the deploy workflow from the old commit). Schema is forward-only — keep
migrations additive/backward-compatible so old code can run against new schema.

## 9. Known gaps / follow-ups

- **DB backups**: no project on this VM has automated Postgres backups yet — add a
  nightly `pg_dump` to R2 (covers abdchub/QET too).
- **SSH auth**: CI deploys use password auth (house pattern); move to a dedicated
  deploy SSH key.
- **Monitoring**: worker/queue metrics (Bull Board) and log shipping are not set up.
