# Decisions — notification-hub/order-updates

- **Verified:** 2026-11-21

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Ids here are this subfeature's own; "hub Qn" means [../decisions.md](../decisions.md),
> "social-selling Qn" means [../../social-selling/decisions.md](../../social-selling/decisions.md).
> Binding: hub Q1, Q3, Q5; social-selling Q37, Q61.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q4 | Which notices move onto the hub? | All existing notices (`NOTICE_KIND`), shop and admin ones included, with their words and templates unchanged, plus the order receipt as a transactional event whose only channel is email. Only the three buyer events (confirmed, shipped, delivered) gain WhatsApp | Claude · reversible | 2026-11-06 | social-selling Q61: one path per event; moving all avoids two paths for one table | decided |
| Q5 | Where is the WhatsApp switch, and does the shop see the cost? | A card "Order updates on WhatsApp" on the shop's Notifications settings page (hub-marketing Q2), shown once WhatsApp is connected (before that it says "Connect WhatsApp to send order updates there" with the link). Beside the switch: "About ₹0.12 per message, billed to your WhatsApp account by Meta", and this month's count and cost, read from the WhatsApp channel in paise | Claude · reversible | 2026-11-06 | social-selling Q8, Q61: the shop chooses knowing the cost | decided |

## Parked (Later)
- Cancelled and refunded on WhatsApp — email only for now (social-selling Q61).

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → social-selling Q61 · Q2 → social-selling Q61 · Q3 → social-selling Q61 · Q6 → Q4 · Q7 → social-selling Q40 · Q8 → Q5
