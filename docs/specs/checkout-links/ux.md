# UX — checkout-links

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [social-selling/prototypes/links.html](../social-selling/prototypes/links.html)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [inbox-whatsapp ux](../social-selling/inbox-whatsapp/ux.md), [product-answers ux](../social-selling/product-answers/ux.md), the shipped cart and checkout

> The buyer's side only: a link from a chat opens our checkout with the items in the cart, marked,
> at today's prices. The words exist to make three things impossible to miss: what came from the
> link, what was already in the cart, and anything that changed since the link was sent.

## Journeys
1. **Open a link (A1).** Buyer taps the link in WhatsApp → our checkout opens with a strip "From
   your chat with Niqab Boutique" above the two items (each with a small "From your chat" tag), at
   today's prices → address, pay as today.
2. **Something changed (A2).** "Dupatta, green is out of stock and was left out." in an amber note
   above the items; a price that moved shows "Now ₹1,199 (was ₹1,299 when sent)".
3. **Already had things in the cart (A3).** Below the link's items, "Already in your cart" with the
   scarf and **Remove** on each; the total counts all, said plainly.
4. **Opened twice.** Nothing added again; checkout looks the same.
5. **Expired (A4).** The products' pages open with a line "This link has expired. Prices and stock
   are as shown now." and Add to cart as usual. An altered link opens the shop's page with no message.
6. **A size choice.** A product-answers Buy link for a product with sizes opens a small step first:
   "Pick your size" (sizes in stock) → checkout.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Link opener | `/c/<token>` (rate-limited, ADR-0063) → checkout | New | R1, R2, R5, R8 |
| Checkout | Existing; a "From your chat" strip and tags, "Already in your cart" group | Changed | R3, R4 |
| Size step | Small page before checkout | New | R3 |
| Expired line | Product page | Changed | R5 |

## State matrix — Checkout from a link
| State | What the buyer sees | Action |
|---|---|---|
| Ready | Strip, items tagged, today's prices | Pay |
| Some out of stock | Amber note naming them | — |
| All out of stock | "Everything in this link is out of stock now." with the shop's page | Visit shop |
| Price changed | "Now ₹x (was ₹y when sent)" | — |
| Already in cart | Group below, removable | Remove |
| Loading | Checkout skeleton | — |
| Expired | Product pages with the line | Add to cart |
| Altered | Shop page | — |
| Phone / tablet / desktop | As checkout today | — |

## Copy deck
- "From your chat with <shop>", tag "From your chat", "Already in your cart", "Remove".
- "<item> is out of stock and was left out.", "Now ₹<x> (was ₹<y> when sent)".
- "Everything in this link is out of stock now.", "Visit shop".
- "This link has expired. Prices and stock are as shown now."
- "Pick your size".

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
