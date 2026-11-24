# TRD — social-selling/whatsapp-catalogue

- **Status:** Accepted
- **Domain:** channels, reading catalog, promotions (effective price) and media through their public surfaces
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-24
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0077](../../../adr/0077-the-pixel-promise-belongs-to-the-backdrop-tools-and-an-ai-picture-is-labelled-and-secondary.md), the shipped photo rule (`server/channels/listing-photos-out.ts`) and stock-change job (`server/shared/jobs/stock-changed.job.ts`)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The WhatsApp catalogue is a replica computed from live products: an item builder turns a product
into the item WhatsApp should show, a content hash per item says whether WhatsApp already has it,
and a debounced sync sends only what changed, in batches of up to 5,000. A nightly full pass
repairs anything missed. The shop never edits the catalogue; it fixes products.

## Prior art
- **Diff by content hash, replicate by batch** is how feed integrations (Google Merchant,
  Meta's own catalogue batch guide) avoid resending unchanged items; we follow it with
  `items_batch` upserts and deletes keyed by retailer id, which Meta documents as idempotent.
- **Debounced change propagation**: our inventory sync enqueues per change and coalesces
  (`stock-changed.job.ts`, `enqueueLater` slots). Followed, with a 10-minute slot so a price change
  reaches WhatsApp inside the 15 minutes of Q4.

## Technical decisions
- **D1 — Item builder (Q4, Q12, Q14).** `whatsapp-catalogue/item.ts`, pure: product, effective price
  (promotions' one resolver, ADR-0018), stock answer (catalog's buy-button answer, which includes an
  auction hold), photos and family id in; the item out (retailer id = product id, title,
  description, price and sale price in paise formatted as Meta expects, availability, image and
  additional images, link to our product page with `ROUTES`, item group id). It answers `LEFT_OUT`
  with a reason when there is no real photograph (AI-made never main: the first non-AI photo is the
  image; none → left out), no description, or the product is not live.
- **D2 — Hash and state.** `CatalogueItem(connectionId, productId, retailerId, contentHash,
  state SENT|LEFT_OUT|REFUSED|PENDING, reasonCode, metaReason (300 chars), lastSentAt)`; the hash is
  SHA-256 of the canonical item. A sync sends an item only when its hash differs or it is not
  `SENT`, and deletes items for products no longer live.
- **D3 — Triggers.** A shared job spec `social.catalogue-dirty(orgId)` that catalog (product save,
  archive, photo change), promotions (offer start/end) and the stock-changed job enqueue with
  `enqueueLater(afterSeconds 0, onePerSeconds 600, slot org)`; it marks the org dirty and starts one
  sync job per window. A shop without WhatsApp connected ends the job at once (one indexed read).
- **D4 — Sync (A-D8, A-D9).** `channels.catalogue-sync` under the connection's `catalogue` lane:
  reads the shop's live products in pages of 500 with their prices and photos, builds items,
  compares hashes, and sends changed items in `CatalogueBatch` rows of at most 3,000 (under Meta's
  5,000 per call, leaving headroom as Meta's rate formula advises). The batch handle is polled
  until done; per-item errors become `REFUSED` with Meta's reason; the rest `SENT`. Photos go as a
  public JPEG rendition where WhatsApp refuses WebP (`listing-photos-out.ts` rule).
- **D5 — Nightly full pass (Q4).** `channels.catalogue-full` per connection once a day,
  self-rescheduling, spread across the night by a hash of the connection id: reads WhatsApp's items,
  deletes any we did not make or no longer list, and resends everything whose hash is unknown.
- **D6 — Create and attach (Q5).** On `channels.catalogue-begin`: use the settled catalogue or
  create one in the shop's business account, attach it to the number, switch catalogue and cart
  visibility on (WhatsApp commerce settings), then run a full sync with progress for the card's
  first-use line.
- **D7 — Card line and details (Q8).** Counts read with partial-index counts on `CatalogueItem`
  by state; "updated <time>" is the last batch's finish; Sync now enqueues a sync (rate-limited
  one per minute per shop); Fix opens bulk-publish's WhatsApp screen filtered by reason.
- **D8 — Disconnect (Q10).** Sync jobs stop; rows kept; reconnecting the same number resumes the
  same catalogue.

## Packages
None.

## UI approach
ux.md's card line and details: a server-rendered line in the WhatsApp card; details in a
`HandoffSheet` on a phone and a side panel from `lg:`, grouped by reason. Polling for the first-use
progress through `useChangeFeed`. Words in `channel-copy.ts`.

## Gates touched
Routes sync-now, details; one repository each for `CatalogueItem`, `CatalogueBatch`; the shared job
spec (catalog and promotions enqueue it, as they do stock-changed).

## Data model
[MIGRATION] `CatalogueItem` (D2) unique (connectionId, productId), partial indexes by state for
counts; `CatalogueBatch(id, connectionId, kind REPLACE|SYNC|FULL, state, itemCount, failedCount,
metaHandle, createdAt, finishedAt)`; `catalogueId` on the connection.

## API / contract changes
[CONTRACT] Shared job `social.catalogue-dirty`.

## Test plan
- Item builder: every row of the state matrix, AI-only product left out, offer price, auction hold
  as out of stock, family group id (unit, 100% branches: it decides what a buyer is charged).
- Hash: unchanged product sends nothing; a price change sends one item (integration).
- Debounce: 50 saves in a minute → one sync.
- Batch: per-item refusals recorded, the rest sent; retry resends only failures.
- Full pass removes a foreign item.
- Load: 5,000 products sync in one batch within budget (A-D17).

## Delivery
1. **independent (pure)** — Item builder and hash (pure).
2. **after U1 and connect-whatsapp U2** — Create/attach, sync and batches (behaviour).
3. **after U2** — Triggers from catalog and promotions; nightly pass.
4. **after U3** — Card line, details, Sync now (UI).

## Open questions
None.
