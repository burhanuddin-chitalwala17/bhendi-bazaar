#!/usr/bin/env bash
# Nightly database backup (docs/GTM-READINESS.md B3; runbook in docs/OPERATIONS.md "Backups").
# Dumps over the direct connection, encrypts to an age public key (the private key never touches
# CI), records exact row counts for the restore drill, and uploads both to our own R2 bucket.
#
# Needs: BACKUP_DATABASE_URL, BACKUP_AGE_RECIPIENT, and for the upload BACKUP_R2_ENDPOINT,
# BACKUP_R2_BUCKET, BACKUP_R2_ACCESS_KEY_ID, BACKUP_R2_SECRET_ACCESS_KEY. BACKUP_OUT_DIR keeps the
# files locally; BACKUP_UPLOAD=0 skips the upload (for a local rehearsal).
set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is not set: no backup was taken}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is not set: no backup was taken}"

stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
out="${BACKUP_OUT_DIR:-$(mktemp -d)}"
mkdir -p "$out"
dump="$out/bhendi-bazaar-$stamp.dump.age"
counts="$out/bhendi-bazaar-$stamp.counts.tsv"

# Custom format: compressed, and pg_restore can restore one table from it. Never a plain file on disk.
pg_dump --format=custom --no-owner --no-privileges "$BACKUP_DATABASE_URL" | age --encrypt -r "$BACKUP_AGE_RECIPIENT" -o "$dump"

# Exact counts at dump time, so a restore can be checked against what was actually there.
psql "$BACKUP_DATABASE_URL" -At -F $'\t' -c "
  SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name" > "$counts"

size=$(stat -c %s "$dump")
[ "$size" -gt 1024 ] || { echo "::error::The encrypted dump is only $size bytes; refusing to call that a backup."; exit 1; }
[ -s "$counts" ] || { echo "::error::No table counts were recorded."; exit 1; }
echo "Dump $(basename "$dump"): $size bytes, $(wc -l < "$counts") tables counted."

if [ "${BACKUP_UPLOAD:-1}" = "1" ]; then
  : "${BACKUP_R2_ENDPOINT:?}" "${BACKUP_R2_BUCKET:?}" "${BACKUP_R2_ACCESS_KEY_ID:?}" "${BACKUP_R2_SECRET_ACCESS_KEY:?}"
  export AWS_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
  prefix="s3://$BACKUP_R2_BUCKET/db/$(date -u +%Y/%m)"
  aws s3 cp "$dump" "$prefix/" --endpoint-url "$BACKUP_R2_ENDPOINT" --only-show-errors
  aws s3 cp "$counts" "$prefix/" --endpoint-url "$BACKUP_R2_ENDPOINT" --only-show-errors
  echo "Uploaded to $prefix/"
fi
