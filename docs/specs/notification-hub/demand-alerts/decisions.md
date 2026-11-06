# Decisions — notification-hub/demand-alerts

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Ids here are this subfeature's own; "hub Qn" means [../decisions.md](../decisions.md), "social-selling Qn"
> means [../../social-selling/decisions.md](../../social-selling/decisions.md). Binding: hub Q1–Q6;
> social-selling Q9, Q32, Q40, Q54–Q58, Q60, Q65, Q68, Q70, Q73, Q74.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which alerts? | Price drop, back in stock, abandoned cart, auction outbid, auction ending in an hour | Owner | 2026-11-06 | social-selling Q54, Q56, Q57, Q60 | decided |
| Q2 | Who gets each? | Price drop: opted-in wishlisters, on any fall of the effective price (social-selling Q56). Back in stock: opted-in wishlisters (Q60). Abandoned cart: an opted-in signed-in buyer, once, an hour after the cart was left, never if they ordered (Q54). Auction: opted-in bidders, outbid and ending in an hour (Q57) | Owner | 2026-11-06 | As decided in social-selling | decided |
| Q3 | Are they on by default? | Each off until the shop turns it on, with its estimated monthly cost shown (social-selling Q32) | Owner | 2026-11-06 | The shop pays | decided |
| Q4 | How is spend capped? | A monthly WhatsApp spend cap in rupees, stored in paise, set by the shop, kept by the WhatsApp channel (social-selling Q68). At the cap, WhatsApp alerts stop for the month and fall to email where the buyer opted in; the shop is told once (a hub shop event) | Owner | 2026-11-06 | social-selling Q32, Q68, Q73 | decided |
| Q5 | When are alerts delivered? | Inside the shop's daily window, default 9am to 9pm IST, set by the shop; outside it they wait until it opens (social-selling Q55). An auction "ending in an hour" outside the window is dropped, not delayed | Owner | 2026-11-06 | Owner confirmed dropping a late "ending soon" | decided |
| Q6 | How is "audience is a rule" built for auctions? | Each alert's audience is a named rule in a closed set (`bidders`, later `followers`); switching auctions to all opted-in followers is a rule choice, no new code path | Claude · reversible | 2026-11-06 | social-selling Q57 | decided |
| Q7 | What does an alert do when a product changes again before delivery? | Re-checked at send: a price that rose back, a product sold out again or archived, an auction closed or a cart ordered → skipped with its reason | Claude · reversible | 2026-11-06 | An alert must be true when it arrives | decided |
| Q8 | How often may one product alert one buyer? | Price drop: at most one a day per product per buyer, besides the shop's caps; back in stock: once per restock | Claude · reversible | 2026-11-06 | Any fall alerts (Q56); a price edited twice in an hour must not alert twice | decided |
| Q9 | Does the existing outbid email move here? | Yes (hub Q6): outbid becomes this alert. A bidder not opted in to WhatsApp or marketing email still gets the outbid email as today, as a transactional message | Claude · reversible | 2026-11-06 | Bidders already get it; consent applies to marketing, not to their own bid | decided |
| Q10 | Which unsubscribed or stopped buyers are counted? | None: a stopped or unsubscribed channel is skipped (social-selling Q62, hub-core Q5) | Claude · reversible | 2026-11-06 | Consent first | decided |

## Parked (Later)
- "Notify me" — its own vertical, sending through the hub (social-selling Q60).
- Auction audience `followers` — a rule switch when the owner asks (Q6).
