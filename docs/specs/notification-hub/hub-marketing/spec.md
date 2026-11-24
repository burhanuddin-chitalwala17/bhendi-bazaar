# Spec — notification-hub/hub-marketing

- **Summary:** A message meant to sell reaches a buyer once, by WhatsApp when it can and by email otherwise, never more often in a day than the shop allows across every channel, and every email carries a one-tap way out
- **Status:** Accepted
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [notification-hub](../spec.md) and its [decisions](../decisions.md) (Q1, Q5), [notifications-core](../notifications-core/spec.md), [social-selling](../../social-selling/spec.md) (Q9, Q40, Q66), [consent-core](../../social-selling/consent-core/spec.md), [whatsapp-sending](../../social-selling/whatsapp-sending/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. Built in
> social-selling's step 7, before order-updates and demand-alerts, which both use it.

## What this feature is
The rules every buyer-facing message follows: which channel it takes, how many a buyer may get in
a day, and how a buyer says no more. The alerts and campaigns decide what to say; this decides how
and whether it goes.

## Why
A buyer hearing from a shop three ways in a morning stops listening, and reports it. One set of
rules across WhatsApp and email keeps every shop welcome in its buyers' phones (social-selling Q40).

## Requirements
- R1 — A buyer message goes once: by WhatsApp when the buyer opted in there, has not stopped and it
  is delivered; otherwise by email when they opted in to email; always inside the shop's how-often
  rule (social-selling Q66, Q40).
- R2 — No buyer gets more marketing messages from one shop than the shop's one how-often rule allows
  (default once a day, four times a week), counted across WhatsApp and email together. Order updates
  are exempt (Q2, social-selling Q40).
- R3 — The rule is changed under Advanced on the shop's Messaging settings, in Shop details, beside
  the channels the shop has connected (social-selling Q110, Q112).
- R4 — Every marketing email carries an unsubscribe link that, in one tap and without signing in,
  withdraws that buyer's email consent for that sender only, and says so (Q1).
- R5 — A message skipped by a cap or a missing consent is recorded with why, and counts nothing.

## Hazards the TRD must answer
- **Two alerts at once** for one buyer when the cap has one left.
- **WhatsApp accepted but never delivered:** when email follows, and that it never doubles.

## Product acceptance
- A1 — A buyer opted in to both gets a price-drop alert on WhatsApp only.
- A2 — A buyer opted in to email only gets it by email.
- A3 — With the default rule, a second alert the same day is skipped and recorded as over the limit.
- A4 — Unsubscribe in an email stops that shop's emails, and nothing else, in one tap.

## Scope
- **Outcome:** buyer messages go once, by the right channel, within the shop's how-often rule.
- **In:** R1–R5, tested by A1–A4.
- **Later:** a buyer's own preferences page across shops.

## Open questions
None.
