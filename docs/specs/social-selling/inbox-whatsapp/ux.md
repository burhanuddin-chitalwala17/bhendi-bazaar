# UX — social-selling/inbox-whatsapp

- **Status:** Signed off 2026-11-23
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/converse.html](../prototypes/converse.html), sections "WhatsApp", "An order in chat"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [inbox-core ux](../inbox-core/ux.md), [whatsapp-sending ux](../whatsapp-sending/ux.md), [checkout-links ux](../../checkout-links/ux.md)

> The WhatsApp tab. Two things a shop cannot do in the Business app today make it worth opening:
> a cart a buyer sends becomes an order the shop can turn into a checkout link in one tap, at our
> prices; and after 24 hours the box offers the right template with its cost, instead of failing.

## Journeys
1. **Reply.** Row → thread → reply → ticks go Sent, Delivered, Read. The same message appears in
   the shop's Business app.
2. **A cart arrives (A4).** Row "Sent a cart · 3 items" (marked with a cart icon, sorted with Needs
   you) → thread shows the **order card**: each item with photo, size, our price now, and "In stock"
   or "Out of stock · left out"; total we'd charge ("₹4,397 for 2 items"); a note when our price
   differs from what the buyer saw ("Prices are as on your shop today.") → **Send checkout link**
   (pending "Sending…") → the shop's bubble "Here's your checkout link for 2 items" with the link →
   the card shows "Link sent · 12:04" and later "Ordered · BB-7KQ2" when the buyer pays.
3. **After 24 hours (A3).** Box: "Free replies ended 26 h ago. Send a template to restart the chat."
   → **Choose a template** → picker lists approved templates by purpose with the cost each ("about
   ₹0.86 · marketing", "about ₹0.12 · utility") and a preview with the buyer's name filled →
   **Send · ₹0.86** → bubble marked Template.
4. **A send is refused (A6).** "Not sent · You've reached this month's limit of ₹1,000." with
   **Raise limit** (Messaging settings, back here) · or "…no payment method in Meta." with **Add
   payment method** · or "…this buyer hasn't agreed to marketing messages." (no action).
5. **YES, STOP, HINDI.** The buyer's word and consent-core's confirming reply appear in the thread,
   the reply marked Automatic; the details panel shows "Agreed to offers · 22 Nov".
6. **Files.** A photo shows inline; a document as a file row with **Open**; a location as a map
   line with **Open in Maps**; a voice note as a player that plays in the thread (▶ 0:42).

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| WhatsApp tab | Inbox `?tab=whatsapp` | New | R1, R4, R6 |
| Order card | Bubble in the thread | New | R5 |
| Template picker | `ResponsivePicker` from the box (whatsapp-sending's templates) | New | R3 |
| Refusal line | Under a failed bubble | New | R8 |

## State matrix — Order card
| State | What the shop sees | Action |
|---|---|---|
| Ready | Items, our prices, stock, total | Send checkout link |
| Some out of stock | Those rows struck, "Out of stock · left out"; total for the rest | Send checkout link |
| All out of stock | "Nothing in this cart is in stock now." | Reply |
| Price differs | "Prices are as on your shop today." under the total | — |
| Item removed from shop | "No longer sold · left out" | — |
| Sending | Button pending "Sending…" | — |
| Sent | "Link sent · 12:04"; button becomes **Send again** (secondary) | — |
| Ordered | "Ordered · BB-7KQ2" linking to the order | Open order |
| Window closed (over 24 h) | "Free replies ended. Send the link inside a template." | Choose a template |
| Retryable error | "Not sent · WhatsApp didn't answer." | Try again |

## State matrix — WhatsApp specifics
| State | What the shop sees | Action |
|---|---|---|
| Within 24 h | Box free | Send |
| After 24 h | Template line and picker | Choose a template |
| Ticks | ✓ Sent, ✓✓ Delivered, blue ✓✓ Read, "Failed" red | — |
| From the app | "From the app" under the bubble | — |
| No phone number (username only) | Header shows "@username" and "WhatsApp username" in details | — |
| Disconnected / offboarded | Threads readable; box "WhatsApp is disconnected. Reconnect to reply." | Reconnect |

## Copy deck
- "Sent a cart · <n> items", "Send checkout link" → "Sending…", "Here's your checkout link for <n> items", "Link sent · <time>", "Ordered · <order no>".
- "In stock", "Out of stock · left out", "No longer sold · left out", "Prices are as on your shop today."
- "Free replies ended <n> h ago. Send a template to restart the chat.", "Choose a template", "Send · ₹0.86".
- Refusals: "You've reached this month's limit of ₹<n>." · "Add a payment method in Meta to send this." · "This buyer hasn't agreed to marketing messages."

## Sign-off
Signed off by the owner on 2026-11-23, after the senior UX review ([ux-review](../ux-review.md)) and the final cross-feature check.
