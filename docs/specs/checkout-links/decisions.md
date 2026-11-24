# Decisions — checkout-links

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only
> implemented ones ([ADR-0062](../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Binding here: social-selling Q97, Q108; Invariant 1.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | How long does a link work? | 7 days; an edited link opens nothing but the shop's page, an expired one the products' pages with a line saying so | Owner | 2026-11-22 | Long enough for a buyer who replies the next weekend; short enough that old prices and stock are not promised | decided |
| Q2 | Does a link add to the buyer's cart or open checkout on its own? | It adds its items to the buyer's cart and opens checkout. Opening the same link again adds nothing more; checkout marks the items that came from the link and shows what else was already in the cart, each removable, so nothing is paid for unseen | Owner | 2026-11-22 | The owner: one cart, the buyer's own. was: recommended a separate buy-now checkout leaving the cart untouched | decided |
| Q3 | Is a link's source recorded? | Yes: where it was made (inbox order, automatic answer, campaign) and the order it became, nothing reported yet | Claude · reversible | 2026-11-22 | Costs one field now; makes "sales per message" (social-selling Q108) possible later without guessing | decided |
