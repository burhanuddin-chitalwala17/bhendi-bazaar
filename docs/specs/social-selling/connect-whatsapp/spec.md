# Spec — social-selling/connect-whatsapp

- **Summary:** A shop connects its WhatsApp number from Meta's signup pop-up, keeping its WhatsApp Business app, sets its monthly WhatsApp spend cap, and sees on the Channels page that the number is healthy and able to send
- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [connect-instagram](../connect-instagram/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0068](../../../adr/0068-meta-is-a-connected-shopfront.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 2 of
> social-selling; the catalogue, WhatsApp inbox, contacts, templates and campaigns act through it.

## What this feature is
A WhatsApp card on the Channels page. A member taps Connect WhatsApp, Meta's own pop-up opens,
they log in with Facebook, pick or create their business and confirm the number they already use in
the WhatsApp Business app, and come back connected. The number keeps working in their app.

## Why
Shops already sell on WhatsApp from the Business app and will not give it up (parent Q12). Meta's
pop-up creates the business account inside the flow when the shop has none (parent Q1), so a shop
needs nothing but a Facebook login. Every WhatsApp subfeature needs a number we can trust and a
token nobody can read; this builds it once.

## Requirements
- R1 — Any member connects WhatsApp from the Channels page through Meta's own pop-up. We never ask
  for or store a Facebook or WhatsApp password.
- R2 — A shop keeps using its WhatsApp Business app on the same number (coexistence). The connect
  screen says, quietly, what changes (parent Q12, parent Q12): the WhatsApp catalogue is then managed from
  Bhendi Bazaar; broadcast lists turn read-only; view-once and disappearing messages switch off; the
  app must be opened every couple of weeks. Messages typed in the app stay free.
- R2a — A number that cannot use coexistence (a blue-tick number, or Meta refuses) may instead move
  fully to Bhendi Bazaar, through Meta's own "new number" path in the same pop-up; the shop is told
  the Business app then stops working on that number and the Inbox becomes its WhatsApp (parent Q12).
  No unofficial linked-session tool is ever offered.
- R3 — The pop-up arrives pre-filled with the shop's name, email and website (parent Q12).
- R4 — A pop-up result that did not begin in this session, or for this shop, connects nothing.
- R5 — One number per shop and one shop per number; a reconnect with a different number is refused
  (Q10).
- R6 — After connecting, the number is ready for Bhendi Bazaar to use: registered and subscribed to
  our events, with nobody doing anything more (Q5); the catalogue and starter templates start then.
- R6a — Connecting ends with one step: the shop sets its monthly WhatsApp spend cap in rupees, no
  amount pre-filled. It covers every paid WhatsApp send (campaigns, alerts, inbox templates) and is
  changed or removed later in WhatsApp settings (parent Q8, social-selling Q8).
- R7 — The card shows in plain words: not connected, connected, needs reconnecting (with the reason),
  full for now, coming soon. When connected: the masked number, its WhatsApp name, its quality, whether
  payments are set up, who connected it and when, and when it was last checked (Q8).
- R8 — A number with no payment method is still connected, and the card says what that means and
  where to add one (Q8). The shop pays Meta directly (parent Q8).
- R9 — A daily check keeps the card true: a removed app or lost access turns Needs reconnecting, and
  a quality drop shows on the card; both appear once on the dashboard (Q8).
- R10 — A member can disconnect after confirming. The number keeps working in the Business app; our
  access is removed and our credentials deleted (Q13).
- R11 — Credentials are never shown, logged or returned to anyone, and are stored encrypted.
- R12 — Where Meta's weekly limit on new shops is reached, the card says so and when to try again
  (parent Q2). Where the platform has not opened WhatsApp, it says coming soon.

## Hazards the TRD must answer
- **The pop-up's result is reported by the browser.** A forged message could attach another
  business's account; the server must confirm it with Meta, not trust the page.
- **Half-finished setup.** Exchange succeeds and registration or subscription fails: the number is
  neither usable nor clearly broken. It must end connected or not, never in between.
- **Coexistence events arrive for months** (echoes of messages sent from the app, contact changes)
  and must reach the right shop once each, even when Meta delivers twice.
- **Coexistence may not be offered in India, or to a given number** (parent Q12): verified on day one on
  the owner's number; the fallback is R2a.
- **The cap step skipped** (the shop leaves after Meta succeeded): the number is connected with no
  cap set. What a paid send does then is open (below).
- **A shop removes our app in Meta Business Suite** while the card still reads Connected.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A member taps Connect WhatsApp, completes Meta's pop-up with the number from their Business
  app, and lands back on Channels with the number connected; the Business app keeps working.
- A2 — A member with no Meta business account completes the same, the business created in the pop-up.
- A3 — A pop-up result replayed or forged connects nothing.
- A4 — A number in another shop is refused; a reconnect with a different number is refused.
- A5 — A number with no payment method shows connected, with the line to add one.
- A6 — Removing Bhendi Bazaar in Meta Business Suite shows Needs reconnecting by the next check.
- A7 — Disconnect leaves the number working in the Business app and no credential stored.
- A8 — Every state in ux.md's matrix for the WhatsApp card can be reached and reads as written.
- A9 — Verified on Meta's sandbox account and on the owner's own number before any other shop (parent Q2).
- A10 — Connecting ends at the spend-cap step; the amount chosen shows in WhatsApp settings.

## Scope
- **Outcome:** a shop connects its WhatsApp number, keeping its Business app, and sees it healthy.
- **In:** R1–R12, tested by A1–A10.
- **Later:** catalogue (whatsapp-catalogue), chats (inbox-whatsapp), contacts (whatsapp-contacts),
  templates (whatsapp-templates), sending (whatsapp-campaigns); chat history (parent Q12).

## Open questions
None. The cap step is answered by parent Q8.
