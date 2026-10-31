#!/usr/bin/env bash
# Restore drill (docs/GTM-READINESS.md B3): a backup nobody has restored is a hope, not a backup.
# Decrypts a dump, restores it into a scratch database, and compares exact row counts with the
# ones recorded when it was taken. Exits non-zero on any difference.
#
#   db-restore-drill.sh <dump.age> <counts.tsv>
# Needs: BACKUP_AGE_IDENTITY (the private key, from the password manager; never a CI secret kept
# beside the public one), DRILL_DATABASE_URL (an empty scratch database, never production).
set -euo pipefail

dump="${1:?usage: db-restore-drill.sh <dump.age> <counts.tsv>}"
expected="${2:?usage: db-restore-drill.sh <dump.age> <counts.tsv>}"
: "${BACKUP_AGE_IDENTITY:?BACKUP_AGE_IDENTITY is not set}"
: "${DRILL_DATABASE_URL:?DRILL_DATABASE_URL is not set}"

case "$DRILL_DATABASE_URL" in
  *localhost*|*127.0.0.1*) ;;
  *) echo "::error::DRILL_DATABASE_URL must be a local scratch database; refusing to restore over anything else."; exit 1 ;;
esac

key=$(mktemp); trap 'rm -f "$key"' EXIT
printf '%s\n' "$BACKUP_AGE_IDENTITY" > "$key"; chmod 600 "$key"

age --decrypt -i "$key" "$dump" | pg_restore --no-owner --no-privileges --exit-on-error -d "$DRILL_DATABASE_URL"

actual=$(mktemp)
psql "$DRILL_DATABASE_URL" -At -F $'\t' -c "
  SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name" > "$actual"

if diff -u "$expected" "$actual"; then
  echo "Restore drill passed: $(wc -l < "$actual") tables, every count as recorded."
else
  echo "::error::Restored counts differ from the counts recorded at dump time (diff above)."
  exit 1
fi
