#!/usr/bin/env bash
# Stop hook. Before the agent's turn ends: the typecheck, the tests related to what changed, and
# the one process rule a hook can see — code changed, so the CHANGELOG moved too. On failure it
# blocks the stop and hands the reason back; the harness caps consecutive blocks, so a genuinely
# stuck failure still surfaces to the person.
set -u
cd "$(dirname "$0")/../.." || exit 0

CHANGED=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null | sort -u)
CODE=$(printf '%s\n' "$CHANGED" | grep -E '^(src|server|prisma|worker)/.*\.(ts|tsx|prisma|sql)$' || true)
[ -z "$CODE" ] && exit 0

block() {
  node -e 'const r=process.argv[1];process.stdout.write(JSON.stringify({decision:"block",reason:r}))' "$1"
  exit 0
}

TSC=$(npx tsc --noEmit -p . 2>&1 | grep -v "npm warn" | head -20)
[ -n "$TSC" ] && block "tsc --noEmit fails:
$TSC"

# vitest picks the suites that import the changed modules; the full suite stays in CI.
RELATED=$(printf '%s\n' "$CODE" | grep -E '\.(ts|tsx)$' | tr '\n' ' ')
if [ -n "$RELATED" ]; then
  OUT=$(npx vitest related $RELATED --run --reporter=dot 2>&1)
  if [ $? -ne 0 ]; then
    block "tests related to the changed files fail:
$(printf '%s\n' "$OUT" | grep -E 'FAIL|AssertionError|expected|→' | head -30)"
  fi
fi

# A DTO or schema moved, so CONTRACTS.md moves with it and the entry carries [CONTRACT] (CLAUDE.md).
if printf '%s\n' "$CHANGED" | grep -qE '^(server/[a-z-]+/[^/]*\.types\.ts|src/lib/validation/schemas/.*\.ts)$'; then
  if git diff --quiet HEAD -- docs/CONTRACTS.md && ! printf '%s\n' "$CHANGED" | grep -q '^docs/CONTRACTS.md$'; then
    block "a wire type or schema changed but docs/CONTRACTS.md did not. Record the shape there and flag the CHANGELOG entry [CONTRACT] — or say in the entry why this is not a contract change."
  fi
fi

if git diff --quiet HEAD -- docs/CHANGELOG.md && ! printf '%s\n' "$CHANGED" | grep -q '^docs/CHANGELOG.md$'; then
  block "code changed but docs/CHANGELOG.md did not. Every unit gets an entry (newest first, [CONTRACT]/[MIGRATION] flags) before the turn ends — CLAUDE.md, SDLC."
fi
exit 0
