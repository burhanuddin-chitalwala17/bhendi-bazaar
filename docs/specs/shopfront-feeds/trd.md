# TRD — shopfront-feeds

- **Status:** Implemented
- **Domain:** cross-domain (catalog, listing, promotions, bidding)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-14
- **References:** [spec.md](spec.md), [channel-registry trd](../channel-registry/trd.md), [seo trd](../seo/trd.md), [ADR-0018](../../adr/0018-one-effective-price-function.md), [ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [ADR-0004](../../adr/0004-money-as-integer-paise.md), [ADR-0029](../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), [ADR-0045](../../adr/0045-channel-mappings-are-versioned-data.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Two GET route handlers, `/feeds/google.xml` and `/feeds/meta.xml`, each a thin call to one builder
with its channel. The builder reads the same resolved `Product` the product page renders: the
data-access layer already resolves the offer price (`server/promotions/price-context.ts`) and the
bidding hold (`server/bidding/bidding-lock.ts`) on every read, so a feed is a **second projection of
that shape**, as the seo TRD's JSON-LD is — it has no price or availability of its own to get wrong.
Listing answers the two channel questions — which shops have this channel on, and what it calls
each type — and a pure function serialises.

## Prior art
Google's product data specification accepts RSS 2.0 with the `g:` namespace, fetched on a schedule
([support.google.com/merchants/answer/7052112](https://support.google.com/merchants/answer/7052112)).
Meta's catalogue data feed accepts the same RSS/XML with `g:` fields and reads `google_product_category`
(Commerce Manager's data feed specification; the channel-category migration records the same).
Shopify's Google and Facebook channels and WooCommerce's feed plugins build from live catalogue data
rather than a stored file. We follow all three: RSS 2.0 XML, built on request, nothing persisted.

## Technical decisions
- **D1 — Built on every fetch, never cached.** The route is dynamic and answers `no-store`. The owner
  accepted that a feed lags the page between fetches (spec R2), but caching on our side would only
  add lag to that and save one read per fetch, which happens about once a day per channel.
- **D2 — Products come through one new DAL read, mapped by the existing `mapProduct`.** A catalog
  repository read spreads `AVAILABLE` and `FROM_ACTIVE_ORG` (`server/catalog/product.visibility.ts`)
  and an org filter, and returns the type, kind and brand name the feed needs beside the `Product`.
  Mapping through `mapProduct` is what makes R2 and R3 hold by construction.
- **D3 — One builder, the channel a parameter.** Everything that differs between Google and Meta is
  data or a per-channel constant in one table in the serialiser: which shops, which mapping rows,
  and the availability words. A fork per channel was rejected — the two would drift the first time
  one was fixed; a single shared feed was rejected — it cannot honour separate opt-ins (spec R5).
- **D4 — Availability is the buy button's answer.** In stock when stock is above zero and there is no
  `biddingSlug`; otherwise out of stock — written `in_stock`/`out_of_stock` for Google and
  `in stock`/`out of stock` for Meta, as each documents. Out-of-stock items stay listed, which both
  prefer to withdrawal; archived items are absent (R4).
- **D5 — Price is list price plus sale price, in integer paise formatted as `1234.50 INR`.**
  `g:sale_price` only when `hasOffer` (`src/domain/product.ts`) says an offer is in force — the rule
  the page shows offers by, so a zero sale price is never declared.
  Formatted by integer division and remainder, never `/ 100` on a float (Invariant 3).
- **D6 — Shop membership comes from listing's channel choices.** `shopfrontFeedService.orgsSellingOn`
  returns the orgs with the given channel on; an absent row is off (spec R5).
- **D7 — Category comes from the channel's own `channel-map` rows.** Meta's are a copy of Google's
  today, kept as two sets so either can move alone (ADR-0045). A row naming the product's kind wins
  over its type's kind-less row; a `notSold` row drops the product; no row at all sends it without
  `g:google_product_category`, which both channels infer. One listing read returns the whole map.
- **D8 — Products a channel would reject are left out, not sent.** No renderable image or an empty
  description excludes the product (spec hazard 3). Title is capped at 150 characters, both limits.
- **D9 — Identity.** `g:id` is the product id: stable, never reused, the same in both feeds. `g:brand`
  is the product's brand, else the shop's name — the shop is the maker for unbranded goods.
  `g:identifier_exists` is `no`; we hold no GTINs. `g:condition` is `new`.
- **D10 — Links are absolute on `appUrl()`**; a relative image ref is made absolute the same way.
- **D11 — The crawl block empties both.** With `crawlersBlocked()`, each feed is a valid empty
  channel, as `src/app/sitemap.ts` is (spec R8).
- **D12 — XML is escaped by a five-entity escaper in the serialiser,** after dropping characters
  XML 1.0 forbids, and text is cut by code point: one bad character would void every item.

## Packages
None.

## UI approach
None.

## Gates touched
- `route-reachability` — `/feeds/google.xml` and `/feeds/meta.xml` in `EXTERNALLY_CALLED`: Google
  Merchant Center's and Meta Commerce Manager's scheduled fetches.
- `product-visibility` CENSUS — the new feed read, spreading both fragments.
- `file-cohesion` — the builder reaches catalog (via the DAL) and listing; within two.

## Data model
None.

## API / contract changes
None to a DTO in CONTRACTS.md. Two new public URLs, recorded in INTEGRATIONS.md.

## Test plan
- Unit, the serialiser: paise formatting at 0, 5 and 99 paise; escaping of `&` and `<` in a name;
  sale price present only when below list; bidding-held and zero-stock read out of stock in each
  channel's words; kind row beats type row; `notSold` and imageless products absent.
- Integration, the read: archived and withdrawn-org products absent; a shop with Google on and Meta
  off present in one feed only; an offer-priced product declared at the price the product page's
  read returns for the same moment.
- A5 is verified manually: each URL added as a scheduled fetch in its console after deploy, and
  the console's feed diagnostics read for format errors.

## Delivery (PRs)
One unit, behaviour-changing: the read, the listing reads, the builder, both routes, the gate
entries, CHANGELOG, INTEGRATIONS.md. The owner then lifts `BLOCK_CRAWLERS` and registers each URL.

## Open questions
None — brand fallback to the shop's name (D9) confirmed by the owner on 2026-10-14.
