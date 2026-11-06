# TRD — social-selling/whatsapp-contacts

- **Status:** Draft
- **Domain:** audience, fed by channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (Draft), [decisions.md](decisions.md), parent [decisions](../decisions.md), [audience TRD](../audience/trd.md), [connect-whatsapp](../connect-whatsapp/), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Channels' WhatsApp webhook (parent Q80, built in connect-whatsapp) already verifies Meta's signature
and stores each event once. This subfeature adds two translations there: contact-sync events become
`audience.contacts-synced` jobs, and inbound messages become `audience.message-received` jobs. Audience
(already built) upserts contacts and applies its opt-in and stop words. The confirming reply goes back
through a neutral `channels.whatsapp-confirm` job. Nothing outside `channels` sees a Meta payload.

## Prior art
- **Meta's coexistence webhooks** (`smb_app_state_sync` for contacts, `smb_message_echoes` for the
  app's own sends; INTEGRATIONS.md, checked 2026-11-05/06) are the only documented source; we follow
  them and subscribe to both at connect (connect-whatsapp).
- **Keyword opt-in/opt-out** (Twilio Advanced Opt-Out, Meta's own "STOP" guidance): exact keyword,
  confirm once. We follow, with Hindi words (audience Q13).
- **At-least-once webhooks with idempotent consumers** (Stripe, Meta): dedupe on the provider's
  event id. We follow, using the existing webhook event store.

## Technical decisions
- **D1 — Sync translation.** The handler of `whatsapp.contacts-sync` (connect-whatsapp D7) in
  `providers/whatsapp/` maps an `smb_app_state_sync` contact payload to `audience.contacts-synced { shopId, contacts: [{phone,
  name, removed}], metaEventId }`, batched at 500 per job. Phones normalised in audience (audience D2).
- **D2 — Message translation.** inbox-whatsapp's `whatsapp.messages` handler (its D1) gains a second
  mapping: an inbound message also maps to `audience.message-received
  { shopId, phone, text, messageId, at }`. Echoes (`smb_message_echoes`) are never mapped (Q6).
  The two enqueued jobs are independent; whichever subfeature lands first creates the handler.
- **D3 — Contact upsert.** Audience upserts on (shop, phone); a name fills only an empty name (Q3);
  `removed` deletes a contact with no events and no conversation (asked through inbox's public
  `hasConversation(shop, WHATSAPP, phone)`, inbox-core D11), else sets removed-from-phone (Q2). Out-of-order events: each
  carries Meta's timestamp; an older event never overwrites a newer one (Hazard).
- **D4 — Idempotence.** The webhook store dedupes Meta's event id; audience's consent unique key
  (audience D3) dedupes the opt-in itself; contact upsert is naturally idempotent (A4).
- **D5 — Confirming reply.** Audience enqueues `channels.whatsapp-confirm { shopId, phone, kind:
  opt-in | stop, language }`; channels sends a free-form text inside the 24-hour window (no template,
  no cost), wording from `audience`'s copy passed as a key, not text. A failure is logged and not
  retried past the window (Q5, Q8).
- **D6 — Sync status.** `ChannelConnection` (connect-whatsapp) records `contactsSyncedAt`; Audience
  shows waiting for 24 hours after connect, then Not shared if null (Q11). Read through channels'
  public service.
- **D7 — Large first sync.** Jobs of 500, one transaction each with one `createMany … skipDuplicates`
  and one update statement for names; the Audience page reads what has landed so far (Hazard).

## Packages
None.

## UI approach
Cites [ux.md](ux.md). Adds a "From your phone" line and source chips to the existing Audience page;
no new screen, no new client leaf beyond audience's.

## Gates touched
- `module-boundaries` — channels enqueues audience's jobs via `server/shared/jobs/` specs; audience
  reads inbox and channels through their services only.
- `file-cohesion` — the webhook translator stays inside channels.
- `one-repository` — contacts written only by audience's contact repository.

## Data model [MIGRATION]
`ChannelConnection.contactsSyncedAt` (nullable). Nothing else; contacts and consent are audience's.

## API / contract changes [CONTRACT]
Job payloads `audience.contacts-synced`, `audience.message-received`, `channels.whatsapp-confirm`;
recorded in CONTRACTS.md's Audience section.

## Test plan
- Unit: webhook mapping from recorded Meta payloads (sync add, edit, remove; inbound; echo ignored);
  name never overwritten; older event ignored.
- Integration: replay a sync twice → one contact each; YES → event + confirm job; echo "reply YES" →
  nothing; remove with history → kept, flagged; 5,000-contact sync in ten jobs.
- Manual: A1–A5 on the owner's coexistence number (going-live.md; coexistence eligibility in India is
  checked there).

## Delivery (units)
1. Webhook translation to the two audience jobs, behind recorded payloads.
2. Contact upsert, removal rule, sync status on Audience.
3. Confirming reply job in channels — behaviour-changing (buyers get replies).

## Open questions
None.
