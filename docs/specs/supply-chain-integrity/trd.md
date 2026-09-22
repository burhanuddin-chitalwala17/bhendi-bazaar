# TRD — supply-chain-integrity

- **Status:** Draft
- **Domain:** cross-domain
- **Phase:** 4 — Enforcement
- **Verified:** 2026-09-21
- **References:** [spec.md](spec.md), [DEPENDENCIES.md](../../DEPENDENCIES.md), [TESTING.md](../../TESTING.md), [OPERATIONS.md](../../OPERATIONS.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach

Four gates in the existing pipeline, all on free tooling, alongside a stated policy for what to do when one of them fires.

The gates are the easy half and are close to configuration. The policy is the half that determines whether this still works in six months, because every one of these tools produces findings that cannot all be fixed immediately, and a gate with no legitimate path to "accepted, for this reason, until this date" gets bypassed and then removed. The current pipeline already demonstrates the failure mode: its lint step is marked to continue on error, so it reports and passes, which is the same as not running.

Tool choice is constrained by cost rather than by preference. The conventional answer for scanning the store's own code is the platform's first-party analysis, which on a private repository requires a paid tier — so this uses the free scanner that covers the same ground instead. Everything else here has a free tier that is adequate at this size.

## Technical decisions

- D1 — **Dependency audit blocks at high and above.** The production tree only — development dependencies do not ship, and gating on them would generate exactly the noise that gets a gate deleted. Moderate findings are reported and not blocking.
- D2 — **The automatic remedy is forbidden as policy.** In this tree it resolves a moderate advisory by downgrading the database toolchain a major version. The response to a finding is to move the direct dependency that pulls it, or to pin the transitive one — the identifier package reaching the tree through both the spreadsheet library and the email provider is the current worked example, and the email provider moving forward is the fix for one of the two paths.
- D3 — **Acceptances are a file, expiring.** An accepted advisory carries a reason and a review date in the repository, so it is visible to a reader rather than only to whoever was present (spec R2, A4). An acceptance past its date fails the gate — the alternative, indefinite suppression, is how a tree accumulates permanently ignored criticals.
- D4 — **Updates arrive through the platform's own dependency bot**, grouped so that routine patches are one reviewable change rather than a stream. Free on private repositories, and it is the mechanism spec R3 describes without needing anything built.
- D5 — **Secret scanning runs on the full history of the branch, not the tip.** A credential committed and then removed in a later commit is still in the history and still compromised; scanning only the latest state would pass it. The pipeline already checks out full history for the documentation gate, so the cost is already paid.
- D6 — **Static analysis uses the free open-source scanner.** The repository is private, which settles it: the platform's first-party analysis is free only on public repositories and otherwise needs a paid tier, so the open-source scanner is the option that satisfies spec R8. It covers the classes spec R5 names. Its findings are advisory on a first pass and become blocking once the baseline is clean, because a scanner introduced as blocking against an unclean tree gets turned off within a week.
- D7 — **The lint step stops continuing on error.** It is currently the pipeline's live example of spec R6 and closing it costs nothing but a clean tree first.
- D8 — **Unused connection strings are pruned in the same PR as the secret gate**, not separately. Five of them are read by nothing; several live credentials sitting in one file is the hazard the seed guard's invariant already names, and a secret-scanning gate is the natural moment to reduce the number of secrets present.

## Packages

No runtime dependencies. All four gates are pipeline steps using tooling already available to the project or free actions. [DEPENDENCIES.md](../../DEPENDENCIES.md) records runtime packages and is unaffected; the tooling belongs in [TESTING.md](../../TESTING.md) alongside the other blocking gates.

## UI approach

None.

## Data model

None.

## API / contract changes

None.

## Test plan

The gates are themselves the tests, so what needs testing is that each one actually fails when it should — verified once, at introduction, against a deliberately bad branch rather than assumed from a green pipeline.

- A branch adding a package with a known critical advisory fails the audit gate.
- A branch containing a connection string fails the secret gate, including when the string is removed in a later commit on the same branch.
- An acceptance entry past its review date fails the gate.
- [TESTING.md](../../TESTING.md) records all four as blocking, alongside the existing type-check and test gates.

## Delivery (PRs)

Two PRs.

1. **The gates** — audit, secret scanning, static analysis in advisory mode, the acceptance file, and the lint step made blocking. No application code changes.
2. **The findings** — the direct dependencies moved forward and any transitive pins, plus D8's pruning of the unused connection strings. This is the PR that touches the lockfile, and its risk is a dependency bump rather than anything the store does.

Splitting them this way means PR 1 establishes the mechanism against a tree that is known to be failing, which is the honest order: the gate exists first and reports the real state, rather than being introduced quietly after the tree was cleaned.

## Open questions

- Q1 — Should the audit gate also run on a schedule, not only on a change? An advisory published against an unchanged dependency is invisible to a per-change gate, and the store may go weeks without a merge. Leaning yes; costs nothing.
