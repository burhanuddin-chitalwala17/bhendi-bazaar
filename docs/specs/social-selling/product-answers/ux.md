# UX — social-selling/product-answers

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/converse.html](../prototypes/converse.html), sections "What a buyer sees", "Inbox"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [enquiry-autoreplies ux](../enquiry-autoreplies/ux.md), [inbox-core ux](../inbox-core/ux.md), [checkout-links ux](../../checkout-links/ux.md)

> "Price?" is the most common message a shop gets. The answer is a product card read live, with Buy
> now and See details, sent in seconds. The shop's only screen is a count on the Inbox that opens
> what still needs it; the rest is set with the other automatic replies.

## Journeys
1. **Price on a story (A1).** Buyer replies "price?" to the kurta story → within seconds the
   automatic bubble: "Cotton kurta, indigo · ₹899 (was ₹1,199) · In stock: S, M, L" with the photo,
   **Buy now** and **See details** → buyer taps Buy now, picks M on the size step → checkout with
   that kurta in M (checkout-links).
2. **Which one? (A4).** "Price?" with nothing in view → "Which one do you mean?" with three product
   buttons from recent posts → tap → the card.
3. **Out of stock.** The card says "Out of stock right now" and **Tell me when it's back** → "We'll
   message you when it's back." (kept for notification-hub).
4. **On auction.** "This piece is in an auction right now and not for sale." with **See auction**.
5. **Something it can't answer.** "Is it pure cotton?" with no fabric fact → the greeting's
   handover: "Someone from the shop will reply as soon as they can" and Needs you.
6. **The shop's view (A5).** Inbox top strip, once a day's figures exist: "Yesterday · 18 product
   questions · 15 answered · 3 need you" → tapping "3 need you" filters to them.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Product answer bubble | Thread (as Automatic) | New | R3–R5 |
| Which-one buttons | Thread | New | R2 |
| Daily strip | Inbox list, above the filters | New | R7 |
| Switch | Auto-replies tab, "Answer product questions" with the line "Price, offer, sizes in stock and a Buy link, read live" | New | — |

## State matrix — Daily strip
| State | What the shop sees | Action |
|---|---|---|
| First use | Hidden until a day has figures | — |
| Success | "Yesterday · 18 product questions · 15 answered · 3 need you" | Open each |
| All answered | "Yesterday · 18 product questions · all answered ✓" | — |
| Off | Hidden; Auto-replies tab shows the switch off | — |
| Phone / tablet / desktop | One line that scrolls sideways on a phone; inline from `md:` | — |

## Copy deck
- Card "<name> · ₹<price> (was ₹<list>) · In stock: <sizes>"; buttons "Buy now", "See details".
- "Which one do you mean?"; "Out of stock right now", "Tell me when it's back", "We'll message you when it's back."
- "This piece is in an auction right now and not for sale.", "See auction".
- Strip "Yesterday · <n> product questions · <n> answered · <n> need you".

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
