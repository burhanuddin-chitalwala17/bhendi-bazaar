# ADR-0056: A gate against existing debt is a ratchet

- **Date:** 2026-10-05
- **Status:** Accepted

## Context

Most of this project's rules are enforced by tests that read the source tree — around 26 of them by 2026-10-05, from `module-boundaries` to `api-clients`. Nearly every one landed on a tree that already broke the rule it enforces: thirteen cross-domain repository imports, ten client pages, nineteen direct Prisma calls, 64 raw buttons. A test that fails on day one with nineteen errors is not a gate; it is a nuisance, and the project's own history shows what happens next — lint has been `continue-on-error` in CI since the first week because it reported 37 errors nobody would fix in one sitting.

Six tests independently arrived at the same shape, and four ADRs ([0033](0033-a-domain-is-reached-through-its-public-surface.md), [0034](0034-render-on-the-server-by-default.md), [0036](0036-a-files-reasons-to-change-are-a-decision.md), [0048](0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)) call it "the usual shape here" with nowhere to point except a paragraph in [TESTING.md](../TESTING.md). A pattern that six files follow and none defines will be followed loosely by the seventh.

## Decision

1. **A new gate over existing debt allowlists what exists, with the reason each entry survives.** The entry is `path → sentence`; the sentence must be longer than a shrug (a length floor is asserted), because an allowlist without reasons is a suppression file.
2. **The allowlist only shrinks.** An entry whose violation no longer exists fails the test until it is removed. The list is the backlog, in the one place that cannot go stale.
3. **The scan proves it scanned.** Every gate asserts a floor on how many files it found; a broken glob read as a pass once (`module-boundaries`), and that is the only way to notice.
4. **A gate is mutation-tested before it is trusted.** Break the rule once in the source, watch the test go red, restore. The mutation is recorded in the CHANGELOG entry that introduces the gate — the proof, not the claim.
5. **An edit to an allowlist is a review finding, never a formality.** A grown list needs an argument in the diff; `/bb-review` lists every ratchet by name.
6. **A gate with no existing debt has no allowlist.** `api-clients` landed with none because every site had been converted first. An empty list is the goal state, not the starting one.

## Alternatives considered

- **Fail on everything, fix everything first.** Clean, and what a greenfield project would do. Rejected by evidence: it is how lint became advisory. The debt is real and the gate is worth having before the debt is gone.
- **Lint rules instead of tests.** The conventional tool for source-shape rules, and some rules now also exist as ESLint restrictions. Rejected as the primary mechanism: lint has no reasons, no shrink-only semantics, and no scan floor; a disabled rule looks exactly like a passed one.
- **Allowlist without reasons.** Shorter. Rejected: the reason is what lets the next reader tell "deliberate exception" from "nobody got to it", and the length floor is the only thing that stops a reason being `"TODO"`.

## Consequences

- ✅ A rule can be adopted the day it is written, against any amount of debt, and the debt becomes visible and countable.
- ✅ The pattern has a name and a home; a new scanning test is judged against six requirements instead of taste.
- ⚠️ Ratchets accumulate: ~16 named allowlists today. The review checklist carries the roll-call so none is forgotten.
- ⚠️ A ratchet guards the rule, not the fix. `rendering-strategy`'s allowlists went to zero in a month; `design-tokens`' shape list has not moved. Both are honest states; only the second needs a decision.
