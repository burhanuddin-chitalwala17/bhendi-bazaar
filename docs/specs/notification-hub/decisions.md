# Decisions — notification-hub

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. "social-selling Qn" means
> [../social-selling/decisions.md](../social-selling/decisions.md); binding here: social-selling Q9,
> Q27, Q32, Q33, Q40, Q41, Q54–Q57, Q60–Q62, Q65–Q74. Subfeatures cite these ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Who picks the channel for a notification? | The hub, never the emitting module. A module emits an event: kind, audience, the shop it concerns, the recipient, its facts | Claude · reversible | 2026-11-06 | social-selling Q66: decoupled, plug in and out | decided |
| Q2 | How is a channel added? | As a plug implementing one port (`deliver`, `status`); email, WhatsApp and the badge at launch, in-app and push later with no change to any module | Claude · reversible | 2026-11-06 | social-selling Q69 | decided |
| Q3 | How is a double send prevented? | Every delivery is a row first, unique per (event key, recipient, channel), written in the emitter's transaction; only a new row enqueues the send, keyed on the row id | Claude · reversible | 2026-11-06 | The existing `Notice` rule (order-fulfilment D8), generalised | decided |
| Q4 | Where does the hub live? | It grows inside `server/notifications/`; no new domain. Email stays its plug | Claude · reversible | 2026-11-06 | One home for telling people things; ADR-0012 | decided |
| Q5 | Which order: hub-core, order-updates, demand-alerts? | As listed; order-updates and demand-alerts need social-selling's campaigns send port (social-selling subfeature 13) for WhatsApp, and can ship email-only before it | Claude · reversible | 2026-11-06 | "Needs" is the only ordering | decided |
| Q6 | Does the existing outbid email move onto the hub? | Yes, in demand-alerts: it becomes the auction "outbid" event, delivered by WhatsApp or email under the same rules | Claude · reversible | 2026-11-06 | One path per event (social-selling Q71's reasoning) | decided |

## Parked (Later)
- In-app bell and push channels — plugs (Q2); the in-app branch (PR #57) stays as it is (social-selling Q69).
- A buyer's notification preferences page — consent and STOP per channel suffice for now.
- "Notify me" — its own vertical, a future user of the hub (social-selling Q60).
