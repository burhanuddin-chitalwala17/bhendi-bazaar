#!/usr/bin/env bash
# Nightly database backup (docs/GTM-READINESS.md B3; runbook in docs/OPERATIONS.md "Backups").
# Dumps and counts every table from ONE snapshot, so the counts describe exactly what the dump holds
# however busy the database is; encrypts both to an age public key (the private key never touches
# CI); uploads them to our own R2 bucket.
#
# Needs: BACKUP_DATABASE_URL (direct, not pooled: the snapshot lives in one session), BACKUP_AGE_RECIPIENT,
# and for the upload BACKUP_R2_ENDPOINT, BACKUP_R2_BUCKET, BACKUP_R2_ACCESS_KEY_ID,
# BACKUP_R2_SECRET_ACCESS_KEY. BACKUP_OUT_DIR keeps the files; BACKUP_UPLOAD=0 skips the upload.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=pg-env.sh
. "$here/pg-env.sh"

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is not set: no backup was taken}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is not set: no backup was taken}"
pg_env_from_url "$BACKUP_DATABASE_URL"

stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
if [ -n "${BACKUP_OUT_DIR:-}" ]; then out="$BACKUP_OUT_DIR"; mkdir -p "$out"; else out=$(mktemp -d); trap 'rm -rf "$out"' EXIT; fi
dump="$out/bhendi-bazaar-$stamp.dump.age"
counts="$out/bhendi-bazaar-$stamp.counts.tsv.age"

# One read-only repeatable-read transaction holds the snapshot; pg_dump attaches to it, and the counts
# are read inside it. Without this, a write between the two made the drill fail for nothing.
coproc SNAP { psql -X -q -At -F $'\t' -v ON_ERROR_STOP=1 2>&1; }
echo "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();" >&"${SNAP[1]}"
read -r snapshot <&"${SNAP[0]}"
[[ "$snapshot" =~ ^[0-9A-F-]+$ ]] || { echo "::error::Could not open a snapshot: $snapshot"; exit 1; }

# Written as .partial and renamed only on success, so a failed run never leaves a file that looks whole.
pg_dump --snapshot="$snapshot" --format=custom --no-owner --no-privileges |
  age --encrypt -r "$BACKUP_AGE_RECIPIENT" -o "$dump.partial"

printf '%s\n\\echo __END__\n' "$COUNT_TABLES_SQL;" >&"${SNAP[1]}"
plain_counts=""
while IFS= read -r line <&"${SNAP[0]}"; do
  [ "$line" = "__END__" ] && break
  plain_counts+="$line"$'\n'
done
echo "COMMIT;" >&"${SNAP[1]}"; exec {SNAP[1]}>&-; wait "$SNAP_PID" || true

printf '%s' "$plain_counts" | grep -qP '^\S+\t\d+$' || { echo "::error::No table counts were recorded."; exit 1; }
# Encrypted too: row counts say how many orders and users there are.
printf '%s' "$plain_counts" | age --encrypt -r "$BACKUP_AGE_RECIPIENT" -o "$counts.partial"

size=$(stat -c %s "$dump.partial")
[ "$size" -gt 1024 ] || { echo "::error::The encrypted dump is only $size bytes; refusing to call that a backup."; exit 1; }
mv "$dump.partial" "$dump"; mv "$counts.partial" "$counts"
echo "Dump $(basename "$dump"): $size bytes, $(printf '%s' "$plain_counts" | wc -l) tables counted from its snapshot."

if [ "${BACKUP_UPLOAD:-1}" = "1" ]; then
  : "${BACKUP_R2_ENDPOINT:?}" "${BACKUP_R2_BUCKET:?}" "${BACKUP_R2_ACCESS_KEY_ID:?}" "${BACKUP_R2_SECRET_ACCESS_KEY:?}"
  export AWS_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
  # aws CLI 2.23+ sends checksums R2 rejects; ask for them only where required.
  export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
  prefix="s3://$BACKUP_R2_BUCKET/db/$(date -u +%Y/%m)"
  aws s3 cp "$dump" "$prefix/" --endpoint-url "$BACKUP_R2_ENDPOINT" --only-show-errors
  aws s3 cp "$counts" "$prefix/" --endpoint-url "$BACKUP_R2_ENDPOINT" --only-show-errors
  echo "Uploaded to $prefix/"
fi
