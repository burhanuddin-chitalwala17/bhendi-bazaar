# Spec — notification-hub/hub-core

- **Summary:** Any module emits an event and the hub delivers it — by email, WhatsApp or the unread badge — once, within consent and the shop's global cap, with a daily email of what is still waiting
- **Status:** Draft
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [notification-hub](../spec.md) and its [decisions](../decisions.md), [social-selling decisions](../../social-selling/decisions.md), [ADR-0069](../../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 1 of
> notification-hub.

## What this feature is
The machinery every later notification uses, plus the first thing it delivers: social selling's
shop events. A shop sees an unread count in its menu and gets one email a day of what is waiting.
A shop sets how many marketing messages a buyer may get from it in a day.

## Why
Social selling needs to tell shops about DMs, failed posts and broken connections, and later
subfeatures need to tell buyers about orders and offers. Doing it once means consent, caps and
"never twice" are enforced in one place, and a module never learns how a person is reached.

## Requirements
- R1 — A module tells the hub what happened, to whom and for which shop; it never chooses a channel
  or sends anything itself (hub Q1).
- R2 — A notification is delivered once: a repeated event or retried job tells no one twice (hub Q3).
- R3 — Shop events (conversation waiting, post failed, connection needs you, Status post due) show
  on the unread badge in the shop menu at once (Q1, Q2).
- R4 — Each member gets one daily email at 9am IST listing what is still waiting; nothing waiting,
  no email. A member can turn it off; the badge always shows (Q2, Q3).
- R5 — A marketing message reaches a buyer once: by WhatsApp when it can, otherwise by email when
  the buyer opted in to email (social-selling Q73).
- R6 — No buyer gets more marketing messages from one shop in a day than the shop's global cap,
  default 3, whatever any channel allows; a skipped send is recorded with why (Q6, social-selling Q74).
- R7 — Every marketing email carries an unsubscribe link that, in one tap and without signing in,
  stops email from that sender only (Q5).
- R8 — A shop sets its global cap on its Notifications settings page and sees which channels it
  has (Q4).
- R9 — What was sent, to whom, by which channel and with what outcome is recorded without the
  message text, and kept 13 months (Q7).
- R10 — A failed delivery is retried when temporary; a lasting failure is recorded and, for
  marketing, falls to the next channel the buyer consented to.

## Hazards the TRD must answer
- **Two sends racing past the global cap.** Accepted by one (ADR-0069); the TRD says where.
- **An unsubscribe link that could stop someone else's email** if it is guessable.
- **A digest that lists something already answered** because it was read stale.
- **A module importing a channel** to skip the hub; the boundary test must catch it.
- **WhatsApp's own cap and the global cap disagreeing**; the stricter applies per channel and the
  global wins overall (social-selling Q74).

## Product acceptance
Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).
- A1 — A fake DM unanswered for four hours shows on the badge and in the next 9am email; answered
  before 9am, it is not in the email.
- A2 — Replaying the same event three times produces one delivery row and one email.
- A3 — With the cap at 3, a fourth marketing message to the same buyer that day is skipped and
  recorded as "cap reached".
- A4 — A marketing message to a buyer who stopped WhatsApp but opted in to email arrives by email.
- A5 — The unsubscribe link stops email from that shop only; an edited link stops nothing.
- A6 — A member who turned the daily email off gets none; the badge still counts.
- A7 — No module outside `server/notifications/` imports a channel (boundary test).

## Scope
- **Outcome:** any module's event reaches the right person once, by the right channel, within caps.
- **In:** R1–R10, tested by A1–A7.
- **Later:** admin delivery screen (Q8); in-app bell and push (hub parked); a buyer's preferences
  page (hub parked).

## Open questions
None.
