# ADR-0072: The changelog holds the running month, and a closed month becomes a summary

- **Date:** 2026-11-12
- **Status:** Superseded by [ADR-0078](0078-the-changelog-is-retired-and-the-commit-subject-is-the-record.md)

## Context

`docs/CHANGELOG.md` had reached 506 KB because months were moved out only by memory, into one archive file per
month. Every session that reads the changelog paid for the whole history, and a past month could only be
understood by reading all its entries.

## Decision

1. Two files. `docs/CHANGELOG.md` holds the running month's entries; `docs/CHANGELOG-HISTORY.md` holds one short
   section per closed month, newest first, saying what shipped, and the highest PR number used so far.
2. When a month closes, Claude writes its summary, then `scripts/changelog-rollover.mjs` drops its entries. The
   script refuses a month with no summary. Git keeps the full entries; no monthly archive files are kept.
3. The trigger is automatic: `scripts/hooks/session-start.sh` runs at every Claude session start and, when a
   closed month is still in the changelog, tells Claude to do the rollover as one unit.

## Consequences

- The file sessions read stays to one month; the history file stays a few lines per month.
- An old entry cited from code (`See CHANGELOG PR-20`) is found with `git log -S`, not by opening a file.
- PR numbers stay unique: `docs:check` compares the running month against the recorded highest number.
- If no session runs for a while, the next one catches up every closed month at once.
