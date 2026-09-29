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
2. Run `npm run docs:index` — the index below is generated from each file's header, and `docs:check` fails while it is stale.
3. If it sets a standing convention, add a pointer line to `CLAUDE.md`'s conventions index.
4. Never edit a past ADR's Context, Decision, or Alternatives.

`/bb-sdlc adr-new <title>` walks this.

## Index

<!-- generated:adr-index:start -->
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
| [0014](0014-deploys-run-their-own-migrations.md) | Deploys run their own migrations | Accepted | 2026-08-09 |
| [0015](0015-mobile-first-design.md) | The UI is designed mobile-first; desktop is the enhancement | Accepted | 2026-08-09 |
| [0016](0016-mobile-app-shell.md) | The phone storefront is an app shell — bottom tab bar, dense grids, page-level chrome | Accepted | 2026-08-11 |
| [0017](0017-video-is-embedded-not-hosted.md) | Video is embedded from a third-party host, never stored in our own object storage | Superseded in part by [ADR-0039](0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md) — decisions 1 and 4 (no video file in our storage; every surface embeds) no longer hold; decisions 2 and 3 stand for YouTube embeds, which remain supported | 2026-08-13 |
| [0018](0018-one-effective-price-function.md) | One effective-price function serves display and charge | Accepted | 2026-08-16 |
| [0019](0019-discount-is-one-winning-offer.md) | A discount is one winning offer, allocated to lines, with its funding recorded | Accepted | 2026-08-16 |
| [0020](0020-money-bearing-records-never-cascade.md) | Records that carry money or attribution never cascade | Accepted | 2026-08-16 |
| [0021](0021-audit-trail-never-fails-the-action.md) | The audit trail records an action; it never decides whether it happened | Accepted | 2026-08-22 |
| [0022](0022-design-decisions-go-through-tokens.md) | Every design axis goes through tokens, not just colour | Accepted | 2026-08-30 |
| [0023](0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) | Bidding status stores only what the clock cannot decide | Accepted | 2026-09-09 |
| [0024](0024-phone-is-contact-data-not-an-identity-key.md) | A phone number is contact data, not an identity key | Accepted | 2026-09-12 |
| [0025](0025-order-codes-are-random-not-sequential.md) | Order codes are random, not sequential | Accepted | 2026-09-16 |
| [0026](0026-images-are-delivered-through-the-optimizer.md) | Images are stored small and delivered through the optimizer | Accepted — decisions 3 and 4 amended by [ADR-0027](0027-zoomable-surfaces-declare-the-size-they-zoom-to.md) (stored ceiling is 2048px, and a zoomable surface deliberately overstates `sizes`) | 2026-09-16 |
| [0027](0027-zoomable-surfaces-declare-the-size-they-zoom-to.md) | A zoomable surface declares the size it zooms to, and the stored ceiling clears it | Accepted | 2026-09-17 |
| [0028](0028-images-live-in-cloudflare-r2.md) | Images live in Cloudflare R2, reached through one seam | Accepted | 2026-09-17 |
| [0029](0029-a-product-leaves-sale-by-archiving-not-deletion.md) | A product leaves sale by archiving, not deletion | Accepted | 2026-09-16 |
| [0030](0030-org-storefronts-are-scoped-projections-on-one-domain.md) | An org storefront is a scoped projection of the marketplace, on one domain | Accepted | 2026-09-15 |
| [0031](0031-one-components-home-organised-by-domain.md) | One components home, organised by domain, with controls through the primitives | Accepted | 2026-09-19 |
| [0032](0032-records-people-authored-are-retired-not-deleted.md) | 0032-records-people-authored-are-retired-not-deleted.md | Accepted | 2026-09-23 |
| [0033](0033-a-domain-is-reached-through-its-public-surface.md) | A domain is reached through its declared public surface | Accepted | 2026-09-23 |
| [0034](0034-render-on-the-server-by-default.md) | Render on the server by default, and never mark a page `"use client"` | Accepted | 2026-09-23 |
| [0035](0035-every-response-carries-a-nonce-based-csp.md) | Every response carries a nonce-based Content-Security-Policy | Accepted | 2026-09-21 |
| [0036](0036-a-files-reasons-to-change-are-a-decision.md) | A file's reasons to change are a decision, not a drift | Accepted | 2026-09-23 |
| [0037](0037-the-host-is-a-deployment-fact-not-an-architectural-input.md) | The host is a deployment fact, not an architectural input | Accepted | 2026-09-25 |
| [0038](0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md) | Background work runs on an owned worker against a Postgres job queue | Accepted | 2026-09-25 |
| [0039](0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md) | Video is stored in our own object store and transcoded by the worker | Accepted | 2026-09-27 |
| [0040](0040-an-overlays-surface-is-chosen-by-what-it-holds.md) | An overlay's surface is chosen by what it holds, not by what was easiest to reach for | Accepted | 2026-09-27 |
| [0041](0041-a-channel-is-classed-by-where-the-sale-completes.md) | A channel is classed by where the sale completes | Accepted | 2026-09-29 |
| [0042](0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md) | The shared vocabulary is the intersection, and a channel declares its own extras | Accepted | 2026-09-29 |
| [0043](0043-a-variant-is-a-product-in-a-family.md) | A variant is a product in a family | Accepted | 2026-09-29 |
| [0044](0044-a-marketplace-orders-money-is-reported-not-computed.md) | A marketplace order's money is reported, not computed | Accepted | 2026-09-29 |
| [0045](0045-channel-mappings-are-versioned-data.md) | Channel mappings are versioned data, not code | Accepted | 2026-09-29 |
| [0046](0046-a-new-model-is-checked-against-the-field-before-the-codebase.md) | A new model is checked against the field before the codebase | Accepted | 2026-09-29 |
<!-- generated:adr-index:end -->
