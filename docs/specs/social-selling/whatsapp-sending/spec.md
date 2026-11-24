# Spec — social-selling/whatsapp-sending

- **Summary:** Every WhatsApp message Bhendi Bazaar sends for a shop goes through one door that checks consent and the shop's caps, shows and records what it costs, and uses the shop's approved templates: a starter set in English and Hindi from day one, and its own
- **Status:** Accepted
- **Domain:** campaigns
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q8, Q37, Q40), [consent-core](../consent-core/spec.md), [connect-whatsapp](../connect-whatsapp/spec.md), [inbox-whatsapp](../inbox-whatsapp/spec.md), [whatsapp-campaigns](../whatsapp-campaigns/spec.md), [notification-hub](../../notification-hub/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Reach out.
> Built in step 5: the WhatsApp inbox, campaigns, order updates and alerts all send through it.

## What this feature is
One door for every paid or business-started WhatsApp message, and the templates that go through
it. Its screen is the shop's WhatsApp settings: the spend cap, the frequency cap, this month's
spend, the number's quality, and the templates with Meta's verdict and price.

## Why
Four parts of the platform send WhatsApp messages: the inbox after 24 hours, campaigns, order
updates and alerts. If each checked consent and money on its own, one would forget. One door that
no caller can bypass keeps every buyer's consent and every shop's budget safe (parent Q8, Q40).

## Requirements
- R1 — Every send passes through one door, which asks consent-core, applies the shop's one "how
  often" rule (at most once a day and four times a week per buyer, across WhatsApp and email) and
  its spending limit, and answers sent, skipped (with the reason) or held. No caller can skip it; a
  utility message (an order update) skips the how-often rule but not consent or spend (Q12, parent
  Q40).
- R2 — Connecting WhatsApp ends with this module's spend-cap step: a monthly amount or "No limit",
  never skipped; a shop that leaves before answering is asked before its first paid send (parent Q8).
- R3 — At the cap, sends stop and the shop is told once; what was held can be sent when the cap is
  raised (Q11).
- R4 — Cost is shown before every paid send and recorded in paise per delivered message, estimated
  from a dated price table and corrected to what Meta reports (Q10, Q11).
- R5 — On connect, the starter templates (new arrivals, offer, back in stock, order update, abandoned
  cart, auction, and a first offer with "Yes, keep me posted" and "Stop messages" buttons) are submitted to the shop's account in English and Hindi (Q3, parent Q37).
- R6 — A shop writes its own template or copies a starter one to change it; it shows Meta's verdict
  in plain words (in review, approved, rejected with why, paused, disabled) and its price (Q5, Q7).
- R7 — A buyer gets the template in their language, English where theirs is not approved (parent Q37).
- R8 — Messaging settings, in Shop details, show the spending limit and the shop's hours at the top,
  this month's spend against the limit, and Meta's quality rating for the number with what a drop
  means; the how-often rule, greeting delay, bot pause and per-product alert limits sit under
  Advanced, each with its default (Q13, parent Q110, Q112).
- R9 — Any member may write or archive a template and change the caps; who did is recorded (parent Q8).

## Hazards the TRD must answer
- **Two callers at the cap** each sending the last message the cap allows.
- **Meta re-categorising a template** from utility to marketing, changing its price and caps.
- **A price table out of date** when Meta changes its rates.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — Connecting WhatsApp ends at the spending-limit step; the amount shows on Messaging settings.
- A2 — A send to someone not opted in is skipped with "not opted in", and costs nothing.
- A3 — A send that would cross the cap is held and the shop is told; raising the cap sends it.
- A4 — Twelve starter templates appear on connect, each with Meta's verdict and price.
- A5 — A shop copies a starter template, edits it and submits it; it shows In review.
- A6 — An order update to an opted-in buyer goes past the daily frequency cap but counts in spend.

## Scope
- **Outcome:** every WhatsApp send is consented, within the shop's caps, and costed.
- **In:** R1–R9, tested by A1–A6.
- **Later:** template read and click analytics.

## Open questions
None.
