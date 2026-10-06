#!/usr/bin/env bash
# PostToolUse hook (Edit|Write). Runs the gate that matches the file just written, while the
# agent still has it open — the 26 source-scanning tests used to run only if remembered.
# Exit 2 hands stderr back to the model as feedback; exit 0 is silence.
set -u
cd "$(dirname "$0")/../.." || exit 0

FILE=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.file_path??"")}catch{}})')
[ -z "$FILE" ] && exit 0
REL=${FILE#"$PWD/"}

# The tests that read source and finish in ~3s together. Behaviour suites stay on Stop/CI.
SCANNERS=(design-tokens cn-tokens module-boundaries one-repository api-clients route-reachability
  file-cohesion ui-primitives rendering-strategy form-error-display image-delivery button-rows
  overlay-surfaces form-factors portal-boundary request-body-parsing labelled-controls migration-drops)

run_vitest() {
  local files=()
  for t in "$@"; do [ -f "tests/unit/$t.test.ts" ] && files+=("tests/unit/$t.test.ts"); done
  OUT=$(npx vitest run "${files[@]}" --reporter=dot 2>&1)
  if [ $? -ne 0 ]; then
    # Only the failing assertions and offender lines: the model needs the finding, not the run.
    printf '%s\n' "$OUT" | grep -E "FAIL|AssertionError|^\s+[+-] |→|expected" | head -40 >&2
    exit 2
  fi
}

case "$REL" in
  tests/*) exit 0 ;;
  prisma/schema.prisma)
    npx prisma validate >/dev/null 2>&1 || { echo "prisma validate failed on schema.prisma" >&2; exit 2; }
    npx prisma generate >/dev/null 2>&1
    if ! git diff --quiet HEAD -- prisma/schema.prisma && [ -z "$(git status --porcelain prisma/migrations | grep '^??')" ]; then
      echo "schema.prisma changed and no new migration folder exists under prisma/migrations/ — a schema change ships with its migration (CLAUDE.md [MIGRATION])." >&2
      exit 2
    fi ;;
  src/*.ts|src/*.tsx|server/*.ts|prisma/migrations/*)
    run_vitest "${SCANNERS[@]}" ;;
  docs/*.md|*/CLAUDE.md|CLAUDE.md|.claude/skills/*)
    run_vitest docs-integrity ;;
esac
exit 0
