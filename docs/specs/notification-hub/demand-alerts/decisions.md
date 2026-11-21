# Decisions — notification-hub/demand-alerts

- **Verified:** 2026-11-21

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Ids here are this subfeature's own; "hub Qn" means [../decisions.md](../decisions.md),
> "social-selling Qn" means [../../social-selling/decisions.md](../../social-selling/decisions.md).
> Binding: hub Q1, Q3, Q5, Q6; social-selling Q8, Q9, Q37, Q40, Q54, Q66.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q6 | How is "audience is a rule" built for auctions? | Each alert's audience is a named rule in a closed set (`bidders`, later `followers`); switching auctions to all opted-in followers is a rule choice, no new code path | Claude · reversible | 2026-11-06 | social-selling Q54 | decided |
| Q7 | What if an alert cannot go as planned: changed facts, the cap, the window? | Every alert is re-checked at send: a price that rose back, a product sold out again or archived, an auction closed or a cart ordered is skipped with its reason. At the shop's monthly WhatsApp spend cap (social-selling Q8, kept by the WhatsApp channel) WhatsApp alerts stop for the month and fall to email where the buyer opted in, and the shop is told once. Alerts go only inside the shop's daily window (default 9am to 9pm IST) and otherwise wait until it opens (social-selling Q40); an auction "ending in an hour" that falls outside the window is dropped, not delayed | Owner | 2026-11-06 | An alert must be true when it arrives | decided |
| Q8 | How often may one product alert one buyer? | Price drop: at most one a day per product per buyer, besides the shop's caps; back in stock: once per restock | Claude · reversible | 2026-11-06 | Any fall alerts (social-selling Q54); a price edited twice in an hour must not alert twice | decided |

## Parked (Later)
- "Notify me" — its own vertical, sending through the hub (social-selling Q54).
- Auction audience `followers` — a rule switch when the owner asks (Q6).

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → social-selling Q54 · Q2 → social-selling Q54 · Q3 → social-selling Q8 · Q4 → Q7 · Q5 → Q7 · Q9 → parent Q6 · Q10 → social-selling Q9
