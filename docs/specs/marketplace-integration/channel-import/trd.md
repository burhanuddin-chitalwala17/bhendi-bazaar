# TRD — channel-import

- **Status:** Implemented
- **Domain:** channels, with a read from catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-04
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), [channel-connectors trd](../channel-connectors/trd.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#connecting-a-seller-what-the-two-apis-actually-do) (listing reads, checked 2026-10-21), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0043](../../../adr/0043-a-variant-is-a-product-in-a-family.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's.

## Approach
A worker job reads every listing of one connection and upserts one `ChannelListing` row per
marketplace SKU, linking a row to the shop's product with the same SKU. The job is enqueued in the
connect transaction and by "Read again", runs on the owned worker (ADR-0038), and records its
progress on the connection so the card and the page can show it. Each marketplace adds read verbs to
its provider in `server/channels/providers/`; the domain owns matching, linking and the rows. Pages
render rows on the server; three small routes undo, restore and re-read. Nothing is written to a
marketplace, and no product is created (Q2).

## Prior art
- **Linking existing listings by SKU before anything else** is what Shopify Marketplace Connect,
  Unicommerce and EasyEcom do: an exact SKU match links, everything else waits for the seller.
- **Full catalogues come from Amazon's listings report**, as Amazon itself recommends past its
  1,000-result search cap; integrators then enrich by SKU through the Listings API.
- **Upsert by a natural key and mark "not seen this run" as gone** is the standard idempotent sync;
  deleting what a run did not see loses links when a run is partial.

## Technical decisions
- **D1 — `ChannelListing`, one row per (connection, marketplace SKU).** It holds the id there
  (ASIN or FSN), title, image URL, status there, price in paise and quantity as reported, the
  variation parent's SKU, title and axis, the linked product, how it was linked, the owner's unlink,
  and when it was last seen. Rows survive a disconnect (Q11) and are never deleted (Q12).
- **D2 — Read state lives on `ChannelConnection`**: running, done or stopped; total and done
  counts; started, finished; an error code. The card, the page and the dashboard read it.
- **D3 — One read at a time per connection.** The job claims the read with a conditional update
  (not running, or running but silent for 5 minutes); a second job finds it claimed and exits. A
  reader reports in while it waits (report polling, page walks), and a silent read offers Read again.
- **D4 — Amazon reads through the report, then enriches by SKU.** Request
  `GET_MERCHANT_LISTINGS_ALL_DATA` for `A21TJRUUN4KGV`, poll until done, download (gzip when
  flagged), parse the tab-separated rows for SKU, ASIN, title, price, quantity and status. Then
  `searchListingsItems` by `identifiers` (20 SKUs a call, `includedData=summaries,relationships`)
  adds the image and the variation parent and axis. Requests pace to 5 per second; a 429 or 5xx
  backs off through `providers/listing-read.ts`'s `retryBusy`, never a refused credential (built:
  `server/shared/retry.ts` retries every error). One path for any catalogue size.
- **D5 — Flipkart reads in three passes.** `product/search` first, which names the `sellerId`
  (Q10); answered 404 for our app, it is skipped and the read goes on (Q20). Then `listings/v3/search` (500 a page) for every SKU and FSN; then `listings/v3/details` (10
  a call) for title, price, status and stock, summing stock over locations; images from the
  `product/search` pages when it answers. A 4xx other than auth or 429 stops the read as
  `not_allowed`, not retried. Flipkart does not document price units; they are read as rupees and turned
  into paise, and the owner's catalogue confirms it at A8.
- **D6 — Flipkart's account check happens before any row is written,** when product search names
  the account; without it (Q20) no check is made. The `sellerId` becomes the
  connection's external account id; the partial unique index (connectors D9) refuses a second
  shop's, and the connection is then disconnected with reason `other_shop`, its tokens deleted and
  its channel turned off, as a disconnect does. An id differing from the stored one stops the read
  as `different_account` (ux.md row added while building). No audit row: the log records a
  person's action, and no one acted.
- **D7 — Matching.** A row with no product, not unlinked by the owner, links to the shop's product
  whose SKU equals it after trimming and lower-casing, through a new catalog read
  `productService.listWithSku(orgId)`, indexed once per read; archived products included and
  flagged (Q4). An unlink is never overwritten by a read (Q5); Link back restores the SKU link.
  A product a listing links to cannot be deleted; the refusal names it and points at Archive.
- **D8 — Gone, not deleted.** Every row a run sees gets that run's start time; when a run finishes,
  rows of that connection last seen earlier are marked gone. A stopped run marks nothing gone.
- **D9 — Retries are free.** Upserts are keyed on (connection, SKU), so a retried or resumed job
  writes the same rows; the job's own retries (5, backing off) cover a busy marketplace, and a
  `MarketplaceAuthError` stops the run as needs-reconnecting.
- **D10 — Routes.** `POST …/channels/[channel]/listings/read` (Read again),
  `POST …/listings/[id]/unlink` and `POST …/listings/[id]/link-back`, all through `withOrg`. The
  Listings page and the product's "On marketplaces" block read through a DAL; a client leaf
  follows a running read's progress and refreshes the page when it ends or every half-minute (Q21).

## Packages
None. Gzip is `node:zlib`; the report is tab-separated text.

## UI approach
Cites ux.md. Page: `channels/[channel]/listings` under the org portal, a server component reading
`channelListingsDAL` with search and paging in the URL. Composites in `src/components/channel/`:
the row and the variant group header render on the server; client leaves are Unlink and Link back
(through `channelsApiClient` and `useMutation`, with the toast's Undo), the details panel (the
detail-panel surface of ADR-0040: bottom sheet on phone, side panel at `lg:`), Read again, and the
progress refresher. The card gains its reading line from the connection's read state. The product
view page gains the read-only "On marketplaces" block. No new token.

## Gates touched
- `one-repository` — `ChannelListing` written only by its repository; catalog's new read is a read.
- `route-reachability`, `portal-boundary` — the three routes, called by `channelsApiClient`.
- `file-cohesion` — the import service reaches catalog only; the product page's DAL reaches
  channels, recorded if the page file reaches a third domain.
- `module-boundaries` — catalog's `listWithSku` and `compareFacts` are on its service.
- Allowlists, each with its reason: `overlay-surfaces` (the details panel), `image-delivery` (the
  marketplace's picture), `vocabulary` (Amazon's `seller-sku`, Flipkart's `/sellers` and `sellerId`),
  `product-visibility` (the two catalog reads see archived products on purpose).

## Data model [MIGRATION]
`ChannelListing` as D1: unique (connection, marketplace SKU), indexed by product and by the
normalised SKU; the product relation never cascades. `ChannelConnection` gains the read-state
columns of D2.

## API / contract changes [CONTRACT]
`ChannelListingDTO`, `ChannelListingsPageDTO`, `ProductMarketplaceLinkDTO`, the read state on
`ChannelCardDTO`; the three routes. CONTRACTS.md moves with them.

## Test plan
- Unit: Amazon report parsing (gzip, quoting, missing columns); enrichment of parent, axis and
  image; Flipkart's three passes stitched; rupees to paise; matching on case and spaces, archived,
  no SKU; an unlinked row never relinks.
- Integration: a read twice gives the same rows; a run that stops marks nothing gone; a finished run
  marks the unseen gone; two reads at once, one runs; a Flipkart `sellerId` already in another shop
  disconnects the newcomer; link-back restores the SKU match. Marketplace HTTP stubbed at `fetch`.
- Manual (A1, A7, A8): the owner's own Amazon and Flipkart catalogues, at 360px, walking every
  ux.md state, checking a variant group and Flipkart's price units.

## Delivery (units)
1. Schema and migration; repository; catalog's `listWithSku`; matching — no read yet.
2. Amazon read (report, enrichment) and the job, enqueued on connect and by Read again.
3. Flipkart read (three passes) and its account check.
4. Listings page, routes, details panel, card reading line.
5. Product view "On marketplaces" block.

## Open questions
None.
