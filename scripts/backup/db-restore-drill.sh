#!/usr/bin/env bash
# Restore drill (docs/GTM-READINESS.md B3): a backup nobody has restored is a hope, not a backup.
# Decrypts a dump, restores it into an EMPTY local scratch database, and compares exact row counts,
# every schema, with the ones taken from the dump's own snapshot. Exits non-zero on any difference.
#
#   db-restore-drill.sh <dump.age> <counts.tsv.age>
# Needs: BACKUP_AGE_IDENTITY (the private key, from the password manager), DRILL_DATABASE_URL, and
# PostgreSQL client tools 17+ (the dump is made by pg_dump 17).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=pg-env.sh
. "$here/pg-env.sh"

dump="${1:?usage: db-restore-drill.sh <dump.age> <counts.tsv.age>}"
counts="${2:?usage: db-restore-drill.sh <dump.age> <counts.tsv.age>}"
: "${BACKUP_AGE_IDENTITY:?BACKUP_AGE_IDENTITY is not set}"
: "${DRILL_DATABASE_URL:?DRILL_DATABASE_URL is not set}"
pg_env_from_url "$DRILL_DATABASE_URL"

refuse() { echo "::error::$1 Refusing to restore."; exit 1; }
# The host as parsed, not a substring of the URL: `?application_name=localhost` is not local.
case "$PGHOST" in localhost|127.0.0.1|::1|"") ;; *) refuse "DRILL_DATABASE_URL's host is \"$PGHOST\", not this machine.";; esac
existing=$(psql -X -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')" 2>/dev/null) \
  || refuse "Could not reach the drill database."
[ "$existing" = "0" ] || refuse "The drill database already has $existing tables; give it an empty one."

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
printf '%s\n' "$BACKUP_AGE_IDENTITY" > "$tmp/key"; chmod 600 "$tmp/key"

age --decrypt -i "$tmp/key" "$counts" > "$tmp/expected"
age --decrypt -i "$tmp/key" "$dump" | pg_restore --no-owner --no-privileges --exit-on-error -d "$PGDATABASE"
psql -X -At -F $'\t' -c "$COUNT_TABLES_SQL" > "$tmp/actual"

if diff -u "$tmp/expected" "$tmp/actual"; then
  echo "Restore drill passed: $(wc -l < "$tmp/actual") tables, every count as it was in the dump's snapshot."
else
  echo "::error::Restored counts differ from the counts taken with the dump (diff above)."
  exit 1
fi
