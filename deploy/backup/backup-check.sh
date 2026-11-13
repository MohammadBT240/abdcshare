#!/usr/bin/env bash
# Freshness check (run hourly): fails — and alerts — if the newest backup is older than the limit.
#   BACKUP_NAME, BACKUP_DEST   as for backup.sh
#   BACKUP_MAX_AGE_HOURS       default 26
#   BACKUP_ALERT_URL           optional — POSTed a JSON message when stale (Slack/Teams webhook,
#                              healthchecks.io /fail URL, …)
set -euo pipefail
export RCLONE_CONFIG="${RCLONE_CONFIG:-/dev/null}"  # remotes come from RCLONE_CONFIG_<NAME>_* env vars
: "${BACKUP_NAME:?}" "${BACKUP_DEST:?}"
max_h="${BACKUP_MAX_AGE_HOURS:-26}"
dest="${BACKUP_DEST%/}/${BACKUP_NAME}"

alert() {
  echo "backup-check: $1" >&2
  if [ -n "${BACKUP_ALERT_URL:-}" ]; then
    curl -fsS -m 10 -H 'Content-Type: application/json' \
      -d "{\"text\":\"[abdcshare] ${BACKUP_NAME}: $1\"}" "$BACKUP_ALERT_URL" >/dev/null || true
  fi
  exit 1
}

manifest="$(rclone cat "$dest/latest.json" 2>/dev/null)" || alert "no backup manifest at $dest/latest.json"
created="$(printf '%s' "$manifest" | sed -n 's/.*"createdAt":"\([^"]*\)".*/\1/p')"
[ -n "$created" ] || alert "manifest has no createdAt"
age_s=$(( $(date -u +%s) - $(date -u -d "$created" +%s) ))
age_h=$(( age_s / 3600 ))
[ "$age_s" -le $(( max_h * 3600 )) ] || alert "newest backup is ${age_h}h old (limit ${max_h}h): $created"
file="$(printf '%s' "$manifest" | sed -n 's/.*"file":"\([^"]*\)".*/\1/p')"
rclone lsf "$dest/$file" >/dev/null 2>&1 || alert "manifest points at a missing file: $file"
echo "backup-check: ok — newest backup ${age_h}h old ($file)"
