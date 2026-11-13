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
   allow PUT/GET/HEAD from the web origins with `AllowedHeaders: *` and
   `ExposeHeaders: ETag, Content-Length, Content-Range, Accept-Ranges`.
   Required for Uppy direct uploads (submissions, documents, company profiles, planning docs)
   and, since S2, for the library's PDF.js viewer, which fetches PDFs from presigned GET URLs
   with `Range` requests (without these headers previews fail with a CORS error).
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

## 8a. Security-relevant settings (S0, Nov 2026)

- `NODE_ENV=production` refuses to boot with default or short (<32 chars) `JWT_ACCESS_SECRET` /
  `JWT_REFRESH_SECRET`.
- Swagger (`/api/docs`) is off in production unless `SWAGGER_ENABLED=true`, which then requires
  `SWAGGER_USER` / `SWAGGER_PASSWORD` (HTTP basic auth). Staging may enable it.
- The demo outbox endpoint is gone.
- Local storage (dev only) URLs are HMAC-signed and expire; keys can't escape `LOCAL_STORAGE_DIR`.
- Company Profiles Office previews are converted in-house by the worker (LibreOffice); no URLs are
  sent to Office Online.

## 8b. Library hardening (S2, Nov 2026)

- Migration `Migration20261112170452`: `library_events` (append-only — a trigger rejects deletes
  and rewrites), `library_reports`, and licence / view-only / declaration columns on `library_items`.
- `apps/web` build copies the pdf.js worker + data files to `public/pdfjs/<version>/`
  (`scripts/copy-pdf-worker.mjs`, run by `dev` and `build`); nothing to configure.
- R2 CORS must expose range headers (§7 step 3) for the PDF viewer.
- Curators (Super Admin / Platform Admin) get in-app + email notifications for reported items.

## 8c. Library launch (S3, Nov 2026)

- **ClamAV** — `clamav` service in `docker-compose.stack.yml` (`clamav/clamav:1.4`, config
  `deploy/clamav/clamd.conf`, signatures in the `clamav_db` volume, internal only). The worker gets
  `CLAMD_HOST=clamav` and **refuses to boot in production without it**.
- **Memory gate (D26)** — clamd holds ~1–1.5 GB once signatures load (`mem_limit: 1800m`). Prod and
  staging each run one on the shared VM. Before go-live run `free -m` and `docker stats` on the VM with
  abdchub and QET up; if headroom is short, run only one clamd (point staging's `CLAMD_HOST` at prod's over
  a shared network) or move the worker. Verify `ConcurrentDatabaseReload no` took effect
  (`docker compose exec clamav grep Concurrent /etc/clamav/clamd.conf`).
- **First start** — clamd's healthcheck allows 3 minutes for freshclam's first download; the worker waits
  for it (`depends_on: service_healthy`).
- **Migrations** — `Migration20261112173707` (scan columns, Quarantined status) queues a scan for every
  existing library file; downloads of old items open as those scans finish. `Migration20261112190000` adds
  the Help article "Using the Library" (skipped if the slug exists).
- **Worker image** — adds Carlito, Caladea, Liberation 2 and DejaVu fonts for faithful Office → PDF previews.

### Staging → production rollout checklist
1. Staging bucket CORS exposes `ETag, Content-Length, Content-Range, Accept-Ranges` (§7 step 3).
2. Push `staging`; watch the pipeline; confirm the clamav container is healthy and the worker started.
3. `pnpm seed:e2e` refuses `NODE_ENV=production`, which staging runs, so the Playwright suite can't seed
   personas there. Either create matching test accounts on staging by hand (emails/passwords in
   `apps/api/src/database/e2e-personas.ts`) and run `E2E_BASE_URL=https://staging.abdcshare.com pnpm e2e`,
   or do the click-through below by hand.
4. Click through: upload (PDF, Word, a phone), report → review, view-only, the EICAR test file → quarantine.
5. Measure memory (above). Then merge to `main` and approve the production gate.

## 8d. Deploy SSH key (S4)

CI prefers a dedicated key over the password (`ansible/scripts/write_ci_inventory.py`):
1. `ssh-keygen -t ed25519 -C abdcshare-deploy -f abdcshare_deploy -N ''` (on your machine).
2. `ansible-playbook --ask-vault-pass --ask-become-pass -i inventory/production.ini playbooks/deploy_key.yml -e deploy_ssh_public_key="$(cat abdcshare_deploy.pub)"`
   — installs the key (no port/agent/X11 forwarding) and turns password logins off **for the deploy
   user only** (`/etc/ssh/sshd_config.d/60-abdcshare-deploy.conf`, `sshd -t` checked before reload).
   Keep a second session open while you run it. `-e disable_password_login=false` installs the key only.
3. GitHub secrets: `DEPLOY_SSH_KEY` (private key), `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan -p <port> <host>`
   output → strict host-key checking), keep `DEPLOY_SUDO_PASSWORD` for sudo.
4. Run a deploy. When it's green, delete `DEPLOY_SSH_PASSWORD` and rotate the deploy user's password.
   (Without the key secret CI still falls back to the password and prints a warning.)

## 8e. Backups (S4)

- `deploy/backup/backup.sh` — `pg_dump -Fc` inside the postgres container → `age` (public key only on the
  server) → R2 bucket `abdcshare-backups/<backup_name>/daily/…`; first backup of each month also goes to
  `monthly/`; keeps 30 daily + 12 monthly; writes `latest.json` + a manifest with key-table row counts.
- `deploy/backup/backup-check.sh` — hourly; fails and POSTs to `BACKUP_ALERT_URL` if the newest backup
  is older than 26 h or its file is missing. `BACKUP_HEALTHCHECK_URL` (healthchecks.io style) is pinged
  after each successful backup, so a missing ping alerts too.
- `deploy/backup/restore-drill.sh` — downloads the newest (or a named) backup, verifies its SHA-256,
  decrypts with the age **private** key (brought to the machine for the drill only), restores into an
  empty scratch database (`SCRATCH_DATABASE_URL`, or `SCRATCH_DOCKER=1` for a throwaway postgres:17
  container with matching client tools) and compares row counts with the manifest.
- Install: fill `backup_age_recipient` (age1… public key) + `vault_backup_*` in group_vars, create the
  `abdcshare-backups` bucket and an R2 token scoped to it, then
  `ansible-playbook … playbooks/backups.yml` (systemd timers: prod 02:15 UTC, staging 03:15 UTC).
- The same playbook works for abdchub and QET on the host: copy `deploy/backup/` and set their own
  `PG_DUMP_CMD` / `backup_name`.
- Run a restore drill after installing, and then quarterly.

## 8f. Monitoring (S4)

- `GET /api/health` — liveness. `GET /api/health/ops` — **503 when degraded**: outbox Pending > 10 min,
  any Failed outbox row, rows stuck in Queued > 15 min (worker died mid-job), Redis down, clamd down, or
  ClamAV signatures > 72 h old. Counts and ages only — safe to expose. Point an uptime monitor at
  `/api/health/ops`, `web /login` and `web /library`.
- `/admin/jobs` (Platform Admin, `system:jobs`): queue counts, failed queue jobs, failed/stuck outbox rows
  with an audited **Re-drive**, clamd version + signature age.

## 9. Known gaps / follow-ups

- **Log shipping**: container logs stay on the VM (`docker logs`); no central log store yet.
- **Point-in-time recovery**: backups are nightly logical dumps (S4-D1, 24 h recovery point); revisit WAL
  archiving if the firm needs a tighter recovery point.
- **Uptime monitor**: the endpoints exist (§8f); choosing and configuring the external monitor is an
  account decision for the firm.
