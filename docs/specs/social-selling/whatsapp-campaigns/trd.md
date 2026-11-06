# TRD — social-selling/whatsapp-campaigns

- **Status:** Draft
- **Domain:** campaigns, channels (WhatsApp plug)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (Draft), [decisions.md](decisions.md), parent [decisions](../decisions.md) Q7, Q66, Q68, Q70, Q74, Q79, Q80, [whatsapp-templates TRD](../whatsapp-templates/trd.md), [audience](../audience/), [notification-hub](../../notification-hub/), [ADR-0004](../../../adr/0004-money-as-integer-paise.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
`server/campaigns/` holds two things: the `Campaign` aggregate (a send the shop composes) and the
**WhatsApp send** every caller uses. The send is one function behind campaigns' public surface,
`deliverByWhatsApp` (Q9), which takes a shop, a recipient contact, a template, its values, a purpose
(marketing or utility) and the caller's idempotency key. Inside one transaction it claims a
`WhatsAppMessage` row, checks consent through audience, takes the shop's spend and frequency
budget with guarded updates, and only then enqueues the Meta call. `channels` implements the
`MessagePublisher` port and owns the token (parent Q7). A campaign is a list of such sends,
expanded in batches on the worker. Meta's status webhook (parent Q80) updates each row.

## Prior art
- **Budgets taken by conditional update**, as our stock is (ADR-0007): a `WhatsAppSpend` row per
  (shop, month), `updateMany … where remaining >= cost`, `count === 0` = held. Stripe and Twilio
  reserve then settle on the actual; we follow (hazard 2, 4).
- **Idempotent sends**: Meta has no idempotency key, so ours is a unique caller key on
  `WhatsAppMessage` (hazard 3; ADR-0038).
- **Frequency caps** (Braze, MoEngage) and **consent** (Meta, Twilio) are checked at send, not at
  schedule; we follow, in one transaction (hazard 1).

## Technical decisions
- **D1 — Public surface** `campaign.service`, `whatsapp-send.service`, `.types`. Repositories:
  `campaign.repository` (`Campaign`, `CampaignRecipient`), `whatsapp-message.repository`
  (`WhatsAppMessage`), `whatsapp-budget.repository` (`WhatsAppSpend`, `WhatsAppCaps`).
- **D2 — `deliver` order, one transaction**: claim the message row by caller key (exists → return its
  outcome) → audience `consentFor(shop, contact, WHATSAPP)` (none or stopped → `SKIPPED`, reason) →
  for marketing, frequency: count marketing rows to this contact from this shop today and this
  week (IST) against `WhatsAppCaps`, and ask `GlobalCapPort.allows(shop, contact)`, a port
  campaigns declares and hub-core implements (its D5), never an import → spend: guarded decrement of the
  estimate (`HELD`, reason spend cap) → `QUEUED`, and enqueue `campaigns.whatsapp-send` keyed on
  the row. Answers `SENT`/`SKIPPED`/`HELD` with a closed reason set (`SEND_OUTCOME`, `SKIP_REASON`).
- **D3 — The Meta call** runs in the job, outside any transaction, through `MessagePublisher`;
  the answer writes Meta's message id. Temporary errors retry three times; permanent ones release
  the reserved spend and record the mapped reason (Q11).
- **D4 — Settling**: channels' `whatsapp.messages` handler (inbox-whatsapp D2) also enqueues
  `campaigns.message-status` for every status; its handler ignores ids it does not hold, and sets delivered/read/failed and, on Meta's pricing
  object, replaces the estimate with the actual on the row and adjusts `WhatsAppSpend` by the
  difference in the same transaction. A message never delivered releases its reservation.
- **D5 — Campaigns**: composing writes `Campaign` (template, values, products as ids, list id,
  scheduled-at, confirmed-count, estimate in paise, created/scheduled/sent-by). Send expands the
  list through audience's surface in pages of 500 into `CampaignRecipient` rows and calls `deliver`
  for each with key `campaign:<id>:<contact>`, stopping at the confirmed count (Q4).
- **D6 — Holding**: a template not `APPROVED`, a start more than six hours late (Q12), or the spend
  cap reached marks the campaign `HELD` with a reason; Stop marks remaining recipients `CANCELLED`
  and releases nothing (nothing was reserved for them yet).
- **D7 — Scheduling**: no per-minute schedule (the jobs-schedule floor and idle budget forbid it).
  Scheduling a campaign enqueues one delayed job for `scheduled-at`, keyed on the campaign and its
  version; an edit bumps the version, so the old job finds a stale version and exits (Q13).
- **D8 — Products**: one product sends a single-product message, 2–30 a multi-product one, by
  catalogue retailer id from whatsapp-catalogue; archived or unpublished products are dropped at
  send with a note. Prices are WhatsApp's catalogue's, kept in step by whatsapp-catalogue (Q16).
- **D9 — Reads for the hub** (Q9): `whatsAppCounts(shop, contact)` returns marketing messages today
  and this week, summed by hub-core's global cap (parent Q70, Q74); `whatsAppCanSend(shop, contact,
  purpose)` answers the same consent, cap and spend checks as `deliver` without claiming, for the
  hub plug's `canReach`; `whatsAppMonthToDate(shop, purpose?)` returns count and paise for cost cards.
- **D9a — One budget for every paid send** (parent Q32, inbox-whatsapp Q5): public `reserveSpend(shop,
  key, estimatePaise, source)` and `settleSpend(key, actualPaise)`, used by `deliver` and the inbox's
  template reply; `source` (`SPEND_SOURCE`: campaign, alert, order update, inbox reply) is recorded.
- **D10 — Caps**: `WhatsAppCaps` per shop: per-day and per-week (defaults 1 and 4, any positive
  value, parent Q40), monthly spend cap in paise with no default, first written by connect-whatsapp's
  cap step through the public `setSpendCap` command (Q7). The alert window is notification-hub's
  (demand-alerts D3), not stored here. Quality is read from channels' connection (connect-whatsapp D8).
- **D11 — Language**: the recipient's stored language; English if that version is not approved (Q17).

## Packages
None.

## UI approach
Screens, states and copy are [ux.md](ux.md)'s. Rules: [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md).
- **Per form factor:** phone: campaign list, then a four-step composer (message, products,
  audience and time, review) with a docked primary button; review shows counts and cost as rows.
  `md:` shows the phone preview beside the steps; `lg:` the list and composer side by side.
- **Rendering:** `/org/[orgId]/whatsapp/campaigns`, `…/campaigns/new`, `…/campaigns/[id]`, and
  `/org/[orgId]/whatsapp/settings` are server pages over `campaigns.dal.ts`. Client leaves:
  `CampaignComposer` (`useServerForm`), `ReviewCounts` (`useAsyncData`, recounts on open),
  `StopCampaignDialog`, `CapsForm`.
- **Behaviour:** `campaignsApiClient` (draft, estimate, schedule, send now, cancel, stop) and
  `whatsappSettingsApiClient` (caps), in `src/components/campaigns/`. Rupee input converts to
  paise at the API client edge; components receive paise and format through `src/lib/format.ts`.
- **Surfaces:** product picker on the existing picker overlay (ADR-0040); `FormDialog` for stop and
  confirm. No new token.

## Gates touched
- `module-boundaries` — campaigns reaches audience (consent, lists) and catalog (products) through
  services; `channels` implements its ports; notification-hub's cap behind a campaigns-declared port.
- `file-cohesion` — `campaign.service` reaches audience and catalog (two domains), recorded.
- `one-repository` — four new tables, each with one repository.
- `portal-boundary`, `request-body-parsing`, rate-limit registry — the org routes.
- A new source scan: no file outside `server/channels/providers/whatsapp/` names Meta's messages
  endpoint (hazard 5), mutation-tested.

## Data model [MIGRATION]
`Campaign`, `CampaignRecipient` (unique campaign, contact), `WhatsAppMessage` (unique caller key;
shop, contact, template, purpose, state, skip/fail reason, Meta id, estimate and actual paise,
timestamps), `WhatsAppSpend` (unique shop, month; cap, reserved, settled, all paise),
`WhatsAppCaps` (unique shop). All `Int` money; none cascade from a shop (ADR-0020).

## API / contract changes [CONTRACT]
`CampaignDTO`, `CampaignReviewDTO`, `WhatsAppCapsDTO`, `SEND_OUTCOME`, `SKIP_REASON`, `SPEND_SOURCE`;
the `deliverByWhatsApp`, `whatsAppCounts`, `whatsAppCanSend`, `whatsAppMonthToDate`, `reserveSpend`,
`settleSpend` and `setSpendCap` signatures; `GlobalCapPort`. CONTRACTS.md gains
"WhatsApp send".

## Test plan
- Unit: outcome and reason mapping to ux.md copy; frequency windows at IST midnight and Monday;
  estimate arithmetic in paise; language fallback.
- Integration: STOP between review and send skips (A2); two concurrent sends at the cap edge, one
  held (hazard 2); a retried job sends once (A6); actual price settles the spend row; a non-opted-in
  contact via the port is skipped (A7); campaign never exceeds confirmed count; held on paused template.
- Source scan: Meta messages endpoint named only in the WhatsApp provider (mutation-tested).
- Manual: owner's test number, list of five (A1), multi-product message (A5), at 360px.

## Delivery (units)
1. Schema, repositories, caps and spend rows, `setSpendCap`, `reserveSpend`/`settleSpend` — no behaviour.
2. `deliverByWhatsApp` with consent, caps, spend; the hub reads; `GlobalCapPort`; `MessagePublisher` in channels; source scan — behaviour-changing.
3. `campaigns.message-status` settling.
4. Campaign compose, estimate, schedule, send, stop, report.
5. WhatsApp settings page (caps, spend, quality).

## Open questions
None. Q7 decided by the owner 2026-11-06.
