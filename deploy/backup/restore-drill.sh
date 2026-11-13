#!/usr/bin/env bash
# Restore drill (S4): fetch the newest (or a given) backup, decrypt it, restore it into a scratch
# database, and compare key-table row counts with the counts recorded at backup time.
#
#   BACKUP_NAME, BACKUP_DEST    as for backup.sh
#   BACKUP_AGE_IDENTITY         path to the age PRIVATE key (bring it to the machine for the drill only)
#   SCRATCH_DATABASE_URL        an EMPTY database to restore into — or leave unset and set
#   SCRATCH_DOCKER=1            to start a throwaway postgres:17-alpine container (removed afterwards)
#   BACKUP_FILE                 optional: e.g. daily/abdcshare-prod-20270115T021500Z.dump.age
#   DRILL_TOLERANCE_PCT         allowed drift between recorded and restored counts (default 1, min 5 rows)
set -euo pipefail
export RCLONE_CONFIG="${RCLONE_CONFIG:-/dev/null}"  # remotes come from RCLONE_CONFIG_<NAME>_* env vars
: "${BACKUP_NAME:?}" "${BACKUP_DEST:?}" "${BACKUP_AGE_IDENTITY:?}"
dest="${BACKUP_DEST%/}/${BACKUP_NAME}"
tol="${DRILL_TOLERANCE_PCT:-1}"
work="$(mktemp -d)"
container=""
cleanup() { rm -rf "$work"; [ -n "$container" ] && docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [ -n "${BACKUP_FILE:-}" ]; then
  manifest="$(rclone cat "$dest/manifests/$(basename "${BACKUP_FILE%.dump.age}").json")"
  file="$BACKUP_FILE"
else
  manifest="$(rclone cat "$dest/latest.json")"
  file="$(printf '%s' "$manifest" | sed -n 's/.*"file":"\([^"]*\)".*/\1/p')"
fi
echo "drill: restoring $file"
rclone copyto "$dest/$file" "$work/backup.age"
want_sha="$(printf '%s' "$manifest" | sed -n 's/.*"sha256":"\([^"]*\)".*/\1/p')"
got_sha="$(sha256sum "$work/backup.age" | cut -d' ' -f1)"
[ "$want_sha" = "$got_sha" ] || { echo "drill: checksum mismatch ($got_sha != $want_sha)" >&2; exit 1; }
age -d -i "$BACKUP_AGE_IDENTITY" -o "$work/backup.dump" "$work/backup.age"

if [ -n "${SCRATCH_DATABASE_URL:-}" ]; then
  # Host client tools — pg_restore must be at least the server version that made the dump.
  psql_q() { psql "$SCRATCH_DATABASE_URL" -Atc "$1"; }
  restore() { pg_restore --no-owner --no-acl --exit-on-error -d "$SCRATCH_DATABASE_URL" < "$1"; }
else
  [ "${SCRATCH_DOCKER:-}" = "1" ] || { echo "drill: set SCRATCH_DATABASE_URL or SCRATCH_DOCKER=1" >&2; exit 1; }
  # Same major version as production; client tools run inside the container, so versions always match.
  container="abdcshare-restore-drill-$$"
  docker run -d --name "$container" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill "${DRILL_IMAGE:-postgres:17-alpine}" >/dev/null
  for _ in $(seq 1 60); do docker exec "$container" pg_isready -U postgres -d drill >/dev/null 2>&1 && break; sleep 1; done
  psql_q() { docker exec "$container" psql -U postgres -d drill -Atc "$1"; }
  restore() { docker exec -i "$container" pg_restore -U postgres -d drill --no-owner --no-acl --exit-on-error < "$1"; }
fi

existing="$(psql_q "select count(*) from information_schema.tables where table_schema='public'")"
[ "$existing" = "0" ] || { echo "drill: scratch database is not empty ($existing tables) — refusing" >&2; exit 1; }
restore "$work/backup.dump"

fail=0
counts="$(printf '%s' "$manifest" | sed -n 's/.*"counts":{\([^}]*\)}.*/\1/p' | tr ',' '\n')"
printf '%-24s %10s %10s  %s\n' table recorded restored result
while IFS=: read -r key val; do
  t="$(printf '%s' "$key" | tr -d '"')"
  [ -n "$t" ] || continue
  if [ "$val" = "null" ]; then printf '%-24s %10s %10s  %s\n' "$t" - - skipped; continue; fi
  got="$(psql_q "select count(*) from \"$t\"")"
  diff=$(( got > val ? got - val : val - got ))
  allowed=$(( val * tol / 100 )); [ "$allowed" -ge 5 ] || allowed=5
  if [ "$diff" -le "$allowed" ]; then r=ok; else r=MISMATCH; fail=1; fi
  printf '%-24s %10s %10s  %s\n' "$t" "$val" "$got" "$r"
done <<< "$counts"
migrations="$(psql_q "select count(*) from mikro_orm_migrations" 2>/dev/null || echo 0)"
echo "drill: ${migrations} migrations recorded in the restored database"
[ "$fail" = "0" ] && echo "drill: PASSED" || { echo "drill: FAILED" >&2; exit 1; }
