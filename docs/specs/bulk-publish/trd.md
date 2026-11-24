# TRD — bulk-publish

- **Status:** Accepted
- **Domain:** channels, with listing (readiness)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the shipped publish and create flows (`server/channels/listing-publish.service.ts`, `server/channels/listing-create.service.ts`), readiness-fix, [whatsapp-catalogue TRD](../social-selling/whatsapp-catalogue/trd.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
An orchestration page with no second way to fix or send (Q3): counts from readiness and listings,
fix groups opening readiness-fix's pages, page suggestions from the existing create search, a
grouped review, and a `BulkRun` that sends the ticked products through the existing publish and
create services in the background.

## Prior art
- **Our own marketplace-publish** (review at a version, claim, send, look) and readiness-fix's
  grouped fixes: reused as they are.
- **Bulk operations as a run with per-item rows** (Shopify bulk editor, Amazon's flat-file
  processing report): followed (D3).

## Technical decisions
- **D1 — Counts and groups (R1, R2).** One read model per channel joining the shop's products with
  readiness answers and `PlatformListing` state: there, ready, needs a fix (grouped by readiness's
  fix key), left out by the shop. Group links carry the product ids to readiness-fix's page.
- **D2 — Pages (R3, Q2).** For Amazon, suggestions from listing-create's page search by barcode, run
  as a job for many products with progress; Accept all records the choice per product; families as
  families.
- **D3 — Review and send (R4–R6, Q1).** `BulkRun(id, orgId, channel, state, reviewedVersion,
  counts)` and `BulkRunItem(runId, productId, ticked, action CREATE|UPDATE, listingVersion,
  outcome)`. Send claims the run and enqueues per-item publishes through the existing services with
  the version reviewed; an item already sent (state on `PlatformListing`) is skipped, so a re-run
  sends only what is left (R6). Progress from item outcomes via `useChangeFeed`.
- **D4 — WhatsApp (R7).** Only D1's groups, sourced from `CatalogueItem` left-out reasons.
- **D5 — Flipkart (R8).** Step 2 replaced by the Seller Hub line; updates only.

## Packages
None.

## UI approach
ux.md's three-step page at `/org/[orgId]/channels/[channel]/publish`; steps as one page with a
stepper; groups as cards on a phone, tables from `md:`; Send in the `ActionBar`. Words in
`channel-copy.ts`.

## Gates touched
Routes run create, review, send; one repository each for `BulkRun`, `BulkRunItem`.

## Data model
[MIGRATION] `BulkRun`, `BulkRunItem`, index `(runId, outcome)`.

## API / contract changes
None.

## Test plan
- Counts on a 300-product fixture (A1); fixing a group moves it to ready (A2).
- Accept all and send 180 with progress (A3); re-run sends nothing already sent (A4).
- WhatsApp groups by reason (A5).

## Delivery
1. Read model and fix groups.
2. Suggestions, review, run (behaviour).
3. UI.

## Open questions
None.
