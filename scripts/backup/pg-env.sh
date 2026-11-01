# Sourced: exports the PG* variables for a postgres:// URL, so the password never sits in a process's
# argv where `ps` shows it. Usage: pg_env_from_url "$URL"
pg_env_from_url() {
  eval "$(python3 -I - "$1" <<'PY'
import shlex, sys
from urllib.parse import urlsplit, parse_qs, unquote
u = urlsplit(sys.argv[1])
if u.scheme not in ("postgres", "postgresql"):
    sys.exit("not a postgres:// URL")
env = {
    "PGHOST": u.hostname or "",
    "PGPORT": str(u.port or 5432),
    "PGUSER": unquote(u.username or ""),
    "PGPASSWORD": unquote(u.password or ""),
    "PGDATABASE": unquote(u.path.lstrip("/")),
}
for key, values in parse_qs(u.query).items():
    if key == "sslmode":
        env["PGSSLMODE"] = values[-1]
for k, v in env.items():
    print(f"export {k}={shlex.quote(v)}")
PY
)"
}

# Every table outside the system schemas, as schema.table<TAB>count: pgboss's queue included.
COUNT_TABLES_SQL="SELECT table_schema || '.' || table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
  FROM information_schema.tables
  WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') AND table_schema NOT LIKE 'pg_toast%'
  ORDER BY 1"
