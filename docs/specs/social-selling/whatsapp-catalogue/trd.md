# TRD — social-selling/whatsapp-catalogue

- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (draft), [decisions.md](decisions.md), parent [decisions](../decisions.md), [connect-whatsapp trd](../connect-whatsapp/trd.md), [shopfront-feeds trd](../../shopfront-feeds/trd.md), [inventory-sync](../../marketplace-integration/inventory-sync/), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0068](../../../adr/0068-meta-is-a-connected-shopfront.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's; this says how they are built.

## Approach
On WhatsApp connect, `channels` creates a catalogue in the shop's business account and connects
it to the WhatsApp account. Items are then pushed by the **Catalog Batch API**, built from the
same item projection the Meta feed serialises (`server/listing/shopfront-feed.ts`), so price and
availability have one definition. A change job, a 10-minute sweep for clock-driven offers, and a
nightly full push keep it true. A per-shop item ledger records what Meta last accepted.

## Prior art
- **Meta offers two ways to fill a catalogue**: a scheduled data feed (hourly at best) or the
  Catalog Batch API (`/{catalog_id}/items_batch`, up to 5,000 items a call, near-real-time;
  Meta's Catalog API docs, checked 2026-11-06). Shopify's Facebook & Instagram channel and
  WooCommerce's Meta plugin both use the batch API for updates, with a full sync as repair. We
  follow them: R4's 15 minutes rules out the hourly feed.
- **Our shopfront feed** is a pull of one shared file of every opted-in shop; Meta fetches it into
  *our* catalogue. The WhatsApp catalogue lives in the *shop's* account (Q11), so a shared file
  cannot fill it. We reuse the item builder, not the file.
- **Inventory-sync** sends what is true when it runs, never a delta, and skips what was already
  sent (server/channels/CLAUDE.md). Followed: each push is the item's full current state, so a
  late older job cannot undo a newer one (spec hazard 4).

## Technical decisions
- **D1 — Catalogue made on connect** (Q5): a step added to the handler of connect-whatsapp's
  `whatsapp.connected` job (connect-whatsapp D4): `POST /{business_id}/owned_product_catalogs`, connect to the WABA, set commerce settings
  `is_catalog_visible=true`, `is_cart_enabled=false` (Q6). Ids stored on the connection
  (`catalogId`). Idempotent: an existing `catalogId` skips creation. Needs `catalog_management`
  (already in the one review, parent Q2).
- **D2 — One item builder.** Extract from `shopfront-feed.ts` a pure `metaItem(candidate)` returning
  fields (id, title, description, availability, price, sale_price, link, image_link,
  additional_image_link, brand, condition, item_group_id) used by both the XML serialiser and the
  batch body. Candidates come from the same DAL read (`src/data-access-layer/shopfront-feed.dal.ts`)
  filtered to one org, mapped by `mapProduct`, so price is ADR-0018's and availability the buy
  button's, bidding hold included (Q2, Q3).
- **D3 — `item_group_id`** is the product's family id when it has one (Q12, ADR-0043).
- **D4 — Image format.** Photos go as `marketplacePhotoUrls` with Meta's accepted formats (JPEG,
  PNG), so WebP goes as the existing `marketplaceJpeg` rendition.
- **D5 — Ledger.** `WhatsAppCatalogItem` (connectionId, productId, sentHash, sentAt, status
  `live|refused|removed`, reason ≤300). A push sends only items whose hash of D2's fields differs,
  or a `DELETE` for a ledger row whose product left the set (archived, org withdrawn).
- **D6 — Triggers.** (a) `channels.stock-changed` already fires per transaction; its handler also
  enqueues `whatsapp.catalog-push` for orgs with a WhatsApp catalogue. (b) A new
  `catalog.product-changed` job (spec in `server/shared/jobs/`) enqueued by catalog's product
  repository on save and archive, so catalog never imports channels. (c) A promotions write
  enqueues the same for affected orgs. (d) A 10-minute schedule is not allowed (floor 3600s,
  `jobs.config.ts`), so clock-driven offer edges are caught by `enqueueLater` at each offer's
  start and end time, slot per offer. (e) Nightly full push per shop.
- **D7 — Debounce.** `whatsapp.catalog-push` is enqueued with `enqueueLater(afterSeconds: 120,
  slot: orgId)`, one pending push per shop, so a bulk upload of 500 products is one batch (spec
  hazard 2). Hash-skip makes repeats cheap.
- **D8 — Results.** The batch answers a handle; the handler polls `check_batch_request_status`
  (re-enqueued after 30s, at most 10 times) and writes each item's status and Meta's reason to the
  ledger (Q9). A whole-call failure retries with back-off; `connection_lost` stops and leaves the
  connection's state to connect-whatsapp's check.
- **D9 — Disconnect** (Q10) stops pushes and keeps `catalogId` and the ledger, so the same number
  reconnecting resumes; a different number starts afresh.
- **D10 — Read for the card**: counts from the ledger plus "left out" from the builder's
  `sendable` rule, through `whatsappCatalogService.summary(orgId)`.

## Packages
None.

## UI approach
Cites [ux.md](ux.md). The WhatsApp card (connect-whatsapp's) gains a server-rendered catalogue
section; Sync now is a client leaf. The issues list is a detail panel (ADR-0040) on phone, inline
at `md:`. `whatsappCatalogApiClient.ts` + `useMutation` for Sync now; DTO
`WhatsAppCatalogSummaryDTO`. Existing primitives; no new token.

## Gates touched
- `one-repository` — `WhatsAppCatalogItem` one repository in channels.
- `file-cohesion` — the push handler reaches catalog (DAL) and listing (builder): within two.
- `product-visibility` CENSUS — the per-org feed read spreads both fragments.
- `route-reachability`, `portal-boundary`, rate-limit registry — the Sync now route.

## Data model
[MIGRATION] `ChannelConnection.catalogId` (nullable). New `WhatsAppCatalogItem` per D5, unique on
(connectionId, productId).

## API / contract changes
`POST /api/org/[orgId]/channels/whatsapp/catalog/sync`, `GET …/catalog` (summary and issues).
New DTO `WhatsAppCatalogSummaryDTO` in CONTRACTS.md — [CONTRACT].

## Test plan
- Unit: `metaItem` equals today's XML fields (feed regression); hash changes on price, offer,
  stock-to-zero, image; family → `item_group_id`.
- Integration: connect creates catalogue once (re-run skips); 500 saves → one batch; archived →
  DELETE; refused item recorded with reason; older job after newer sends nothing new; bidding-held
  item out of stock; offer start/end jobs fire. Meta stubbed (`fetch`), never live.
- Live on the owner's number (A1, A2) before review; listed in going-live.md.

## Delivery (PRs)
1. Extract `metaItem` (feed unchanged, regression test) — no behaviour change.
2. Ledger, push job, batch status, triggers and debounce (behaviour-changing).
3. Catalogue creation on connect, commerce settings.
4. Card section, Sync now, issues panel.

## Open questions
None.
