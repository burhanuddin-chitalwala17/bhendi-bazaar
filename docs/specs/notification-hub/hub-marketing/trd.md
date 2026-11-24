# TRD — notification-hub/hub-marketing

- **Status:** Accepted
- **Domain:** notifications, with campaigns (WhatsApp port, how-often, spend) and audience (consent)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), [notifications-core TRD](../notifications-core/trd.md), [whatsapp-sending TRD](../../social-selling/whatsapp-sending/trd.md), [ADR-0069](../../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md) (revised decision 4)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
For a buyer-facing marketing event the hub tries WhatsApp, then email: WhatsApp through campaigns'
port (consent, how-often, spend), email through audience's consent and the same how-often touch.
One delivery goes, or none with its reason. Every marketing email carries a one-tap unsubscribe.

## Prior art
- **Channel fallback with one frequency budget across channels** (Braze's global frequency
  capping, Iterable's channel priority): followed; the budget is campaigns' `MarketingTouch`.
- **One-click unsubscribe** (RFC 8058 `List-Unsubscribe-Post`, required by Gmail and Yahoo for
  bulk senders): followed for every marketing email.

## Technical decisions
- **D1 — Order (R1, Q1 parent).** For MARKETING events: `deliverByWhatsApp` (purpose MARKETING);
  `SKIPPED(NOT_OPTED_IN|NO_WHATSAPP)` → email if `may(sender, contact, EMAIL)`; `HELD(LIMIT)` →
  email (demand-alerts Q7). A WhatsApp send that fails to deliver is not followed by email (it was
  counted); order-updates' utility fallback is its own (15 minutes).
- **D2 — How often (R2, R3, parent Q40).** The email path takes the same per-buyer lock and counts
  the same `MarketingTouch` (A-D13); a send past the rule is `SKIPPED(OVER_LIMIT)` with nothing
  queued. The rule's values live in campaigns' Messaging settings (Advanced); this subfeature does
  not keep its own (hub-marketing Q2 aligned in place).
- **D3 — Unsubscribe (R4, Q1).** Each marketing email carries `List-Unsubscribe` with a mailto and an
  HTTPS URL and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; the URL holds an HMAC-signed
  token (sender, contact, channel, issued) verified in constant time; POST (one-click) and GET (the
  page) both record a STOP event for that sender's email only; Undo within 30 days records OPT_IN
  with evidence "undo". Altered token → the invalid page.
- **D4 — Recorded skips (R5).** The delivery row holds `SKIPPED` and the reason; reports group on
  it.

## Packages
None.

## UI approach
ux.md's unsubscribe page: a public server component at `/unsubscribe/[token]`, no client code but
the Undo form. Words in `notifications-copy.ts`.

## Gates touched
Public route classified for rate limiting; `EXTERNALLY_CALLED` (email clients).

## Data model
None new (deliveries, consent events, touches).

## API / contract changes
Uses `deliverByWhatsApp`, `may`, `recordStop`.

## Test plan
- WhatsApp-and-email buyer gets WhatsApp only (A1); email-only gets email (A2).
- Second marketing message the same day skipped and recorded (A3).
- One-click POST and GET stop only that shop's email (A4); altered token refused.

## Delivery
1. WhatsApp plug and fallback order (behaviour).
2. Unsubscribe headers, page, undo.

## Open questions
None.
