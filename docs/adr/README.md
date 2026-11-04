# Architecture Decision Records

One decision per file, named `NNNN-kebab-title.md`. Immutable once Accepted: to reverse a decision, write a **new** ADR and edit only the old one's `Status` line to `Superseded by ADR-NNNN`. When a later ADR changes *one* decision of an earlier one, the Status line says which: `Accepted (D3 amended by ADR-NNNN)` — the record stays, the reader knows where to look. Numbers are allocated at drafting, so dates may run out of order.

> **Origin note:** this set was written together on 2026-08-03 (see [CHANGELOG](../CHANGELOG.md) PR-01). Most record rules the codebase was not yet meeting, so they read as corrections rather than greenfield choices. Each states the force that motivated it, not an inventory of defects — a defect is fixed and forgotten; the reasoning is what has to last.

> **Numbering note:** 0006, 0008, and 0011 are absent. Those numbers were allocated during drafting, then folded into the root [`CLAUDE.md`](../../CLAUDE.md) (Invariants 4 and 7) and [TESTING.md](../TESTING.md) (the CI-gates section) because they failed the two-part test below — each held one small decision wrapped in a lot of well-established practice. Numbers are stable identifiers, so the gaps stay rather than renumbering.

## Format
```
# ADR-NNNN: Title
- **Date:** YYYY-MM-DD
- **Status:** Proposed / Accepted / Accepted (Dn amended by ADR-NNNN) / Superseded by ADR-NNNN / Deprecated
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
3. If it sets a standing convention, add a pointer line to the conventions index, [CONVENTIONS.md](../CONVENTIONS.md), which the root `CLAUDE.md` points every session at.
4. Never edit a past ADR's Context, Decision, or Alternatives.

`/bb-sdlc adr-new <title>` walks this.

## Index

<!-- generated:adr-index:start -->
| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-monorepo-doc-structure.md) | Monorepo docs split by volatility; domain docs co-located with code | Accepted | 2026-08-03 |
| [0002](0002-server-holds-pricing-authority.md) | The server is the sole authority on prices and totals | Accepted (D5 moot: no client-supplied price reaches the server, so there is nothing to compare) | 2026-08-03 |
| [0003](0003-one-repository-per-aggregate.md) | One aggregate, one repository | Accepted (D2 layout superseded by [ADR-0012](0012-modules-are-vertical-slices-by-domain.md); caller-split writes resolved by [ADR-0055](0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md)) | 2026-08-03 |
| [0004](0004-money-as-integer-paise.md) | Money is stored and computed as integer paise | Accepted | 2026-08-03 |
| [0005](0005-payment-state-server-only.md) | Payment state changes only on a verified gateway signal | Accepted | 2026-08-03 |
| [0007](0007-conditional-stock-decrement.md) | Stock moves conditionally, inside the order transaction | Accepted | 2026-08-03 |
| [0009](0009-docs-reference-code-never-copy-it.md) | Docs reference code by path; they never copy it | Accepted | 2026-08-03 |
| [0010](0010-spec-convention.md) | Spec layout — feature folders, spec/TRD split, ≤100 readable lines | Accepted | 2026-08-03 |
| [0012](0012-modules-are-vertical-slices-by-domain.md) | `server/` modules are vertical slices by domain | Accepted | 2026-08-03 |
| [0013](0013-one-error-envelope-and-useserverform.md) | Errors travel in one envelope; forms consume it through `useServerForm` | Accepted | 2026-08-05 |
| [0014](0014-deploys-run-their-own-migrations.md) | Deploys run their own migrations | Accepted | 2026-08-09 |
| [0015](0015-mobile-first-design.md) | The UI is designed mobile-first; desktop is the enhancement | Accepted | 2026-08-09 |
| [0016](0016-mobile-app-shell.md) | The phone storefront is an app shell — bottom tab bar, dense grids, page-level chrome | Accepted (D5 refined by [ADR-0040](0040-an-overlays-surface-is-chosen-by-what-it-holds.md)) | 2026-08-11 |
| [0017](0017-video-is-embedded-not-hosted.md) | Video is embedded from a third-party host, never stored in our own object storage | Superseded by [ADR-0039](0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md) | 2026-08-13 |
| [0018](0018-one-effective-price-function.md) | One effective-price function serves display and charge | Accepted | 2026-08-16 |
| [0019](0019-discount-is-one-winning-offer.md) | A discount is one winning offer, allocated to lines, with its funding recorded | Accepted | 2026-08-16 |
| [0020](0020-money-bearing-records-never-cascade.md) | Records that carry money or attribution never cascade | Accepted | 2026-08-16 |
| [0021](0021-audit-trail-never-fails-the-action.md) | The audit trail records an action; it never decides whether it happened | Accepted | 2026-08-22 |
| [0022](0022-design-decisions-go-through-tokens.md) | Every design axis goes through tokens, not just colour | Accepted | 2026-08-30 |
| [0023](0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) | Bidding status stores only what the clock cannot decide | Accepted | 2026-09-09 |
| [0024](0024-phone-is-contact-data-not-an-identity-key.md) | A phone number is contact data, not an identity key | Accepted | 2026-09-12 |
| [0025](0025-order-codes-are-random-not-sequential.md) | Order codes are random, not sequential | Accepted | 2026-09-16 |
| [0026](0026-images-are-delivered-through-the-optimizer.md) | Images are stored small and delivered through the optimizer | Accepted (D3, D4 amended by [ADR-0027](0027-zoomable-surfaces-declare-the-size-they-zoom-to.md); D5 amended by [media-library](../specs/media-library/) D2 — the confirm step reads the stored object) | 2026-09-16 |
| [0027](0027-zoomable-surfaces-declare-the-size-they-zoom-to.md) | A zoomable surface declares the size it zooms to, and the stored ceiling clears it | Accepted | 2026-09-17 |
| [0028](0028-images-live-in-cloudflare-r2.md) | Images live in Cloudflare R2, reached through one seam | Accepted (D6 historical — Blob is gone; the confirm-time check is [media-library](../specs/media-library/) D2) | 2026-09-17 |
| [0029](0029-a-product-leaves-sale-by-archiving-not-deletion.md) | A product leaves sale by archiving, not deletion | Accepted | 2026-09-16 |
| [0030](0030-org-storefronts-are-scoped-projections-on-one-domain.md) | An org storefront is a scoped projection of the marketplace, on one domain | Accepted (D8 superseded by [ADR-0064](0064-a-storefront-theme-is-a-token-set-and-a-section-composition-declared-in-code.md)) | 2026-09-15 |
| [0031](0031-one-components-home-organised-by-domain.md) | One components home, organised by domain, with controls through the primitives | Accepted (D4 hooks home refined by [ADR-0057](0057-shared-hooks-live-in-one-core-folder-and-every-other-hook-travels-with-its-component.md)) | 2026-09-19 |
| [0032](0032-records-people-authored-are-retired-not-deleted.md) | A record a person authored is retired, never deleted | Accepted | 2026-09-23 |
| [0033](0033-a-domain-is-reached-through-its-public-surface.md) | A domain is reached through its declared public surface | Accepted (D5 type-only exemption narrowed for components by [ADR-0048](0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)) | 2026-09-23 |
| [0034](0034-render-on-the-server-by-default.md) | Render on the server by default, and never mark a page `"use client"` | Accepted | 2026-09-23 |
| [0035](0035-every-response-carries-a-nonce-based-csp.md) | Every response carries a nonce-based Content-Security-Policy | Accepted | 2026-09-21 |
| [0036](0036-a-files-reasons-to-change-are-a-decision.md) | A file's reasons to change are a decision, not a drift | Accepted | 2026-09-23 |
| [0037](0037-the-host-is-a-deployment-fact-not-an-architectural-input.md) | The host is a deployment fact, not an architectural input | Accepted | 2026-09-25 |
| [0038](0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md) | Background work runs on an owned worker against a Postgres job queue | Accepted | 2026-09-25 |
| [0039](0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md) | Video is stored in our own object store and transcoded by the worker | Accepted | 2026-09-27 |
| [0040](0040-an-overlays-surface-is-chosen-by-what-it-holds.md) | An overlay's surface is chosen by what it holds, not by what was easiest to reach for | Accepted | 2026-09-27 |
| [0041](0041-a-channel-is-classed-by-where-the-sale-completes.md) | A channel is classed by where the sale completes | Accepted | 2026-09-29 |
| [0042](0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md) | The shared vocabulary is the intersection, and a channel declares its own extras | Accepted (D1 refined by [ADR-0047](0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md); D2 required-set amended by [ADR-0054](0054-a-channel-mapping-carries-a-checked-date-and-source-and-required-ness-is-data.md)) | 2026-09-29 |
| [0043](0043-a-variant-is-a-product-in-a-family.md) | A variant is a product in a family | Accepted (D2, D3 refined by [ADR-0051](0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md)) | 2026-09-29 |
| [0044](0044-a-marketplace-orders-money-is-reported-not-computed.md) | A marketplace order's money is reported, not computed | Accepted | 2026-09-29 |
| [0045](0045-channel-mappings-are-versioned-data.md) | Channel mappings are versioned data, not code | Accepted (D3 superseded by [ADR-0053](0053-readiness-advises-and-never-gates.md); D2, D5 amended by [ADR-0054](0054-a-channel-mapping-carries-a-checked-date-and-source-and-required-ness-is-data.md)) | 2026-09-29 |
| [0046](0046-a-new-model-is-checked-against-the-field-before-the-codebase.md) | A new model is checked against the field before the codebase | Accepted | 2026-09-29 |
| [0047](0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md) | A canonical fact is admitted by answerability, not by agreement | Accepted | 2026-10-01 |
| [0048](0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md) | A component renders, a hook holds state, an API client makes the call | Accepted (the CSRF premise in Alternatives corrected by [ADR-0060](0060-mutations-stay-on-route-handlers-and-a-mutating-request-must-come-from-our-origin.md)) | 2026-10-02 |
| [0049](0049-colour-is-a-primitive-palette-read-through-semantic-tokens.md) | Colour is a primitive palette, read only through semantic tokens | Accepted | 2026-10-02 |
| [0050](0050-three-form-factors-on-tailwinds-own-breakpoints.md) | Three form factors, on Tailwind's own breakpoints | Accepted | 2026-10-02 |
| [0051](0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md) | A product's facts are one JSON column, each entry carrying its origin | Accepted | 2026-10-05 |
| [0052](0052-a-product-type-is-a-row-that-selects-from-facts-declared-in-code.md) | A product type is a row that selects from facts declared in code | Accepted | 2026-10-05 |
| [0053](0053-readiness-advises-and-never-gates.md) | Readiness advises and never gates | Accepted. Supersedes [ADR-0045](0045-channel-mappings-are-versioned-data.md) decision 3. | 2026-10-05 |
| [0054](0054-a-channel-mapping-carries-a-checked-date-and-source-and-required-ness-is-data.md) | A channel mapping carries a checked date and source, and required-ness is data | Accepted. Amends [ADR-0045](0045-channel-mappings-are-versioned-data.md) decisions 2 and 5 and [ADR-0042](0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md) decision 2. | 2026-10-05 |
| [0055](0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md) | An admin surface reads through projections and writes through the aggregate's one repository | Accepted | 2026-10-05 |
| [0056](0056-a-gate-against-existing-debt-is-a-ratchet.md) | A gate against existing debt is a ratchet | Accepted | 2026-10-05 |
| [0057](0057-shared-hooks-live-in-one-core-folder-and-every-other-hook-travels-with-its-component.md) | Shared hooks live in one core folder, and every other hook travels with its component | Accepted. Amends [ADR-0031](0031-one-components-home-organised-by-domain.md) decision 4. | 2026-10-05 |
| [0058](0058-media-is-one-aggregate-a-derivative-is-lineage-not-a-use-and-usage-is-derived.md) | Media is one aggregate; a derivative is lineage, not a use; and usage is derived | Accepted | 2026-10-05 |
| [0059](0059-an-enhancement-never-changes-the-products-pixels-proven-before-encoding.md) | An enhancement never changes the product's pixels, proven before encoding | Accepted | 2026-10-05 |
| [0060](0060-mutations-stay-on-route-handlers-and-a-mutating-request-must-come-from-our-origin.md) | Mutations stay on route handlers, and a mutating request must come from our origin | Accepted. Corrects the CSRF premise in [ADR-0048](0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)'s alternatives. | 2026-10-05 |
| [0061](0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md) | A feature is cut to one outcome, its decisions are logged, and its UX is signed off before the TRD | Accepted (D2 amended by [ADR-0062](0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)) | 2026-10-18 |
| [0062](0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md) | A decision is replaced until it is implemented, and superseded after | Accepted | 2026-10-20 |
| [0063](0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md) | Every public route is classified for rate limiting in one registry | Accepted | 2026-10-29 |
| [0064](0064-a-storefront-theme-is-a-token-set-and-a-section-composition-declared-in-code.md) | A storefront theme is a token set and a section composition declared in code | Accepted | 2026-10-30 |
| [0065](0065-the-ui-is-built-in-tiers-and-every-icon-goes-through-one-seam.md) | The UI is built in tiers, and every icon goes through one seam | Proposed | 2026-11-04 |
<!-- generated:adr-index:end -->
