#!/usr/bin/env bash
# The blocking checks CI runs before deploy, in one command that prints a line per check and only the
# failing lines — the full output costs an agent tokens and says nothing a pass does not (ADR-0079).
# Integration tests need the disposable database, so they stay `npm run test:integration`.
set -u
cd "$(dirname "$0")/.." || exit 1

FAILED=0
check() {
  local name=$1; shift
  local out
  if out=$("$@" 2>&1); then
    echo "PASS  $name"
  else
    FAILED=1
    echo "FAIL  $name"
    printf '%s\n' "$out" | grep -E "error TS|FAIL|AssertionError|✖|×|^\s+[0-9]+:[0-9]+\s+error|^\s+[+-] |expected" | head -40 | sed 's/^/      /'
  fi
}

check "typecheck      tsc --noEmit"      npx tsc --noEmit -p .
check "unit tests     npm run test:unit" npm run --silent test:unit -- --reporter=dot
check "boundary lint  npm run lint:boundary" npm run --silent lint:boundary
exit $FAILED
