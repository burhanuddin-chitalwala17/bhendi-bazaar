# ADR-0081: The mechanical steps of the cycle are scripts

- **Date:** 2026-11-24
- **Status:** Accepted (D2 amended by [ADR-0084](0084-main-holds-only-finished-work-planning-lives-on-its-feature-branch.md): Implemented deletes every file but spec.md and decisions.md, after checking their Q ids)

## Context

Several steps of the cycle have exactly one right outcome, yet were done by Claude reading instructions and typing:
scaffolding a spec folder from templates held inside an 18 KB skill, flipping a status in two files, deleting a
shipped feature's TRD and pinning every link into it, breaking a guard and restoring it, updating the counts in
ARCHITECTURE.md (which went stale twice in one day), and writing commit subjects in the shape ADR-0078 relies on.
Each costs turns and context, and a hand-done step can be done slightly wrong — a mutation left in the tree is the
worst case.

## Decision

1. `npm run spec:new` scaffolds `spec.md`, `decisions.md` and `trd.md` from `scripts/templates/spec/` and regenerates
   the indexes. The templates live there, not in the skill.
2. `npm run spec:status` sets Status in the spec and TRD together. A status beginning with Implemented deletes
   `trd.md` and `ux.md` and rewrites every link into them as a pinned `<sha>:path` ref (ADR-0073); while they are
   uncommitted it refuses before writing anything.
3. `npm run mutate` requires the named tests to exist and pass unmutated, applies one mutation, runs them, always
   restores the file, and prints the line for the commit body; it exits 1 when they stay green or the run is cut short.
4. `npm run docs:index` also rewrites the counts ARCHITECTURE.md states; `tests/unit/docs-integrity.test.ts` (and so `docs:check` and the unit suite) still fails on drift.
5. A `commit-msg` hook (`.githooks/`, set by `npm install`) checks `<area>: <what changed>` and requires
   `[MIGRATION]` when a migration folder is added and `[CONTRACT]` when a wire type and its contracts doc change together.

## Alternatives

- **Keep the steps in the skills, worded more carefully.** Rejected: the cost is the reading and the turns, not
  the wording, and a careful instruction is still followed by hand.
- **One generic `bb` CLI with subcommands.** Rejected for now: separate npm scripts are what the skills and
  `package.json` already speak; a CLI is a later refactor if the list grows.
- **A lowercase-only area in commit subjects.** Rejected: the history already uses `Fix:` and `Styled shot:`; the
  check holds the shape, not the case.

## Consequences

- ✅ Each step costs one command and a few lines of output; the bb-sdlc skill drops about 4 KB.
- ✅ A mutation can no longer be left behind, and a shipped feature's links are pinned the same way every time.
- ⚠️ The hook needs `npm install` (its `prepare` script) to be active in a clone; until then it is silent.
- ⚠️ BACKLOG.md's phase rows are prose and stay manual; `spec:status` reminds, it does not edit them.
- ⚠️ The hook sees only what is staged: rewording a migration commit with `--amend` and nothing staged is not re-checked.
