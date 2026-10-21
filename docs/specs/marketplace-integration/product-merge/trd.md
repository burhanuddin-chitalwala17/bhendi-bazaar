# TRD — product-merge

- **Status:** Accepted — by the owner, 2026-10-21
- **Domain:** channels, with commands and reads from catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-21
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), [channel-import trd](../channel-import/trd.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#connecting-a-seller-what-the-two-apis-actually-do), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [ADR-0028](../../../adr/0028-images-live-in-cloudflare-r2.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0055](../../../adr/0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's.

## Approach
The Settle page reads the listing, and any listing kept with it, live from its marketplace through
a new provider verb, and shows the owner's choices. "Add product" or "Link and save" sends one
parsed request; the channels domain runs one transaction that links every listing conditionally
and calls catalog's commands to create or update the product and set its stock, then enqueues the
photo copy in the same transaction. The worker re-reads the photos from the marketplace, stores
them in our object store through catalog, and attaches them. Leave off and Bring back are two
columns on `ChannelListing`. Suggestions are computed on the server from one shop's names.

## Prior art
- **A master SKU with each channel's own SKU mapped to it** is how Unicommerce and EasyEcom model
  channel listings; we follow it, and already store it: each `ChannelListing` keeps its SKU (Q10).
- **Fuzzy duplicate suggestions** are usually trigram similarity (Postgres `pg_trgm`, the Dice
  coefficient). We use the same measure computed in process over one shop's names, a few thousand
  at most, which needs no extension and no extra queries.
- **Importing product images from a URL** is done asynchronously with per-image failure (Shopify's
  product import does so): we follow, except the main photo, which a product needs to exist (Q29).
- **Settling many rows as one decision** is a single transaction of conditional updates, the shape
  Invariant 6 already uses for stock.

## Technical decisions
- **D1 — `listingDetail(token, sku)` on `MarketplaceProvider`.** Amazon: `getListingsItem` with
  `summaries,attributes`; title `item_name`, description `product_description` with
  `bullet_point`. Photos are every image on the product page (Q26): Catalog Items `getCatalogItem`
  for the ASIN with `images`, `MAIN` first then `PT01`–`PT08`, the largest of each. Flipkart: `listings/v3/details`, which carries title and MRP but no description or photos
  (checked 2026-10-21; Q27, Q20).
- **D2 — Read live, store nothing.** The Settle page reads detail on open; a failed read is the
  retryable state. What the browser shows is never trusted for photos: the job re-reads them (D6).
- **D3 — Suggestions.** Same item across marketplaces: equal normalised SKU on the other
  connection's unsettled rows, then trigram Dice of titles ≥ 0.4. Match picker: Dice against the
  shop's product names, top three. Pure functions beside `listing-match.ts`; the Listings page
  computes them for its page of fifty only (Q24).
- **D4 — One settle transaction.** In order: link each included listing with a conditional update
  (this org, no product, not left off); a count short of the number asked rolls everything back as
  "settled meanwhile" (a double tap, or two members). Then catalog creates the product, or updates
  only the chosen fields, and sets stock through `stockService` with the counts the page saw, so a
  sale in between refuses as "stock changed" (Invariant 6, Q28). Links made here are
  `LINK_SOURCE.OWNER` ("Linked by you", Q18). The photo job is enqueued last, in the same
  transaction (ADR-0038).
- **D5 — Catalog gains three commands, through its service:** create a product inside a caller's
  transaction (today's insert opens its own; it is split so both paths share one), update named
  fields of one product, and set counted stock (wrapping the existing compare-and-set). A SKU in use,
  archived included, is the existing conflict, now naming the product (journey 4). A new product is
  archived when no included listing is live and the switch is off (Q12).
- **D6 — Photos.** The main photo is copied before the transaction (Q29), so the product is created
  with its thumbnail; a failed copy refuses the save and nothing is written. The rest go to a job,
  `channels.copy-listing-photos`, which re-reads D1, accepts only https URLs on Amazon's image hosts,
  at most nine, each under a size cap and a timeout, and hands each to a new catalog command that
  downloads, normalises (`image-upload.ts`), stores and records the asset, deduplicated by hash,
  then attaches it in order. Progress and failures are counted on the listing row; Try again
  re-enqueues the failed ones (Q21). Matching with the marketplace's photos replaces the gallery
  only when every copy succeeded.
- **D7 — Left off.** `leftOffAt` and `leftOffById` on `ChannelListing`; the read's link-by-SKU skips
  such rows (Q9), the to-do count and Not linked exclude them, and `?left=1` lists them (Q23).
- **D8 — One listing per marketplace per product (Q22).** A partial unique index on (connection,
  product) where a product is set; the settle transaction reads it as a refusal. The read's
  link-by-SKU skips a row the index refuses rather than failing the batch.
- **D9 — Defaults are derived, not stored.** The category is that of the shop's latest product linked
  by the owner (Q19); price and quantity start on the lowest any side reports (Q8, Q11).
- **D10 — Routes, all `withOrg`, bodies parsed by `settle-listing.schema.ts`:**
  `POST …/channels/settle`, `POST …/listings/[id]/leave-off`, `POST …/listings/[id]/bring-back`,
  `POST …/listings/[id]/photos/retry`, and `GET …/channels/settle/products` for the picker. The
  body names listings, a product, choices by side, SKU by side, price in paise, category, counts by
  location and the on-sale switch; text the owner may edit is length-capped.

## Packages
None. Images use `sharp`, already a dependency.

## UI approach
Cites ux.md. Phone first. The Listings page gains the "Show left off" filter in the URL, a suggestion
line on rows (server), and the details panel's three choices (client leaf). The match picker is
`ResponsivePicker` over `GET …/settle/products`, through `channelsApiClient` and `useAsyncData`. The
Settle page is a server component reading `channelSettleDAL` (detail, suggestions, defaults); its
form is one client leaf with `useServerForm` on the settle schema and a docked button; from `md:`
each field's sides sit as columns. The product's "On marketplaces" block reads photo progress. No
new token, no new sheet.

## Gates touched
- `one-repository` — `ChannelListing` written only by its repository; product, stock and media only
  through catalog's.
- `module-boundaries`, `file-cohesion` — the settle service reaches catalog only.
- `route-reachability`, `portal-boundary` — five routes, called by `channelsApiClient`.
- `image-delivery` — copied photos are ours and go through the optimizer; no new bypass.
- `product-visibility` — any new product read is classified in its census.

## Data model [MIGRATION]
`ChannelListing` gains `leftOffAt`, `leftOffById`, photo-copy counts (total, done, failed) and their
time, and a partial unique index on (connection, product) where a product is set. Nothing on
`Product`.

## API / contract changes [CONTRACT]
`ChannelListingDTO` gains `leftOff`, the suggestion, and photo progress; new `SettleDetailDTO` for
the Settle page; the five routes and the settle schema. CONTRACTS.md moves with them.

## Test plan
- Unit: Amazon and Flipkart detail parsing; trigram suggestions (same SKU first, threshold, top
  three); default price and quantity; the photo host allowlist and size cap.
- Integration: a settle links every listing or none; two settles at once make one product; a SKU in
  use refuses with the product named; stock changed meanwhile refuses; a left-off row is never
  linked by a read; the (connection, product) index refuses a second listing; a failed main photo
  writes nothing.
- Manual (A1, A7, A8): the owner's catalogue at 360px, every ux.md state, photos checked against
  Seller Central.

## Delivery (units)
1. Leave off and Bring back: migration, repository, routes, filter, panel's "Leave off".
2. Detail reads (both providers), suggestions, and catalog's create-in-transaction split.
3. Settle as a new product: schema, transaction, main photo, Settle page.
4. Settle by matching: picker route and picker, field updates, counted stock.
5. Photo copy job, progress on the product block, Try again; the card's "to settle".

## Open questions
None. UX sign-off pending.
