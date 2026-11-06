# TRD — notification-hub/order-updates

- **Status:** Draft
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (Draft), [decisions.md](decisions.md), [hub-core trd](../hub-core/trd.md), [ADR-0069](../../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md), [order-fulfilment trd](../../own-store/order-fulfilment/trd.md) D8, [ADR-0004](../../../adr/0004-money-as-integer-paise.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
`notice.service.ts` stops writing `Notice` and enqueueing `notify.send`; instead it calls
`notify.emit` with the same kind, audience and key. The receipt in `server/checkout/payment-confirmed.ts`
becomes an emit. Three buyer kinds get a WhatsApp route behind the shop's switch; the rest stay
email-only. A fallback job, scheduled 15 minutes after a WhatsApp row is sent, writes the email
row only if that row is still not `DELIVERED`.

## Prior art
- **Channel fallback with a delivery deadline** is the standard "failover" step in Twilio
  Verify, Novu and Knock workflows: try channel A, wait for a delivery receipt, else channel B.
  We follow it, with WhatsApp's `delivered` status webhook as the receipt (via social-selling).
- **The move itself** follows the strangler pattern (Fowler): new path for every kind, the old
  table frozen and read-only for one release as the audit copy, as cart lines were lifted (PR-44).

## Technical decisions
- **D1 — Key preserved.** The `Delivery` key for a parcel kind is `parcel:<shipmentId>:<kind>:<audience>:<ref>`,
  the old `Notice` unique tuple, so a sweep that already sent under `Notice` is detected: before
  writing, the emit checks a sent `Notice` with the same tuple during the one-release overlap.
- **D2 — Routes in `NOTIFY_ROUTES`.** `order_confirmed`, `parcel_shipped` (from `BOOKED_BUYER` /
  `PICKED_UP` → the buyer's "shipped"), `parcel_delivered`: `[whatsapp?, email]` where `whatsapp?`
  applies only if `OrgNotifySettings.orderUpdatesWhatsApp` is true. Receipt: `[email]`. All other
  `NOTICE_KIND`s: `[email]`.
- **D3 — Fallback.** On a WhatsApp `SENT`, enqueue `notify.fallback` with `runAt +15 min`. The handler
  reads the row; `DELIVERED` or `READ` → nothing; otherwise mark `FAILED` (`undelivered_15m`) and
  write the email row with the same key and channel `email`. A later `delivered` status on the
  WhatsApp row is recorded and sends nothing (A3).
- **D4 — Consent checked at deliver time too.** `canReach` runs at emit and again in the worker; a
  STOP between them makes the WhatsApp row `SKIPPED` and writes the email row.
- **D5 — Exempt from caps.** These kinds are `transactional`; the hub's cap count (hub-core D5)
  and the WhatsApp channel's frequency cap ignore them (social-selling Q70).
- **D6 — Cost.** The card reads campaigns' `whatsAppMonthToDate(orgId, utility)` (whatsapp-campaigns
  D9) → count and paise; rendered with the portal's paise formatter.
- **D7 — Templates.** The three utility templates are in whatsapp-templates' starter set (social-selling
  Q37) in English and Hindi; this subfeature names them, never writes them.

## Packages
None.

## UI approach
Cite [ux.md](ux.md).
- **Per form factor:** one card on the Notifications page, phone first: title, one line of what
  it does, the cost line, the switch, this month's count. `md:`/`lg:` unchanged (portal form width).
- **Rendering:** server component reads `NotifySettingsDto` (extended with `orderUpdates`); the
  switch is the client leaf.
- **Behaviour:** `notifyApiClient.setOrderUpdates` with `useMutation`.
- **Surfaces:** `ui/` switch and card; no new token.

## Gates touched
- Extends the hub-core settings route; request-body-parsing for the new field.
- `Notice` gains no writer; after one release a migration drops writes (a later unit). one-repository.
- Copy in `notify-copy.ts`.

## Data model
[MIGRATION] `OrgNotifySettings.orderUpdatesWhatsApp Boolean @default(false)`. `Notice` kept read-only
for one release, then dropped in a later migration.

## API / contract changes
`NotifySettingsDto` gains `orderUpdates { whatsapp: boolean; monthCount: number; monthCostPaise: number }`. [CONTRACT]

## Test plan
- Regression: every `NOTICE_KIND` produces one email with the same subject and body as before (A5),
  run against the pre-move snapshot.
- Integration: switch off → email (A1); on → WhatsApp only (A2); fallback after 15 min with a fake
  clock and a late delivered status (A3); receipt always (A4); STOP mid-flight (D4).
- Unit: route table; paise cost formatting.

## Delivery (PRs)
1. Parcel notices and receipt emit through the hub, email-only (behaviour unchanged; A4, A5).
2. Switch, routes and cost card, WhatsApp plug enabled (changes behaviour for shops that turn it on).
3. Fallback job.
4. After one release: stop reading `Notice`, migration drops it.

## Open questions
None.
