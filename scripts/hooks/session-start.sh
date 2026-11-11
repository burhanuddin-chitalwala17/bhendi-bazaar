#!/usr/bin/env bash
# SessionStart hook. When CHANGELOG.md still holds a closed month, tell Claude to summarise it into
# CHANGELOG-HISTORY.md and drop its entries (ADR-0072). Silent otherwise.
set -u
cd "$(dirname "$0")/../.." || exit 0

MONTHS=$(node scripts/changelog-rollover.mjs --check 2>/dev/null) && exit 0
[ -z "$MONTHS" ] && exit 0

cat <<EOF
Changelog rollover due: docs/CHANGELOG.md still holds entries from closed month(s): $MONTHS.
Before other work, in a worktree on its own branch: add a "## YYYY-MM" section per month to the top of
docs/CHANGELOG-HISTORY.md (same shape as the existing ones), written from those entries; then run
\`node scripts/changelog-rollover.mjs\` to drop them. Run \`npm run docs:check\`, then commit as one unit.
EOF
