# Spec — notification-hub (overview)

- **Summary:** One place every module sends what a person should hear about, and one place that decides how it reaches them — email, WhatsApp or the unread badge — within consent and each shop's caps
- **Status:** Draft
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [social-selling](../social-selling/spec.md) and its [decisions](../social-selling/decisions.md) (Q18, Q40, Q61, Q66), [ADR-0069](../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md), [server/notifications/CLAUDE.md](../../../server/notifications/CLAUDE.md)

> The parent of the subfeatures below. Each has its own spec, decisions, UX and TRD. This file
> holds only the model they share and their order. Built alongside social-selling, whose first
> user it is, and decoupled from it (social-selling Q66).

## What this is
Today each module that needs to tell someone something sends its own email. This makes telling
someone one act: a module says *what happened and to whom*; the hub decides *how* — which channel,
whether consent allows it, whether a cap has been reached, and when the shop's window opens.

## Why
Social selling is of no use without notifications: a waiting DM, a failed post and a buyer's
price-drop alert all have to reach someone. But a shop's order emails, a buyer's outbid email and
the coming "Notify me" are the same act. Built once as a hub, a new channel (in-app, push) is one
plug, and a new module is one event, without either knowing about the other.

## The model every subfeature follows
- **A module emits an event; it never picks a channel (Q1).** An event names its kind, its
  audience (shop, buyer, admin), the shop it concerns and its facts. Social-selling emits
  conversation waiting, post failed, connection needs you and post due (social-selling Q66, Q18).
- **A channel is a plug (Q1).** Email (existing), WhatsApp (social-selling's campaigns send port,
  which owns WhatsApp consent, STOP, spend cap and WhatsApp's frequency cap — social-selling Q40)
  and the unread badge. In-app bell and push are later plugs (social-selling Q66).
- **Every delivery is a row first (Q3)**, unique per event and recipient, so a repeated event or a
  redelivered job tells no one twice — the rule `Notice` already follows for parcels.
- **Marketing reaches a buyer once (social-selling Q66):** by WhatsApp when it can, else by email
  when the buyer opted in to email. Every marketing email carries an unsubscribe link.
- **A global cap sits over every channel (social-selling Q40):** marketing messages per buyer
  per shop per day, default 3, set by the shop; the global cap wins. Order updates are exempt.
- **The shop decides what costs it money (social-selling Q8, Q61):** order updates on WhatsApp
  and each demand alert are off until the shop turns them on, with a monthly spend cap.

## Subfeatures, in order
| # | Subfeature | Outcome | Needs | Domain |
|---|---|---|---|---|
| 1 | hub-core | Events in, channels as plugs, delivery rows, consent and the global cap, the badge and the daily digest | — | notifications |
| 2 | order-updates | Confirmed, shipped and delivered reach the buyer by WhatsApp or email; parcel notices move onto the hub | 1, social-selling 13 | notifications |
| 3 | demand-alerts | Price drop, back in stock, abandoned cart and auction alerts, each switched on by the shop, within its window and caps | 1, social-selling 5, 13 | notifications |

Future users, not built here: "Notify me" (social-selling Q54) sends through the hub as its own
vertical; in-app and push are plugs (Q1).

## Product acceptance
- A1 — A buyer DM unanswered for four hours appears in the shop's next daily email and on the
  unread badge, with no code in social-selling that knows email exists.
- A2 — A buyer opted in to WhatsApp gets "Shipped" on WhatsApp; if it is not delivered within
  15 minutes, the same update arrives by email. The receipt email always arrives.
- A3 — A price drop reaches a wishlister once — by WhatsApp, or by email when WhatsApp cannot —
  and never a fourth marketing message from that shop that day.
- A4 — With price-drop alerts off, nothing is sent and nothing is charged.

## Open questions
None at the overview. Each subfeature lists its own.
