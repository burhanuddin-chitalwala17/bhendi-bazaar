# Architecture Decision Records

One decision per file, named `NNNN-kebab-title.md`. Immutable once Accepted: to reverse a decision, write a **new** ADR and edit only the old one's `Status` line to `Superseded by ADR-NNNN`.

> **Origin note:** this set was written together on 2026-08-03 (see [CHANGELOG](../CHANGELOG.md) PR-01). Most record rules the codebase was not yet meeting, so they read as corrections rather than greenfield choices. Each states the force that motivated it, not an inventory of defects — a defect is fixed and forgotten; the reasoning is what has to last.

> **Numbering note:** 0006, 0008, and 0011 are absent. Those numbers were allocated during drafting, then folded into the root [`CLAUDE.md`](../../CLAUDE.md) (Invariants 4 and 7) and [TESTING.md](../TESTING.md) (the CI-gates section) because they failed the two-part test below — each held one small decision wrapped in a lot of well-established practice. Numbers are stable identifiers, so the gaps stay rather than renumbering.

## Format
```
# ADR-NNNN: Title
- **Date:** YYYY-MM-DD
- **Status:** Proposed / Accepted / Superseded by ADR-NNNN / Deprecated
- **Context:** Why was this decision needed? What forces are at play?
- **Decision:** What was decided?
- **Alternatives considered:** What else was on the table, and why was it rejected?
- **Consequences:** What becomes easier / harder?
```

## When an ADR is warranted

An ADR costs attention, and a folder of ceremony records makes the real ones harder to find. Write one only when **both** hold:

1. **There were genuine alternatives.** If a reasonable person would have picked the same thing without thinking, there is no decision to record. *"Parse untrusted input"* is not an ADR; *"recompute prices rather than verify client-supplied ones"* is, because verify-and-reject was the plausible competitor.
2. **The choice constrains future work**, and someone could reasonably undo it in good faith. The clearest signal: **the option we rejected is the more conventional one.** A structure or rule that looks idiosyncratic will get "tidied up" by whoever meets it next, unless the reasoning is on record.

**Do not write one for** a small or well-established practice, a task, a bug fix, or a rule that follows obviously from a decision already recorded. Those belong in the code, in a spec, or as a line in the root [`CLAUDE.md`](../../CLAUDE.md).

**An ADR is not what makes a rule followed.** ADRs are not loaded into an agent session — only `CLAUDE.md` and lazily-loaded domain files are. If a decision sets a standing convention, add a one-line pointer to the *Documentation & Process Conventions* index in `CLAUDE.md`. The index line gets the rule applied; the ADR lets it survive being questioned.

## How to add one
1. Create `NNNN-<slug>.md`; the new number is the highest existing + 1.
2. Add a row to the index below.
3. If it sets a standing convention, add a pointer line to `CLAUDE.md`'s conventions index.
4. Never edit a past ADR's Context, Decision, or Alternatives.

`/bb-sdlc adr-new <title>` walks this.

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-monorepo-doc-structure.md) | Monorepo docs split by volatility; domain docs co-located with code | Accepted | 2026-08-03 |
| [0002](0002-server-holds-pricing-authority.md) | The server is the sole authority on prices and totals | Accepted | 2026-08-03 |
| [0003](0003-one-repository-per-aggregate.md) | One aggregate, one repository | Accepted | 2026-08-03 |
| [0004](0004-money-as-integer-paise.md) | Money is stored and computed as integer paise | Accepted | 2026-08-03 |
| [0005](0005-payment-state-server-only.md) | Payment state changes only on a verified gateway signal | Accepted | 2026-08-03 |
| [0007](0007-conditional-stock-decrement.md) | Stock moves conditionally, inside the order transaction | Accepted | 2026-08-03 |
| [0009](0009-docs-reference-code-never-copy-it.md) | Docs reference code by path; they never copy it | Accepted | 2026-08-03 |
| [0010](0010-spec-convention.md) | Spec layout — feature folders, spec/TRD split, ≤100 readable lines | Accepted | 2026-08-03 |
| [0012](0012-modules-are-vertical-slices-by-domain.md) | `server/` modules are vertical slices by domain | Accepted | 2026-08-03 |
| [0013](0013-one-error-envelope-and-useserverform.md) | Errors travel in one envelope; forms consume it through `useServerForm` | Accepted | 2026-08-05 |
| [0014](0014-deploys-run-their-own-migrations.md) | Deploys run their own migrations — `migrate deploy` in the Vercel build | Accepted | 2026-08-09 |
| [0015](0015-mobile-first-design.md) | The UI is designed mobile-first; desktop is the enhancement | Accepted | 2026-08-09 |
| [0016](0016-mobile-app-shell.md) | The phone storefront is an app shell — bottom tab bar, dense grids, docked chrome | Accepted | 2026-08-11 |
| [0017](0017-video-is-embedded-not-hosted.md) | Video is embedded from a third-party host, never stored in our own object storage | Accepted | 2026-08-13 |
| [0018](0018-one-effective-price-function.md) | One effective-price function serves display and charge | Accepted | 2026-08-16 |
| [0019](0019-discount-is-one-winning-offer.md) | A discount is one winning offer, allocated to lines, with its funding recorded | Accepted | 2026-08-16 |
| [0020](0020-money-bearing-records-never-cascade.md) | Records that carry money or attribution never cascade | Accepted | 2026-08-16 |
| [0021](0021-audit-trail-never-fails-the-action.md) | The audit trail records an action; it never decides whether it happened | Accepted | 2026-08-22 |
| [0022](0022-design-decisions-go-through-tokens.md) | Every design axis goes through tokens, not just colour | Accepted | 2026-08-30 |
