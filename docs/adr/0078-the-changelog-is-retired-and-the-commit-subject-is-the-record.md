# ADR-0078: The changelog is retired, and the commit subject is the record

- **Date:** 2026-11-24
- **Status:** Accepted. Supersedes [ADR-0072](0072-the-changelog-holds-the-running-month-and-a-closed-month-becomes-a-summary.md); amends [ADR-0001](0001-monorepo-doc-structure.md) D1 (history lives in git) and [ADR-0056](0056-a-gate-against-existing-debt-is-a-ratchet.md) D4 (where a mutation is recorded)

## Context

`docs/CHANGELOG.md` held 182 entries and 288 KB for November alone, about one per commit. Each entry restated
what its commit and its spec already said, the why already lives in ADRs and `decisions.md`, and deploys run
their own migrations ([ADR-0014](0014-deploys-run-their-own-migrations.md)), so `[MIGRATION]` drove nothing.
The project has one developer and no outside reader; the only reader was Claude, which paid for the file on
every unit. ADR-0072's monthly rollover shrank the file but kept the cost of writing it.

## Decision

1. There is no hand-written changelog. What changed is `git log`; why is the ADRs and `decisions.md`; what a
   feature was meant to do is its spec.
2. The commit subject carries what an entry carried: `<area>: <what changed>`, with `[CONTRACT]` when a DTO
   or schema changed (and `docs/CONTRACTS.md` moved in the same commit) and `[MIGRATION]` when
   `prisma/migrations/` gained a folder. The body names the suites that ran and, for a new guard, the
   mutation that turned it red.
3. What was written is kept frozen in `docs/archive/CHANGELOG-HISTORY.md`. The rollover script, its test, the
   session-start hook and the Stop hook's "changelog moved" check are removed.

## Consequences

- No unit reads or writes a 100k-token file; a closed month needs no summary.
- History is `git log --oneline` — as readable as the commit subjects are, so subjects are written for a reader.
- PR numbers are no longer allocated; a commit is cited by its hash, an old entry by `git log -S`.

## Alternatives

- **Shorter entries** (one or two lines each). Rejected: still a second copy of the commit subject, and still
  a step every unit must remember.
- **Generate the changelog from commits.** Rejected for now: a file nobody reads, regenerated. `git log` is it.
