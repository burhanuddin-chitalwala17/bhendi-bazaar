# Spec — social-selling/connect-whatsapp

- **Summary:** A shop connects its WhatsApp number from Meta's signup pop-up, keeping its WhatsApp Business app, and sees on the Channels page that the number is healthy and able to send
- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q2, Q3, Q8, Q12), [meta-foundation](../meta-foundation/spec.md), [channel-connectors](../../marketplace-integration/channel-connectors/), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0068](../../../adr/0068-meta-is-a-connected-shopfront.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Connect.
> Stands on meta-foundation. The catalogue, contacts, inbox and sending all start from it.

## What this feature is
A WhatsApp card on the Channels page. A member taps Connect, completes Meta's pop-up (which
creates a business account inside it if the shop has none), and comes back to a connected number
that keeps working in the shop's WhatsApp Business app.

## Why
Indian shops sell on WhatsApp from the Business app on their phone and will not give it up.
Meta's coexistence lets the same number work in the app and through Bhendi Bazaar, so connecting
costs the shop nothing it already has (parent Q12).

## Requirements
- R1 — Any member connects from the Channels page through Meta's own pop-up, pre-filled with the
  shop's name, email and website; we never ask for or store a Facebook or WhatsApp password.
- R2 — The default path keeps the shop's Business app on the same number (coexistence), and
  messages appear in both. The card says, as a quiet line, what changes: the WhatsApp catalogue is
  then managed from Bhendi Bazaar; broadcast lists turn read-only; view-once and disappearing
  messages switch off; the app must be opened every couple of weeks (parent Q12).
- R3 — A number that cannot use coexistence (a blue tick, or Meta refuses) may move fully to
  Bhendi Bazaar through Meta's own new-number path in the same pop-up; the shop is told the
  Business app then stops working on that number and the Inbox becomes its WhatsApp. No unofficial
  linked-session tool is ever offered (parent Q12).
- R4 — A pop-up result that did not begin in this session, or for this shop, connects nothing; the
  server confirms every result with Meta rather than trusting the page.
- R5 — One number per shop and one shop per number; a reconnect with a different number is
  refused (Q10).
- R6 — After the pop-up the number is made ready with nobody doing more: registered, subscribed to
  our events, its name, quality and payment status read. It ends connected or not connected, never
  half set up (Q5).
- R7 — Connecting starts what only works at connect time: the one sync of the Business app's
  contacts Meta allows, within 24 hours (parent Q12), whose contacts consent-core keeps (Q17).
- R8 — Connecting ends with the shop setting its monthly WhatsApp spend cap, an amount or "No
  limit" (parent Q8). The step belongs to whatsapp-sending and is added to this flow when that is
  built, before any outside shop connects (Q17).
- R9 — The card says in plain words: not connected, connected, needs reconnecting (with the reason),
  full for now, coming soon. Connected shows the masked number, its WhatsApp name, its quality,
  whether payments are set up, who connected it and when, and when it was last checked (Q8).
- R10 — A number without a payment method is still connected; the card says replies within 24 hours
  are free, paid messages need one, and where to add it (Q8).
- R11 — A daily check keeps the card true: our app removed, access lost, or the number offboarded
  (the Business app re-registered or moved phone) turns Needs reconnecting; a quality drop shows on
  the card. Each shows once on the dashboard through notifications-core (Q8, parent Q12).
- R12 — A member disconnects after confirming: the number keeps working in the Business app, our
  access is removed and our credentials deleted (Q13).
- R13 — When Meta's weekly limit on new shops is reached, the card says Full for now and when to
  try again (parent Q2).

## Hazards the TRD must answer
- **A forged pop-up result** attaching another business's account: confirmed with Meta, never trusted.
- **Half-finished setup:** the exchange succeeds and registration or subscription fails.
- **The one contact sync missed:** started late or failed, the contacts are lost for good.
- **Coexistence refused for a number or in India:** verified on day one on the owner's number (parent Q12).
- **Our app removed in Meta Business Suite** while the card still reads Connected.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A member completes the pop-up with the Business app's number and lands on Channels with it
  connected; the Business app keeps working and its chats appear in both.
- A2 — A member with no Meta business account completes the same, the business made in the pop-up.
- A3 — A replayed or forged pop-up result connects nothing.
- A4 — A number in another shop is refused; a reconnect with another number is refused.
- A5 — A number without a payment method shows connected, with the line to add one.
- A6 — Re-registering the Business app on another phone turns the card to Needs reconnecting.
- A7 — Disconnect leaves the number working in the Business app and no credential stored.
- A8 — Every state in ux.md reads as written; verified on Meta's sandbox and the owner's number first (parent Q2).

## Scope
- **Outcome:** a shop connects its WhatsApp number, keeping its Business app, and sees it healthy.
- **In:** R1–R13, tested by A1–A8.
- **Later:** chat history (parent Q12). Built on this: whatsapp-catalogue-import, whatsapp-catalogue,
  consent-core, whatsapp-sending, inbox-whatsapp.

## Open questions
None.
