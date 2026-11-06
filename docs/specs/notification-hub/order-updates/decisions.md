# Decisions — notification-hub/order-updates

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Ids here are this subfeature's own; "hub Qn" means [../decisions.md](../decisions.md), "social-selling Qn"
> means [../../social-selling/decisions.md](../../social-selling/decisions.md). Binding: hub Q1–Q5;
> social-selling Q33, Q61, Q65, Q71, Q72.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which events go to WhatsApp when the shop turns updates on? | Order confirmed, shipped (with tracking) and delivered (social-selling Q61). Each a utility template from the starter set, in the buyer's language (social-selling Q65) | Owner | 2026-11-06 | The three a buyer waits for | decided |
| Q2 | Who receives a WhatsApp order update? | A buyer whose phone is opted in to WhatsApp from that shop (or Bhendi Bazaar, social-selling Q27) and whose shop has the switch on (social-selling Q33) | Claude · reversible | 2026-11-06 | Meta requires opt-in for business-initiated messages | decided |
| Q3 | When does email take over? | When WhatsApp cannot reach the buyer, or the WhatsApp message is not delivered within 15 minutes (social-selling Q72); the receipt email always goes regardless | Owner | 2026-11-06 | No doubling up, nothing lost | decided |
| Q4 | Which existing parcel notices move onto the hub? | All of them (`NOTICE_KIND`), shop and admin ones included; only the three buyer events above gain WhatsApp. Their words and templates stay as they are | Claude · reversible | 2026-11-06 | social-selling Q71: one path per event; moving all avoids two paths for one table | decided |
| Q5 | Does the shop see the cost? | Yes: beside the switch, "About ₹0.12 per message, billed to your WhatsApp account by Meta", and this month's count and cost on the same card. Cost read from the WhatsApp channel (paise) | Claude · reversible | 2026-11-06 | social-selling Q8, Q33: the shop chooses knowing the cost | decided |
| Q6 | Is the receipt email moved onto the hub? | Yes, as a transactional event with email as its only channel | Claude · reversible | 2026-11-06 | One path for everything that tells a buyer | decided |
| Q7 | Do order updates count against the global cap or WhatsApp's frequency cap? | No: utility messages are exempt from both (social-selling Q70) | Claude · reversible | 2026-11-06 | A buyer must hear their order shipped | decided |
| Q8 | Where is the switch? | On the shop's Notifications settings page (hub-core Q4), card "Order updates on WhatsApp"; shown only once WhatsApp is connected, else the card says "Connect WhatsApp to send order updates there" with the link | Claude · reversible | 2026-11-06 | One settings page; ADR-0053 never-disable | decided |

## Parked (Later)
- Cancelled and refunded on WhatsApp — email only for now (social-selling Q61).
