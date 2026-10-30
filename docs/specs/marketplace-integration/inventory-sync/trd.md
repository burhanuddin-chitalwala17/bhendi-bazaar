# TRD — inventory-sync

- **Status:** Implemented
- **Domain:** channels, with catalog (stock) and checkout (orders, unchanged)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-29
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md) "Detecting a sale", [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0044](../../../adr/0044-a-marketplace-orders-money-is-reported-not-computed.md), [ADR-0021](../../../adr/0021-audit-trail-never-fails-the-action.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's.

## Approach
Our stock rows stay the one figure. Every write to them already goes through catalog's stock
repository (Invariant 6); each write now also enqueues "this product's stock changed" in the same
transaction. A worker job sends the product's current count per matched location to every linked
listing. Sales on a marketplace come in through a five-minute order check that records each order once
and moves our stock through the same conditional commands. A daily read puts back any count changed
by hand on a marketplace. Locations are matched once per account. Nothing runs until the shop turns
sync on for that marketplace, after seeing what will change.

## Prior art
- **Inventory hubs** (Unicommerce, EasyEcom, Shopify's marketplace channels) keep one count, push it
  on every change, poll orders where webhooks are unavailable and run a periodic full reconciliation.
  We follow all three; we differ in pushing the current count rather than a delta, so a lost or late
  message cannot leave a marketplace wrong.
- **The transactional outbox:** the change is recorded in the business transaction and delivered
  after commit, at least once. We use ADR-0038's queue as the outbox, as product-merge's jobs do.
- **Idempotent order ingestion** keyed on the marketplace's order and line ids is how every hub makes
  a re-reported order count once. We follow it.

## Technical decisions
- **D1 — Locations are rows.** `ChannelLocation` per connection: the marketplace's id, name and
  pincode, the matched `OrgAddress` (or "not used"), first seen, gone. Read by the provider's new
  `readLocations` on connect and on Read again (Q15); Amazon without multi-location is one location,
  named by us. New ones arrive unmatched; ones not seen are marked gone; a deactivated shop location
  flags its match. Suggestions compare pincodes, then addresses.
- **D2 — A stock change is enqueued where it happens.** Each `stockRepository` write (reserve,
  release, restock, setCounted, takeOne, create and import) enqueues `channels.push-stock`
  `{ productId }` in its own transaction, through a job spec in `server/shared/jobs`, so catalog does
  not import channels. Each push runs under a lock per product and sends the count when it runs; a
  send of the counts already sent is skipped, so a burst of changes costs one call (Q22). A product
  whose count reaches 0 is enqueued at a higher priority (Q19). Archiving and restoring push too (Q6).
- **D3 — The push sends what is true now.** The handler reads the product's current counts per
  location at send time, maps them through each connection's matched locations, and calls the
  provider's new `setStock(listing, counts by marketplace location)` for every linked listing on a
  connection whose sync is on. Amazon: `patchListingsItem` `fulfillment_availability` (the default
  channel, or each supply source); Flipkart: its listing inventory update, per location. Skipped:
  FBA listings (Q5), unlinked or left-off listings (Q11), locations not matched or not used, paused
  connections. A busy marketplace throws and the queue retries; nothing is lost because the retry
  reads the count again.
- **D4 — Sales come in by a scheduled check.** `channels.check-orders` every five minutes per
  connection with sync on (parent Q30), a job that enqueues its next run only while one has sync on
  (Q23): Amazon's Orders API v0 from a stored cursor (Q21); Flipkart `shipments/filter`, waiting,
  cancelled and dispatched. A sale from before sync was on is recorded without taking stock (Q24). A quiet
  check costs a handful of operations: due connections are claimed in one statement, lines already
  recorded unchanged are skipped after one read, and the cursor is written only when it matters. Each order line becomes one `MarketplaceOrder` row, unique on (connection,
  order id, line id), amounts in paise as reported (ADR-0044). A new line takes its quantity from the
  matched location of its marketplace location (Q18) with a conditional decrement; what cannot be
  taken is recorded and the line flagged oversold, never refused and never negative (Q7). A line
  cancelled before dispatch restocks once, claimed by a conditional update on the row (Q8). The
  stock change then flows through D2.
- **D5 — The daily check** reads every linked listing's counts (Amazon listings, Flipkart listing
  details), compares with what was last sent, and where they differ sends again through D3's push
  under its lock and writes a `StockCorrection` row for the section's line (Q9). It is enqueued by
  the daily maintain pass (Q23).
- **D6 — Sync is a switch per connection** (Q4): `stockSync` off, on or paused, with its last sent
  and checked times. Turning on reads every linked listing's current counts (paced, like a listing
  read) into a preview; confirming enqueues D3 for every linked product. Pausing stops D3, D4 and D5
  for that connection; turning back on re-runs the preview.
- **D7 — A refusal is recorded, not predeclared** (Q25). Every capability answered for our app (Q12), so
  no switches are declared; a send the marketplace refuses records `stockProblem` "refused" on the
  connection and the section says "not allowed" (R10); a busy one records "busy" and the queue
  retries. The next send that goes clears it.
- **D8 — Marketplace orders are channels' own records**, read-only in the org portal's Orders page
  through `channelOrdersDAL`; nothing enters checkout's orders or the payouts ledger (ADR-0044).

## Packages
None.

## UI approach
Cites ux.md. Phone first. The stock sync section is a server component at the top of the marketplace's
Listings page with one client leaf for its action; Match locations is a `ResponsivePicker` sheet per
ADR-0040 with one select per marketplace location; the preview is a page; the product's On
marketplaces block gains its stock line; Orders gains a Marketplace orders tab. All requests go
through `channelsApiClient` and `useMutation`. No new token.

## Gates touched
- `one-repository` — `ChannelLocation`, `MarketplaceOrder` and `StockCorrection` each have one
  repository in channels; stock moves only through catalog's stock commands.
- `module-boundaries`, `file-cohesion` — the push and order services reach catalog only; the shared
  job spec keeps catalog from reaching channels.
- `route-reachability`, `portal-boundary` — sync, preview, locations and the orders tab, through `withOrg`.
- `product-visibility` — the push's product read (archived included, to send 0) is classified.

## Data model [MIGRATION]
`ChannelLocation`; `ChannelConnection` gains `stockSync`, `stockSyncChangedAt`, `stockSentAt`,
`stockCheckedAt`, `ordersCursor`; `MarketplaceOrder` (connection, order and line ids, SKU, listing,
product, location, quantity, amount in paise, status, oversold, restocked); `StockCorrection`.
Checks: quantities ≥ 0, amounts ≥ 0. Nothing is dropped.

## API / contract changes [CONTRACT]
New DTOs: the stock sync section, a location match, the preview, a marketplace order. Routes:
`PUT …/channels/[channel]/stock-sync` (on, pause, confirm), `PUT …/channels/[channel]/locations`,
`GET` pages through DALs. CONTRACTS.md moves with them.

## Test plan
- Unit: location suggestions; mapping counts to marketplace locations (matched, not used, gone,
  FBA); the order line's outcome (new, re-reported, cancelled before dispatch, oversold).
- Integration: a stock write enqueues one push in its transaction and none on rollback; a burst sends
  once; the push sends the current count; a re-reported order moves stock once; two marketplaces
  selling the last item leave 0 and one oversold line; a cancellation restocks once; paused sends
  nothing; the daily check records a correction.
- Providers: Amazon and Flipkart calls against stubbed `fetch` (never live).
- Manual: the owner's accounts at 360px after the production check; every ux.md state.

## Delivery (units)
1. Locations (D1) [MIGRATION], the provider read, Match locations, and the flags.
2. The switch and preview (D6) [MIGRATION], the push (D2, D3, D7), archived to 0.
3. The order check (D4, D8) [MIGRATION], oversold, cancellations, Marketplace orders tab.
4. The daily check (D5) and the section's correction line.
5. The product's stock line, every section state, the FBA state.

## Open questions
None. Q12 was settled by the read-only production check of 2026-10-29: every capability starts on;
Amazon is one location (supply sources refused); orders use the Orders API v0 until `searchOrders`'
response shape is confirmed (Q21).
