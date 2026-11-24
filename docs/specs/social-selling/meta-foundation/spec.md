# Spec — social-selling/meta-foundation

- **Summary:** Meta's events and requests reach Bhendi Bazaar safely and exactly once, through one Meta app both connections share, and each platform stays Coming soon until it is opened
- **Status:** Accepted
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q2, Q7, Q34), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0068](../../../adr/0068-meta-is-a-connected-shopfront.md), [channel-connectors](../../marketplace-integration/channel-connectors/)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Connect.
> Built first in step 2: connect-instagram and connect-whatsapp stand on it.

## What this feature is
The plumbing between Meta and Bhendi Bazaar that every Instagram and WhatsApp subfeature shares:
one Meta app, the routes Meta calls, and the switch that opens each platform to shops.

## Why
Meta talks to us in four ways a shop never sees: events (a DM, a comment, a status), a notice that
an account removed our app, a person's request to delete their data, and the review of our app.
Each must be answered the same way for Instagram and WhatsApp, safely and once. Built inside each
connection, it would be built twice and drift; built here, the tools above never touch Meta.

## Requirements
- R1 — Every Instagram and WhatsApp connection runs through one Meta app (parent Q2). Its
  credentials live in the deployment's settings, never in code or the database.
- R2 — Meta's events arrive at one route per Meta product (Instagram, WhatsApp). A request whose
  signature does not match our app's secret is refused and recorded without its body.
- R3 — Every event is stored once, keyed by Meta's own id, before anything acts on it; Meta
  sending it again changes nothing. We answer Meta at once and do the work afterwards, so Meta
  never retries because we were slow.
- R4 — Events reach the rest of the platform only as neutral facts handed on by a queue job: a
  message received, a comment received, a status changed, a contact changed. No tool sees a Meta
  payload (parent Q7, Q3).
- R5 — An event for an account no shop has connected is dropped, recorded only as a count.
- R6 — When an account removes our app inside Instagram or Meta, Meta's notice turns that
  connection to Needs reconnecting at once (Q1).
- R7 — When a person asks Meta to delete what we hold about them, we delete it from every
  connection that holds it, answer Meta with a confirmation code, and a public page at our address
  shows that request's status by its code (parent Q34).
- R8 — Credentials for every connection are stored encrypted, renewable without anyone
  reconnecting, and never shown, logged or returned to anyone, platform staff included: the rule
  the marketplace connections already keep.
- R9 — Nothing from Meta (a payload, a token, an error body) reaches a log or a person. A Meta
  failure becomes one of our own reasons, in our words.
- R10 — Instagram and WhatsApp open to shops separately. While a platform is closed its card on
  the Channels page says Coming soon and, on tap, why (parent Q2).
- R11 — Raw events are kept only as long as needed to prove each was handled once, then deleted
  (Q2).

## Hazards the TRD must answer
- **A forged event** naming a real shop's account: only a valid signature makes it real.
- **Meta retries for hours** when we answer slowly or fail: acknowledge first, work after.
- **A burst** (a viral post's comments) must queue, not drop and not overwhelm the database.
- **Our app's secret is rotated**: events signed with the old one during the change.
- **A deletion request names a person, not a shop**: it must find every connection they touch.

## Product acceptance
- A1 — A correctly signed event is stored once and becomes one neutral job; the same event sent
  three times is still one.
- A2 — An unsigned or wrongly signed request is refused, and nothing of its body is stored or logged.
- A3 — Removing Bhendi Bazaar inside Instagram turns that shop's Instagram card to Needs
  reconnecting within a minute of Meta's notice.
- A4 — A data-deletion request removes the person's data, returns a code, and the status page shows
  it as done.
- A5 — With WhatsApp closed and Instagram open, the WhatsApp card reads Coming soon and explains on
  tap; Instagram's card offers Connect.
- A6 — A test scanning every log line written during A1–A4 finds no Meta payload, token or error body.

## Scope
- **Outcome:** Meta reaches Bhendi Bazaar safely and once, through one app, for both connections.
- **In:** R1–R11, tested by A1–A6. Screens: the Coming soon card and the deletion-status page.
- **Later:** an admin view of event health (parent Q34's audit screen is separate).

## Open questions
None.
