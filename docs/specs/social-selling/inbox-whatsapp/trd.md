# TRD — social-selling/inbox-whatsapp

- **Status:** Draft
- **Domain:** channels (the WhatsApp plug for inbox)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), parent [decisions](../decisions.md) (Q7, Q8, Q76, Q80, Q81), [inbox-core TRD](../inbox-core/trd.md), [connect-whatsapp TRD](../connect-whatsapp/trd.md) (D7 webhook), [whatsapp-templates TRD](../whatsapp-templates/trd.md) (D7 rates), [whatsapp-contacts TRD](../whatsapp-contacts/trd.md) (D2), [ADR-0004](../../../adr/0004-money-as-integer-paise.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's (the inbox's own screens are inbox-core's).

## Approach
connect-whatsapp's webhook route already verifies Meta's signature, stores each event once in
`MetaEvent` and enqueues one job per field. This subfeature adds the handlers for `messages`
(inbound and statuses) and `smb_message_echoes`, mapping them to inbox-core's neutral job, and a
WhatsApp `InboxSource` that sends free-form replies inside the window and templates outside it.
The `whatsapp.messages` handler is this subfeature's; whatsapp-contacts (its D2) and
whatsapp-campaigns (its D4) add their own mappings to it.

## Prior art
- **Meta's Cloud API messaging**: `POST /<phone_number_id>/messages` with `type: text|image|template`;
  free-form only within the customer service window; statuses arrive as `statuses` in the same
  `messages` webhook, with ids matching our send. We follow Meta's docs.
- **Status monotonicity**: Twilio and Meta both document out-of-order status callbacks; the field
  practice is to apply a status only if it ranks above the stored one. Followed (D4).
- **Coexistence echoes**: `smb_message_echoes` (INTEGRATIONS.md, checked 2026-11-05) carry the app's
  own sends; a message sent through the API is not echoed back as an app send, so de-duplication is
  by Meta's message id. Followed (D3).

## Technical decisions
- **D1 — Handlers in `providers/whatsapp/inbox.ts`.** The `whatsapp.messages` job (enqueued by
  connect-whatsapp D7) finds the connection by `phone_number_id` (unknown → ignored, R8), parses each
  message with a Zod schema, and enqueues `inbox.message-received` with thread id = the person's
  `wa_id`, person name = profile name, kind text/image or an unsupported label (audio, sticker,
  location, contacts, reaction).
- **D2 — Statuses.** `statuses` entries update the inbox message by external id through inbox's
  public `recordDelivery(externalId, status, at)`; `failed` carries Meta's error code mapped to a
  failure code (D6).
- **D3 — Echoes.** `whatsapp.smb-echoes` maps each echo to `inbox.message-received` with direction
  out-echo; inbox-core's unique (source, external id) drops any echo of a message we sent (A2).
- **D4 — Status order.** inbox ranks SENT < DELIVERED < READ; `recordDelivery` writes only a higher
  rank, and FAILED only over SENT. A status for an unknown id is kept 10 minutes by a retry of the
  job (the send's own write may lag), then dropped.
- **D5 — The WhatsApp `InboxSource`.** `window`: open if the last inbound is under 24 hours old, else
  `SHUT_TEMPLATES` (no human-agent on WhatsApp). `templates(shop)`: the shop's `APPROVED` templates
  from campaigns' `template.service`, each with its cost from campaigns' rates module (whatsapp-templates
  D7), so one table decides every rupee shown. `send`: text or image inside the window; a template
  outside it, after re-reading the window at send time (hazard 3): if it reopened, the template is
  still sent as chosen, because the shop confirmed that message. Capabilities: `canSendImage`, no hide.
- **D6 — Errors.** `SPEND_CAP` (ours, D7) → "past your limit"; 131047 (window shut) → `WINDOW_SHUT`; 131042 / payment errors → `PAYMENT_METHOD`;
  190 / 10 → `CONNECTION_DEAD` (connection set `NEEDS_RECONNECT` through connect-whatsapp's command);
  131026 (not on WhatsApp) → `UNDELIVERABLE`; other → `PLATFORM_REFUSED`. No body logged (R10).
- **D7 — Cost and spend cap.** A template send writes, on the inbox message, the template id,
  category and `costPaise` read from the rates module (ADR-0004). Before calling Meta, the source
  calls campaigns' public `reserveSpend(shop, key = inbox:<messageId>, cost, INBOX_REPLY)`
  (whatsapp-campaigns D9a), idempotent on the key; no room → failure `SPEND_CAP`, nothing sent (Q5,
  parent Q32). Meta's pricing on the status settles it through `settleSpend`; a failed send releases
  it. Frequency caps are not applied: a reply answers the person.
- **D8 — Rate.** Send jobs are grouped per connection; coexistence's 20 messages a second is far above
  a shop's typing speed; a 130429 retries with backoff.
- **D9 — Retention and deletion.** Disconnect (connect-whatsapp D10) enqueues
  `inbox.source-disconnected`; a reconnect of the same number clears it. A person's deletion reaches
  the inbox as `inbox.person-deleted`, enqueued by audience's `forget` for that phone (audience D12).
- **D10 — Recorded payloads.** Dashboard "Test" payloads and our own number's real events stored
  under `tests/fixtures/meta/whatsapp/`, ids replaced, replayed through the real route (parent Q81).

## Packages
None.

## UI approach
inbox-core's screens, with what this plug adds (ux.md): delivery ticks, the template picker with
cost, the "From the WhatsApp app" label, the payment-method failure. Copy in `inbox-copy.ts`.

## Gates touched
- `module-boundaries` — `channels` imports inbox's port and campaigns' public `template.service` and
  spend commands. inbox imports neither.
- `file-cohesion` — `providers/whatsapp/inbox.ts` reaches inbox and campaigns: two domains, within
  the limit.
- `one-repository` — no new table; inbox's repositories write its rows.
- `request-body-parsing` — every message and status parsed with Zod after the signature check.

## Data model [MIGRATION]
inbox-core's `InboxMessage` gains delivery status, delivered-at, read-at, template id, category and
cost in paise (`Int`). No new table.

## API / contract changes [CONTRACT]
`MessageDTO` gains `delivery` and `costPaise`; inbox's public `recordDelivery`. CONTRACTS.md "Inbox".

## Test plan
- Unit: message and status schemas; status ranking (Read never back to Delivered; Failed only over
  Sent); window at 24 h; error code mapping; cost read from the rates module.
- Integration: recorded inbound text, image, audio, echo and statuses through the route; replay adds
  nothing; a status before its send applies after the retry; a template send records cost and
  member; unknown number ignored.
- Manual (A1–A4): owner's number on dev at 360px, with the Business app open beside it.

## Delivery (units)
1. Inbound messages and echoes into inbox — behaviour-changing.
2. WhatsApp source: free-form replies, statuses and ticks.
3. Template replies outside the window with cost and the spend cap (needs whatsapp-campaigns unit 1); error mapping; retention hooks.

## Open questions
None.
