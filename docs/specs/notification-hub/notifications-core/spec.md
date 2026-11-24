# Spec — notification-hub/notifications-core

- **Summary:** Any part of the platform tells a shop something by handing the hub an event; the hub delivers it once, by the unread badge and a daily email, or at once by email when it cannot wait, and every module uses this one place from the start
- **Status:** Draft
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [notification-hub](../spec.md) and its [decisions](../decisions.md) (Q1, Q3, Q5, Q7), [social-selling](../../social-selling/spec.md) (Q66, Q108), [ADR-0069](../../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md)

> Requirements and product approach only. Technical approach lives in trd.md. Built in
> social-selling's step 2. Grows out of `server/notifications/`, whose parcel notices already
> write a row first and send once (parent Q7).

## What this feature is
The one way a module tells a shop's members something: a connection needs them, a post failed, a
Status is due, a conversation is waiting. Members see an unread badge at once and a daily email of
what is still waiting; something that cannot wait is emailed at once.

## Why
Without one hub, each module would build its own alerts, worded and timed differently, and the shop
would be told the same thing three ways or not at all (social-selling Q66). Built first, it is
ready for every module that follows.

## Requirements
- R1 — A module tells the hub what happened, for which shop and to whom; it never chooses a channel
  or writes a message (parent Q1).
- R2 — Each notification is delivered once: a repeated event or a retried job tells nobody twice
  (parent Q3).
- R3 — A shop's members see an unread badge for what needs them at once (Q2).
- R4 — Each member gets one email at 9am IST listing what is still waiting (conversations unanswered
  over four hours, failed posts, connections needing them); nothing waiting, no email. A member may
  turn it off; the badge stays (Q2).
- R5 — An event marked as not able to wait (a Status due now) is emailed at once to the shop's
  members, besides the badge (social-selling whatsapp-status-kit Q9).
- R6 — Channels are plugs: email and the badge now; WhatsApp joins through whatsapp-sending; in-app
  and push later, with no change to any module (parent Q1).
- R7 — What was sent, to whom, by which channel and with what outcome is kept 13 months without the
  message body (Q7).
- R8 — Today's parcel notices keep working exactly as they do, now delivered through the hub.

## Hazards the TRD must answer
- **Moving existing parcel notices** onto the hub without a single one lost or sent twice.
- **A storm of events** (a hundred failed posts) becoming one badge count and one email line.

## Product acceptance
- A1 — A connection turning Needs reconnecting raises the badge for every member at once.
- A2 — Two waiting conversations and one failed post appear in the next 9am email; with nothing
  waiting, no email is sent.
- A3 — The same event sent twice raises the badge once.
- A4 — A Status due at 6pm emails the shop's members at 6pm.
- A5 — A parcel notice reaches the buyer as it does today.

## Scope
- **Outcome:** any module tells a shop something once, through one place.
- **In:** R1–R8, tested by A1–A5.
- **Later:** in-app bell and push (parent Q1, social-selling Q109); an admin view of deliveries (Q7).

## Open questions
None.
