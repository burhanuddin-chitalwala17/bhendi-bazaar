# Decisions — social-selling/product-answers

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only
> implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q7, Q47, Q89, Q108.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | How is a message tied to a product? | Only by something concrete: a story reply, a post's comment-to-DM thread, a shared post, a product link, or a catalogue item. With none, up to three likely products are offered as buttons (from recent posts and the words used); a product is never assumed | Claude · reversible | 2026-11-22 | A wrong product answered confidently is a wrong price (parent Q89) | decided |
| Q2 | Where does the Buy button go? | Straight to checkout holding that product and size, through checkout-links, with a "See details" link to the product page beside it | Owner | 2026-11-22 | One tap from question to paying is the point; the page stays one tap away for the careful buyer | decided |
| Q3 | What happens when a product asked about is out of stock? | The answer says so and offers "Tell me when it's back"; a yes is kept, with the buyer's consent for that one message, and sent by notification-hub's back-in-stock alert once that exists | Owner | 2026-11-22 | Turns a lost sale into a later one, inside consent | decided |
