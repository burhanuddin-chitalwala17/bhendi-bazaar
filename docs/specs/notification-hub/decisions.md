# Decisions — notification-hub

- **Verified:** 2026-11-25

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. "social-selling Qn" means
> [../social-selling/decisions.md](../social-selling/decisions.md); binding here: social-selling Q8,
> Q9, Q18, Q27, Q37, Q40, Q54, Q61, Q66. Subfeatures cite these ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | How is the hub built? | The hub picks the channel, never the emitting module: a module emits an event (kind, audience, the shop it concerns, the recipient, its facts) and the hub decides how it is delivered. Each channel is a plug implementing one port (`deliver`, `status`): email, WhatsApp and the badge at launch, in-app and push later, with no change to any module. The hub grows inside `server/notifications/`, no new domain, and email stays its plug | Claude · reversible | 2026-11-06 | social-selling Q66: decoupled, plug in and out | decided |
| Q3 | How is a double send prevented? | Every delivery is a row first, unique per (event key, recipient, channel), written in the emitter's transaction; only a new row enqueues the send, keyed on the row id | Claude · reversible | 2026-11-06 | The existing `Notice` rule (order-fulfilment D8), generalised | implemented (notifications-core unit 1) |
| Q5 | In what order is the hub built? | notifications-core in social-selling's step 2, so every module tells the shop through it from the start; hub-marketing, order-updates and demand-alerts in step 7 (social-selling Q107). The WhatsApp channel is whatsapp-sending, built in step 5 | Owner | 2026-11-22 | social-selling Q108's re-cut. was: hub-core, then order-updates, then demand-alerts, all in step 7 | decided |
| Q6 | Does the existing outbid email move onto the hub? | Yes, in demand-alerts: it becomes the auction outbid event, delivered by WhatsApp or email under the same rules. A bidder opted in to neither still gets the outbid email as today, as a transactional message | Claude · reversible | 2026-11-21 | One path per event (social-selling Q61's reasoning) | decided |
| Q7 | How is hub-core cut? | In two: notifications-core (events in, the channel plugs, delivery once, the unread badge, the daily email; built in social-selling's step 2, so every module tells the shop through it from the start) and hub-marketing (a buyer reached once by WhatsApp else email, the global cap, the unsubscribe link; built in step 7 with order-updates and demand-alerts). It grows out of `server/notifications/`'s Notice rows, which already write a row first and send once | Owner | 2026-11-21 | social-selling Q108; shop alerts were needed from step 2 but built in step 7 | decided |

## Parked (Later)
- In-app bell and push channels — plugs (Q1); the in-app branch (PR #57) stays as it is (social-selling Q66).
- A buyer's notification preferences page — consent and STOP per channel suffice for now.
- "Notify me" — its own vertical, a future user of the hub (social-selling Q54).

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q2 → Q1 · Q4 → Q1
