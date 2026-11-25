# Decisions — social-selling/whatsapp-catalogue

- **Verified:** 2026-11-25

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q2, Q4, Q7, Q12, Q18, Q47, Q66.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q4 | How fresh is the catalogue, and how is it kept a replica? | A change to price, stock, photos, name or archive reaches the catalogue within 15 minutes. Out of stock, or held by a live auction, is listed as out of stock, the same answer as the buy button; an archived product is removed. A full re-send every night repairs anything missed and keeps it a replica: it removes any item that is not one of the shop's live products and overwrites any field changed outside Bhendi Bazaar (in the Business app or Commerce Manager); the connect screen says edits belong in Bhendi Bazaar (parent Q12) | Owner | 2026-11-21 | A WhatsApp buyer sees the item in chat; a stale price there is a promise we break | decided |
| Q5 | How is the catalogue made and switched on? | On connecting WhatsApp, after whatsapp-catalogue-import has settled any catalogue the shop already had (parent Q47): we use that catalogue, or create one in the shop's business account, connect it to the number, and switch the catalogue and the cart on. A sent cart arrives in the WhatsApp inbox as an order card priced from our live prices and is answered with a checkout link, payment and stock staying on our checkout (parent Q97). It is a separate catalogue from the Meta feed, which still serves Facebook and Instagram for a shop that turned it on | Owner | 2026-11-21 | Settling keeps the shop's work and old chat links. was: a catalogue the shop already had stays and is left alone; ours replaces it on the number (Claude · reversible, 2026-11-06) | decided |
| Q8 | What does the shop see, including rejected items? | A line on the WhatsApp card: "142 products in your WhatsApp catalogue · updated 3 min ago", how many were left out and why ("6 need a photo or description"), and Sync now. Each item Meta rejects is listed beneath with Meta's reason (cut to 300 characters) and a link to fix the product; the rest of the catalogue is unaffected | Claude · reversible | 2026-11-06 | Enough to trust it; ADR-0053 advises, never gates | decided |
| Q10 | What happens on disconnect? | The catalogue stays in the shop's account but stops updating; the dialog says so and how to delete it in Commerce Manager. Reconnecting the same number resumes the same catalogue | Claude · reversible | 2026-11-06 | We never delete a shop's asset on Meta; mirrors channel-connectors Q9 | decided |
| Q12 | What is one item? | Each product is its own item; a family's members share an item group id, so WhatsApp shows them as one item with options. An item links to our product page (WhatsApp's "View on website") and carries our product id, so a message can name it (whatsapp-campaigns) | Claude · reversible | 2026-11-06 | ADR-0043: a variant is a product in a family; Meta's `item_group_id` is the same shape | implemented (unit 1) |
| Q14 | May an AI-made picture be an item's image? | Never the main image: it may follow a real photograph. A product whose pictures are all AI-made is left out, counted with why | Claude · reversible | 2026-11-22 | ADR-0077: an AI picture is labelled and secondary on every channel; a WhatsApp item is a listing | implemented (unit 1) |
| Q15 | What does an item carry beyond TRD D1's list? | Also `brand` (the product's brand as the product page names it, handed in by the sync) and `condition: new`, which Meta's catalogue requires of every item; title, description, brand and additional images are cut to Meta's published limits (`meta-limits.ts`; listing's `shopfront-feed-check.ts` keeps its own copy for the feed, as channels' providers are not listing's to import) | Claude · reversible | 2026-11-25 | Without brand Meta refuses the item; the shopfront Meta feed already sends both | implemented (unit 1) |

## Parked (Later)
- A per-product "not on WhatsApp" switch — parent Q47 chose all live products.
- The WhatsApp cart and checkout — parent Q21.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → parent Q47 · Q2 → parent Q47 · Q3 → Q4 · Q6 → Q5 · Q7 → Q12 · Q9 → Q8 · Q11 → Q5 · Q13 → Q4
