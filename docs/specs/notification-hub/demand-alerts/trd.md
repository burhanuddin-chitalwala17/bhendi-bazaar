# TRD — notification-hub/demand-alerts

- **Status:** Draft
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (Draft), [decisions.md](decisions.md), [hub-core trd](../hub-core/trd.md), [ADR-0069](../../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md), [ADR-0018](../../../adr/0018-one-effective-price-function.md), [ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Each source domain emits a neutral fact it already knows — catalog "price changed" and "back in
stock", cart "cart idle", bidding "outbid" and "ending soon" — as a job on the queue, never
importing notifications (the stock-changed job is the pattern). A notifications handler per fact
resolves the audience rule, checks the shop's switch, and calls `notify.emit` per recipient with a
marketing kind. The hub's window, global cap and channel order (hub-core D4, D5) do the rest; the
WhatsApp channel applies its frequency and spend caps.

## Prior art
- **Wishlist price-drop and back-in-stock** alerts (Shopify apps such as Klaviyo's flows and
  "Back in Stock", Amazon's own) trigger on the stored price/stock change, re-check at send, and
  rate-limit per product per person. We follow all three.
- **Abandoned-cart flows** (Klaviyo, Shopify) wait a delay after last activity, exit if the buyer
  ordered, and send only to identifiable consented buyers. We follow it with one step (social-selling Q54).
- **Quiet hours** delaying rather than dropping marketing (Braze, Iterable "quiet hours"); a
  time-bound message past its moment is dropped. We follow it (Q5).

## Technical decisions
- **D1 — Facts as shared jobs** in `server/shared/jobs/`: `price.changed` (productId, old and new
  effective price in paise from the one resolver, ADR-0018), `stock.restocked` (productId),
  `cart.idle` (cartId, at), `bid.outbid` (auctionId, userId), `auction.ending` (auctionId). Emitted
  in the source's transaction; catalog's existing `stock-changed` job feeds `stock.restocked` when a
  count goes from 0 to above 0.
- **D2 — Audience rules**, closed set `ALERT_AUDIENCE` in `notify.types.ts`: `wishlisters`
  (wishlist's public `wishlistersOf(shop, {productIds})`, added by audience D9), `cart_owner`, `bidders` (bidding's public read), later
  `followers`. `ALERT_RULES` maps each alert to its rule (Q6).
- **D3 — Switches and window** in `OrgNotifySettings`: `alerts` (JSON parsed by zod: per alert
  on/off), `windowStart`, `windowEnd` (minutes from IST midnight, default 540 and 1260). The hub
  computes `runAt` = now, or the next window opening; `auction.ending` outside the window is skipped
  `outside_window` (Q5).
- **D4 — Re-check at send** (Q7): each marketing row's handler calls the alert's `stillTrue(facts)`
  — price still at or below the alerted price, product in stock and not archived, cart not ordered,
  auction open — before handing to the channel; false → `SKIPPED` with the reason.
- **D5 — Per-product limit** (Q8): key `price_drop:<productId>:<userId>:<IST date>` so a second drop
  the same day is a duplicate row; `back_in_stock:<productId>:<userId>:<restock id>`.
- **D6 — Abandoned cart**: `cart.idle` is scheduled by cart's service with `runAt` +1 hour on each
  cart write (replacing the previous by key `cart:<cartId>`); the handler exits if an order exists
  since, if the user is a guest, or not opted in. Never more than one per cart idle period.
- **D7 — Spend cap** (Q4) belongs to the WhatsApp channel (social-selling Q68): the plug's `canReach`
  calls campaigns' `whatsAppCanSend` (whatsapp-campaigns D9), which answers no when month-to-date
  spend on every paid send plus this message's price would pass the cap; the hub falls to email. The first refusal in a month emits the shop event `spend_cap_reached`.
- **D8 — Estimated cost** on each switch: last 30 days' count of the alert's trigger events ×
  opted-in audience × marketing price (paise) from whatsapp-templates' rates module, shown as "about ₹X a month".
- **D9 — Outbid stays transactional for bidders** (Q9): `bid.outbid` emits a transactional
  `outbid` (email, as today) and, if the switch is on, a marketing `auction_outbid`; the bidder gets
  the marketing one by WhatsApp instead of the email when reachable, never both (one key).

## Packages
None.

## UI approach
Cite [ux.md](ux.md).
- **Per form factor:** on the Notifications page, phone first: an "Alerts" card with four rows
  (name, one line, estimated cost, switch), then "Sending window" (two time selects), then "Monthly
  WhatsApp spend" (rupee input, this month's spend bar). `md:` and `lg:` keep one column.
- **Rendering:** the page is a server component; each switch, the window and the cap are client leaves.
- **Behaviour:** `notifyApiClient.setAlert`, `setWindow`, `setSpendCap` (the route calls campaigns'
  public `setSpendCap`, the one writer) with `useMutation` /
  `useServerForm` against a new notify schema beside the others in the validation schemas folder.
- **Surfaces:** `ui/` switch, select, input, progress; no new token.

## Gates touched
- New shared jobs → jobs registry; source domains enqueue only, never import notifications (module-boundaries).
- `cart.service` and `bidding.service` gain an enqueue each → file-cohesion (they reach `shared` only).
- Settings route extended → request-body-parsing; paise input parsed to Int (Invariant 3).
- Copy in `notify-copy.ts`.

## Data model
[MIGRATION] `OrgNotifySettings` gains `alerts Json @default("{}")`, `windowStart Int @default(540)`,
`windowEnd Int @default(1260)`. The spend cap lives in social-selling's WhatsApp settings (campaigns), not here.

## API / contract changes
`NotifySettingsDto` gains `alerts`, `window`, `spend` (cap and month-to-date paise, from campaigns'
`whatsAppMonthToDate` and caps). New shared job payloads in CONTRACTS.md. [CONTRACT]

## Test plan
- Unit: window `runAt` across midnight; per-product key; `stillTrue` per alert; estimate in paise.
- Integration: A1–A7 with a fake WhatsApp channel and fake clock; mutation-test the order-exists
  exit (D6) and the spend-cap fallback (D7).

## Delivery (PRs)
1. Settings fields, window and switches page (no alerts yet).
2. Price drop and back in stock (changes behaviour for shops that switch on).
3. Abandoned cart.
4. Auctions, outbid moved onto the hub (D9).
5. Spend-cap fallback and shop event.

## Open questions
None.
