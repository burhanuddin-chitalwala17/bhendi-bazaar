# Decisions — social-selling/whatsapp-catalogue

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q4, Q7, Q12, Q15, Q18, Q38, Q47, Q66, Q79–Q81.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which products are in the catalogue? | Every product live on the shop's store page: not archived, from a trading shop, with a photo and a description. No per-product toggle (parent Q47) | Owner | 2026-11-06 | Parent Q47; what a channel rejects is left out, as the feeds do | decided |
| Q2 | At what price? | The price the product page shows at that moment, offer included, from the one effective-price function; the list price beside it when an offer is in force | Owner | 2026-11-06 | Parent Q47; ADR-0018 | decided |
| Q3 | What does out of stock or up for bidding look like? | Listed as out of stock, not removed; an archived product is removed. Same answer as the buy button | Claude · reversible | 2026-11-06 | Matches the feeds (shopfront-feeds D4) and WhatsApp shows out-of-stock items greyed | decided |
| Q4 | How fresh must it be? | A change to price, stock, photos, name or archive reaches the catalogue within 15 minutes; a full re-send every night repairs anything missed | Claude · reversible | 2026-11-06 | A WhatsApp buyer sees the item in chat; a stale price there is a promise we break | decided |
| Q5 | Is the catalogue made for the shop? | Yes, on connecting WhatsApp, after the shop's existing catalogue (if any) is settled by whatsapp-catalogue-import (parent Q101): we use that catalogue, or create one in the shop's business account when there is none, connect it to the number, and switch the catalogue and cart on in WhatsApp's commerce settings | Owner | 2026-11-21 | Settling keeps the shop's work and old chat links. was: a catalogue the shop already had stays and is left alone; ours replaces it on the number (Claude · reversible, 2026-11-06) | decided |
| Q6 | Is the WhatsApp cart switched on? | On. A cart the buyer sends arrives in the WhatsApp inbox as an order card priced from our live prices, answered with a checkout link on Bhendi Bazaar (parent Q97); payment and stock stay on our checkout | Owner | 2026-11-21 | The order card removes the retyping the cart used to cost. was: Off, since a cart order would arrive as a chat the shop retypes (Claude · reversible, 2026-11-06) | decided |
| Q7 | Where does a buyer go from an item? | The item's link is our product page (opened from WhatsApp's "View on website"); the item also carries our product id so a message can name it (whatsapp-campaigns) | Claude · reversible | 2026-11-06 | The sale completes here (ADR-0041's shopfront reasoning, parent Q15) | decided |
| Q8 | What does the shop see? | A WhatsApp catalogue line on the WhatsApp card: "142 products in your WhatsApp catalogue · updated 3 min ago", the count left out and why ("6 need a photo or description"), and Sync now | Claude · reversible | 2026-11-06 | Enough to trust it; ADR-0053 advises, never gates | decided |
| Q9 | What if Meta rejects items? | Each rejected item is listed under the WhatsApp card with Meta's reason, cut to 300 characters, and a link to fix the product; the rest of the catalogue is unaffected | Claude · reversible | 2026-11-06 | Same exception channels allows marketplaces (marketplace-publish Q6) | decided |
| Q10 | What happens on disconnect? | The catalogue stays in the shop's account but stops updating; the dialog says so and how to delete it in Commerce Manager. Reconnecting the same number resumes the same catalogue | Claude · reversible | 2026-11-06 | We never delete a shop's asset on Meta; mirrors channel-connectors Q9 | decided |
| Q11 | Does the Meta feed card (shopfront feed) change? | No. The feed still serves Facebook and Instagram shops for a shop that turned it on; the WhatsApp catalogue is a separate catalogue in the shop's own account | Claude · reversible | 2026-11-06 | One catalogue per WhatsApp account, owned by the shop; the feed is ours | decided |
| Q12 | Variants? | Each product is its own item; a family's members share an item group id so WhatsApp shows them as one item with options | Claude · reversible | 2026-11-06 | ADR-0043: a variant is a product in a family; Meta's `item_group_id` is the same shape | decided |
| Q13 | Is the catalogue ever edited outside Bhendi Bazaar? | No: it is a replica of the shop's live products. The nightly full push also removes any item that is not one of the shop's live products and overwrites any field changed outside Bhendi Bazaar (in the Business app or Commerce Manager); the connect disclaimer says edits belong in Bhendi Bazaar (parent Q38) | Owner | 2026-11-21 | One source of truth; a hand edit would show a price or item the store page does not | decided |

## Parked (Later)
- A per-product "not on WhatsApp" switch — parent Q47 chose all live products.
- The WhatsApp cart and checkout — parent Q24.
