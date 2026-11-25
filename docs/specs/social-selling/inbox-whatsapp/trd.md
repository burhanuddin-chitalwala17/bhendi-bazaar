# TRD — social-selling/inbox-whatsapp

- **Status:** Accepted
- **Domain:** channels (WhatsApp's `ConversationSource` and translator), with inbox, campaigns (templates, send port) and cart (checkout links)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [inbox-core TRD](../inbox-core/trd.md), [whatsapp-sending TRD](../whatsapp-sending/trd.md), [checkout-links TRD](../../checkout-links/trd.md), [ADR-0002](../../../adr/0002-server-holds-pricing-authority.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
WhatsApp's half of the inbox. Inbound messages, Business-app echoes and statuses become facts; a
member's reply goes through the source inside the 24-hour window and through whatsapp-sending's
port outside it; a cart from the catalogue becomes an order card priced by us, never by the cart.

## Prior art
- Meta's Cloud API message and status webhooks, `biz_opaque_callback_data`, media download by id,
  and the `order` message type (INTEGRATIONS). Followed.

## Technical decisions
- **D1 — People (R1, Q9).** `threadKey` = Meta's business-scoped user id where present, else the
  E.164 number; `personPhone` kept as contact data (ADR-0024); a `user_changed_user_id` system event
  re-keys the conversation in place.
- **D2 — Echoes and statuses (R2, R4, Q1).** `smb_message_echoes` → `OutboundEcho` (author APP).
  Statuses update our message by `platformMessageId`, or by `biz_opaque_callback_data` for an
  `UNCERTAIN` row (A-D8); a status may arrive before its message's row is committed, so a status
  with no row is kept on the event and retried by the drain.
- **D3 — Outside the window (R3, R8).** The reply box offers templates; sending one calls
  whatsapp-sending's `deliverByWhatsApp` (consent, spend, how-often for marketing; utility exempt
  from how-often), which answers sent, skipped or held with a reason the bubble shows (A6). The
  rendered template text is stored sealed as the message body (Q1).
- **D4 — Order card (R5, ADR-0002).** `CartOrder` facts carry retailer ids and quantities; the card
  is computed on read from live products (catalog), the effective price (promotions' resolver)
  and stock, never from the cart's prices; out of stock lines are struck and excluded. Send
  checkout link asks cart's `checkoutLinks.create({ orgId, items, source: INBOX_ORDER,
  conversationId })` and sends the link as a held message (inbox-core D6). The card's "Ordered"
  state reads the link's order through cart's public surface.
- **D5 — Media (R6).** Download through the media endpoint at first open, stored sealed in the
  object store under the conversation, served through an authorised route with
  `Content-Disposition` for documents; never a Meta URL to the browser.
- **D6 — Consent words (R7).** consent-core registers its own sink on `InboundMessage`, ordered after
  inbox's; its confirming reply is sent through `inboxService.sendAutomatic` so it appears marked
  Automatic.
- **D7 — Reconnect (R9, R10).** WhatsApp has no history read; drift is limited to statuses, which
  settle late or not at all (shown as Sent). Disconnect as inbox-core D10.

## Packages
None.

## UI approach
ux.md's WhatsApp tab, ticks, template picker (`ResponsivePicker` listing whatsapp-sending's approved
templates with price), order card component, refusal lines, file rows. Words in `inbox-copy.ts`.

## Gates touched
Route media (authorised download); order-card send-link route.

## Data model
Message `attachmentRef` for stored media; conversation re-key on user id change.

## API / contract changes
[CONTRACT] Uses `deliverByWhatsApp` and `checkoutLinks.create`.

## Test plan
- Translator on recorded payloads: every inbound type, echo, statuses in any order (A1, A2).
- Order card prices from our resolver with a cart carrying different prices; out-of-stock excluded
  from the link (A4, A5).
- Template outside the window counts against spend (A3); a spend-cap refusal shows the reason (A6).
- Media route refuses another org.

## Delivery
1. **after inbox-core U1 (its sinks take the facts)** — Translator and sinks (behaviour: WhatsApp messages land).
2. **after U1, inbox-core U3 (the `ConversationSource` port and held send) and whatsapp-sending U3 (`deliverByWhatsApp` and approved templates)** — Source sends, templates outside window, statuses.
3. **after U2 and checkout-links U2 (`checkoutLinks.create` and the link's order for "Ordered")** — Order card and checkout link; media.

## Open questions
None.
