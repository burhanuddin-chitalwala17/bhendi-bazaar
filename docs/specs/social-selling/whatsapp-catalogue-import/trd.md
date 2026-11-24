# TRD — social-selling/whatsapp-catalogue-import

- **Status:** Accepted
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-24
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), the shipped listing read and settle (`server/channels/channel-import.service.ts`, `server/channels/channel-settle.service.ts`, `server/channels/listing-match.ts`)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
WhatsApp becomes one more source for the machinery Amazon and Flipkart already use: the listing
read writes mirror rows, the match suggests, the Settle screen settles, and the shop's choices are
kept until Done. What is new is the reader for Meta's catalogue and the Done push that replaces
WhatsApp's items with our products in one batch.

## Prior art
- **Our own settle flow** (channel-import, product-merge): reads keyed on (connection, SKU), a read
  never deletes, a settle links every listing or none. It is right here; followed without change.
- **Meta's catalogue items read** pages items with a cursor; the reader follows the cursor and is
  idempotent per retailer id.

## Technical decisions
- **D1 — Reader (R1, R2).** `providers/meta/catalogue-read.ts` implements the existing listing-read
  sink contract (`providers/listing-read.ts`): each item becomes a `ChannelListing` keyed on
  (connection, retailer id) with name, price in paise, image URLs and the item group id. The read
  runs as the existing `listing-read` job with the WhatsApp connection, with progress counts on the
  connection (ux "Reading · 120 of 300"). A catalogue with no items marks settle not needed (R1).
- **D2 — Matching (Q1).** `listing-match.ts` unchanged: an item whose retailer id equals one of our
  SKUs links by itself ("Same SKU on WhatsApp"); others get name and photo suggestions as today.
- **D3 — Settle (Q3–Q5).** The Listings page at `/org/[orgId]/channels/whatsapp/listings` is the
  existing page with WhatsApp as source; the three actions and their copy (`SETTLE_ACTION`,
  `LISTINGS_SETTLE`) unchanged. Leave off records the owner's choice as today. Add as new uses
  product-merge's form, asking for stock (Q4). Grouped items carry the item group id for the
  family hint line (Q3).
- **D4 — Done (R6, R7, Q2).** `POST …/whatsapp/settle/done` claims the settle (a conditional state
  change `OPEN → PUSHING` on the connection) and enqueues `channels.catalogue-replace`: one
  `CatalogueBatch` (A-D8) that deletes the left-off and unmatched-and-unsettled-by-choice items and
  upserts every linked or new product as our item (retailer id = our product id), through
  whatsapp-catalogue's item builder, so what lands is exactly what the sync will keep. Progress is
  the batch's counts; a partial failure retries the failed items only (ux "36 updated; 4 will be
  tried again").
- **D5 — Changes while settling (stale).** A re-read on returning to the page adds new items and
  marks removed ones gone (a read never deletes); the banner counts the new ones.
- **D6 — Unreadable catalogue (R9).** A read that fails with a permission or not-found code ends the
  step as `UNREADABLE`; the card offers the bulk sheet or Skip, and Skip starts the sync with our
  products only.

## Packages
None.

## UI approach
The existing Listings and Settle components, given a `source` of `whatsapp`; the Done sheet is a
new `HandoffSheet` in `src/components/channel/`. ActionBar count from the page's server read;
progress through `useChangeFeed`. Phone rows with a row menu, table from `md:`. Words in
`settle-copy.ts` and `channel-copy.ts`.

## Gates touched
Route done; `MAY_USE_SHEET` for the Done sheet.

## Data model
None new: `ChannelListing` rows with the WhatsApp connection; `settleState` on the connection
(`OPEN`, `PUSHING`, `DONE`, `UNREADABLE`).

## API / contract changes
None.

## Test plan
- Reader on recorded pages, including a cursor and a grouped item.
- SKU auto-link; Done with mixed choices produces one batch whose deletes and upserts match the
  choices (A-level, spec's acceptance); a second Done tap does nothing.
- Partial batch failure retries only failed items.

## Delivery
1. **after connect-whatsapp U2** — Reader and the Listings page with WhatsApp as source (behaviour).
2. **after U1 and whatsapp-catalogue U2** — Done push through the catalogue item builder.
3. **after U2** — Unreadable path and card step.

## Open questions
None.
