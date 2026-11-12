#!/usr/bin/env bash
# Nightly logical backup (S4, S4-D1): pg_dump -Fc → age-encrypted → rclone destination (R2 in production).
#
#   BACKUP_NAME          e.g. abdcshare-prod (folder under the destination)
#   BACKUP_DEST          rclone path, e.g. "r2:abdcshare-backups" or a local dir for drills/tests
#   BACKUP_AGE_RECIPIENT age public key(s) (space-separated) — the private key is kept OFF the server
#   PG_DUMP_CMD          command that writes a custom-format dump to stdout, e.g.
#                        "docker compose -f /srv/abdcshare/docker-compose.stack.yml exec -T postgres pg_dump -U abdcshare -Fc abdcshare"
#   PSQL_CMD             same idea for psql (used to record row counts), e.g. "... exec -T postgres psql -U abdcshare -d abdcshare"
#   BACKUP_KEEP_DAILY    default 30;  BACKUP_KEEP_MONTHLY default 12
#   BACKUP_HEALTHCHECK_URL optional — pinged on success (healthchecks.io style; /fail on error)
#
# rclone R2 remote via env (no config file): RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare
# RCLONE_CONFIG_R2_ACCESS_KEY_ID=… RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=… RCLONE_CONFIG_R2_ENDPOINT=https://<acct>.r2.cloudflarestorage.com
set -euo pipefail
export RCLONE_CONFIG="${RCLONE_CONFIG:-/dev/null}"  # remotes come from RCLONE_CONFIG_<NAME>_* env vars

: "${BACKUP_NAME:?}" "${BACKUP_DEST:?}" "${BACKUP_AGE_RECIPIENT:?}" "${PG_DUMP_CMD:?}" "${PSQL_CMD:?}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-30}"
KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-12}"
# Tables whose row counts are recorded in the manifest and checked by restore-drill.sh.
KEY_TABLES="${BACKUP_KEY_TABLES:-users clients engagements requests documents document_files client_submissions library_items library_collections library_events notifications activity_log}"

ping_hc() { [ -n "${BACKUP_HEALTHCHECK_URL:-}" ] && curl -fsS -m 10 --retry 3 "${BACKUP_HEALTHCHECK_URL}$1" >/dev/null || true; }
trap 'ping_hc /fail' ERR

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="${BACKUP_NAME}-${stamp}.dump.age"

# Row counts just before the dump (writes in between can shift them slightly; the drill allows for that).
counts="{"
for t in $KEY_TABLES; do
  n="$($PSQL_CMD -Atc "select count(*) from \"$t\"" 2>/dev/null || echo null)"
  counts+="\"$t\":${n:-null},"
done
counts="${counts%,}}"

recipients=()
for r in $BACKUP_AGE_RECIPIENT; do recipients+=(-r "$r"); done
$PG_DUMP_CMD | age "${recipients[@]}" -o "$work/$file"
bytes="$(stat -c %s "$work/$file")"
[ "$bytes" -gt 100 ] || { echo "backup: dump is suspiciously small ($bytes bytes)" >&2; exit 1; }
sha="$(sha256sum "$work/$file" | cut -d' ' -f1)"

dest="${BACKUP_DEST%/}/${BACKUP_NAME}"
rclone copyto "$work/$file" "$dest/daily/$file"
# First backup of the month is also kept as the monthly copy.
month="$(date -u +%Y%m)"
if ! rclone lsf "$dest/monthly/" 2>/dev/null | grep -q -- "-${month}"; then
  rclone copyto "$work/$file" "$dest/monthly/$file"
fi

printf '{"name":"%s","file":"daily/%s","createdAt":"%s","bytes":%s,"sha256":"%s","counts":%s}\n' \
  "$BACKUP_NAME" "$file" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$bytes" "$sha" "$counts" > "$work/latest.json"
rclone copyto "$work/latest.json" "$dest/latest.json"
rclone copyto "$work/latest.json" "$dest/manifests/${file%.dump.age}.json"

# Retention: newest N daily and M monthly (names sort by timestamp).
prune() {
  local dir="$1" keep="$2"
  rclone lsf "$dest/$dir/" 2>/dev/null | grep -- '\.dump\.age$' | sort -r | tail -n +"$((keep + 1))" | while read -r old; do
    rclone deletefile "$dest/$dir/$old"
    # Keep the manifest while the other folder still holds the same backup (monthly copies).
    other=daily; [ "$dir" = daily ] && other=monthly
    if [ -z "$(rclone lsf "$dest/$other/$old" 2>/dev/null)" ]; then
      rclone deletefile "$dest/manifests/${old%.dump.age}.json" 2>/dev/null || true
    fi
  done
}
prune daily "$KEEP_DAILY"
prune monthly "$KEEP_MONTHLY"

echo "backup: $dest/daily/$file ($bytes bytes)"
ping_hc ""
