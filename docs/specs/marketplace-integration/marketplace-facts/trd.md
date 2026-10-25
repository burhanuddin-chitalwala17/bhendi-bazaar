# TRD — marketplace-facts

- **Status:** Implemented
- **Domain:** channels, with listing (mappings) and catalog (products, brands, listing defaults)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-25
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), [amazon-mapping.json](amazon-mapping.json), [product-merge trd](../product-merge/trd.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0045](../../../adr/0045-channel-mappings-are-versioned-data.md), [ADR-0051](../../../adr/0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md), [ADR-0052](../../../adr/0052-a-product-type-is-a-row-that-selects-from-facts-declared-in-code.md), [ADR-0054](../../../adr/0054-a-channel-mapping-carries-a-checked-date-and-source-and-required-ness-is-data.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's.

## Approach
Each marketplace's provider gains one read that returns a linked listing's marketplace type, its
attributes flattened to plain paths and values, and its product details. A worker job stores that
read on the listing and runs one fill, the same for every marketplace: the listing domain's mapping
rows, read backwards, give our type, then each empty fact's answer, and the details go where they
already live. What cannot be decided is not stored as a question: the card derives it from the
stored read and the product, so nothing goes stale. Every write is a conditional command on its
aggregate's repository, so a fill never overwrites what the owner set meanwhile.

## Prior art
- **Reading a channel's catalogue back into a master** through the same attribute and value maps
  used for publishing is how Unicommerce and EasyEcom do "catalogue sync from channel"; we follow it
  with one set of rows read both ways (Q15).
- **Amazon's schemas** come from its Product Type Definitions API; most values are free text with
  a standard list beside them, a few are strict lists (read 2026-10-23). We map to the standard
  list and match free text by exact words, never fuzzily (Q22).
- **Derived worklists over stored questions:** a question computed from data cannot drift from it;
  the register already lists "answers with no word here" this way (channel-registry).

## Technical decisions
- **D1 — `listingAttributes(token, account, listing)` on `MarketplaceProvider`.** Returns
  `{ type, attributes: path → values[], details }`. Amazon: `getListingsItem` with
  `summaries,attributes`; values are read from `value`, nested ones become paths (`closure.type`,
  `sleeve.length_description`), and details come from `item_weight`, `item_dimensions`,
  `external_product_information` (HSN), `purchasable_offer` MRP (to paise), `country_of_origin`,
  `brand`, `manufacturer`, `packer_contact_information`, `importer_contact_information`. Flipkart:
  `listings/v3/details`, no type or attributes today, but its HSN, MRP, origin and label details
  (Q4). Nothing outside a provider knows a marketplace's shape.
- **D2 — The mapping is read through the listing domain's service** (`channelMapService`), which
  serves readiness today: a reverse index of marketplace type → our types and kinds, the attribute
  rows by marketplace type, and value rows by list. Channels reaches listing and catalog only.
- **D3 — Several marketplace types per type of ours (Q18).** `ChannelCategoryMap` is keyed by
  (channel, our type, kind, their type) with a `publishes` flag, at most one per (channel, our
  type, kind). Existing rows become the publishing ones; readiness and the register read only those.
- **D4 — Amazon's rows ship as a data migration** generated from `amazon-mapping.json` (Invariant
  7), each with its checked date and source. A value row holds one answer per value, so Amazon's
  `department` beside `target_gender` is not stored; the provider derives it when publishing.
- **D5 — One fill, a pure function** beside `listing-match.ts`. Type: the product's own when its
  category has one (Q9); otherwise the mapped type, or a type question (Q11), or park (Q6). Facts:
  only empty ones (Q2); a list answer fills on an exact match of a value row or our answer's words,
  else it is a question with our answers ranked by `nameSimilarity` (Q22); numbers parse; the
  boolean reads the strict code. Details go where they live (Q21): weight to the product, MRP to a
  new product field, HSN to the category default in the shop's listing defaults, brand fields to
  the product's brand (a "Generic" listing to the default brand), each only when empty.
- **D6 — The read is stored on the listing** (`attributes`, `attributesReadAt`); "Skip for now" is a
  list of skipped facts there. The card computes filled, to confirm and changed from the read, the
  mapping and the product, so a fixed mapping or a later edit shows at once.
- **D7 — Filling on the Settle page (Q35):** the page's stored read is planned for every type, so
  choosing a category shows its facts at once; the owner's answers travel with the settle, and the
  server re-plans from the stored read (never trusting values from the browser), checks each answer
  against the question's options, and writes them in the settle transaction through catalog's
  conditional command. The worker job `channels.fill-facts`, one listing per job, still follows
  each settle for the details and the paired listing. "Fill from {marketplace}" runs the same read in the request, so the
  card can show loading, busy and reconnect as they happen (Q32). Catalog's new `fillFromMarketplace`
  locks the product row and writes only keys still empty, each entry carrying its marketplace and
  the value read (ADR-0051), so an owner's edit made meanwhile wins and "was Crepe from Amazon" can
  be shown. Brand, defaults and weight writes are conditional the same way.
- **D8 — Answers and corrections are catalog commands:** choose an answer, choose a type's category
  (the product's category, so its type follows, Q25, Q27), reset a fact to the marketplace's answer.
- **D9 — Settle's starting category** comes from the mapped type when the shop has one category of
  it (Q9); several, the Settle page asks (Q25).
- **D10 — Park reuses Left off** with a reason, `no_type` (Q6), from the Settle page only (Q33). "Ask the admin" builds the WhatsApp
  link with `whatsappSupportUrl` and a mail link to `APP_SUPPORT_EMAIL` (Q12), with ux.md's message
  (Q13); nothing is sent by us.
- **D11 — The admin's types control (Q26):** a route on the channel register adds, removes and
  marks the publishing type, through `channelMapRepository`, refusing to remove the last
  publishing one. A mapping row checked over 90 days ago puts "Check the mapping" on the card (Q8).

## Packages
None.

## UI approach
Cites ux.md. Phone first. The product page gains the "Facts from {marketplace}" card per linked
marketplace: a server component reading `channelFactsDAL`; the questions, Skip, Reset and Fill are
one client leaf through `channelsApiClient` and `useMutation`. "Choose a fact", "Type to confirm"
and "Category to confirm" use `ResponsivePicker` (ADR-0040). The Settle page's category starts on
D9's choice. The channel register gains the types control, a client leaf beside its worklists. No
new token, no new sheet.

## Gates touched
- `one-repository` — `ChannelListing` by its repository; products, brands and defaults by catalog's;
  mapping rows by listing's.
- `module-boundaries`, `file-cohesion` — the fill reaches listing and catalog, two domains.
- `route-reachability`, `portal-boundary` — the org routes through `withOrg`, the admin route
  through `requirePlatformAdmin`, all called by their API clients.
- `product-visibility` — catalog's new reads are classified in the census.

## Data model [MIGRATION]
`ChannelCategoryMap`: key (channel, our type, kind, their type), `publishes` with one per (channel,
our type, kind). `ChannelListing`: `attributes`, `attributesReadAt`, `attributeSkips`,
`leftOffReason`. `Product`: `mrpPaise` (Invariant 3). A data migration adds Amazon's rows (D4).
Nothing is dropped.

## API / contract changes [CONTRACT]
A fact entry's origin may carry its marketplace and the value read; new `ProductMarketplaceFactsDTO`
for the card; routes to fill, answer, skip, reset and park on a listing, and the admin types route.
CONTRACTS.md moves with them.

## Test plan
- Unit: Amazon and Flipkart reads flattened (nested paths, units, MRP to paise, HSN); the fill —
  exact, synonym and ambiguous answers, numbers, the strict boolean, no mapping, empty only; type
  and category outcomes; the 90-day note.
- Integration: a fill writes only empty facts and keeps an edit made meanwhile; details land on the
  brand, defaults and product only when empty; several types per our type, one publishing, and
  readiness unchanged; the admin cannot remove the last publishing type; park and bring back.
- Manual (A1, A6): the owner's own Amazon listings at 360px, every ux.md state.

## Delivery (units)
1. Several types per type and `publishes`; Amazon's rows as a data migration; the admin types control.
2. `listingAttributes` for Amazon and Flipkart, stored on the listing.
3. The fill, catalog's conditional commands and `mrpPaise`, the job, on settle and on Fill.
4. The card and its routes: answer, skip, reset, the stale note.
5. Type and category: Settle's starting category, the type and category questions, park and ask.
6. Facts on the Settle page (Q35): planned per type when the page opens, answered or skipped there, saved with the settle.

## Open questions
None.
