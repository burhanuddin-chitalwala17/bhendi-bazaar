# UX — social-selling/whatsapp-catalogue

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/connect.html](../prototypes/connect.html), section "Your WhatsApp catalogue"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md), [bulk-publish ux](../../bulk-publish/ux.md)

> Automatic by design: the shop never edits the catalogue. Its whole surface is one line on the
> WhatsApp card, a details view of what is left out or refused, and the fix-many flow bulk-publish
> provides. What a buyer sees is WhatsApp's own catalogue screen.

## Journeys
1. **It just works.** After settling (or at connect with nothing to settle), the card reads
   "142 products in your WhatsApp catalogue · updated 3 min ago". A price changed on a product page
   reaches WhatsApp within 15 minutes; nobody taps anything.
2. **Some are left out.** The card adds "6 left out · Fix" → **Fix** opens bulk-publish's WhatsApp
   screen, grouped by reason ("4 need a photo", "2 have only AI-made pictures") → fix many at once →
   back on the card the count drops on the next update.
3. **Meta refuses one.** "1 refused by WhatsApp" → the details list shows Meta's reason in our
   words and **Fix product** → product form → saved → it goes again.
4. **Sync now.** Card → **Sync now** (pending "Syncing…") → "Updated just now."
5. **A buyer's view.** In WhatsApp the shop icon opens the catalogue: items at page prices, out of
   stock marked, families as one item with options; a buyer adds to cart and sends it; the shop sees
   an order card in the Inbox (inbox-whatsapp).

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Catalogue line on the WhatsApp card | Channels | New | R9 |
| Catalogue details | `HandoffSheet` from the line (phone) / panel (desktop) | New | R1, R8–R10 |
| Fix flow | bulk-publish's WhatsApp screen | Reused | R10 |

## State matrix — Catalogue line and details
| State | What the shop sees | Action |
|---|---|---|
| First use | Right after setup: "Adding your products to WhatsApp · 40 of 142" with progress | — |
| Empty | No live product: "No products in your catalogue yet. Products live on your shop page appear here by themselves." | Add a product |
| Loading | Line skeleton | — |
| Partial | "142 in your catalogue · 6 left out" | Fix |
| Success | "142 products in your WhatsApp catalogue · updated 3 min ago" | Sync now |
| Retryable error | WhatsApp down: "Couldn't update WhatsApp. We'll keep trying; your catalogue shows what it had." | Sync now |
| Terminal error | Number disconnected: "Updates stopped. Your catalogue stays in WhatsApp as it was." | Reconnect |
| Refused | Items refused: listed in details with Meta's reason and Fix product | Fix product |
| Stale | Last update over an hour while changes wait: amber "updated 2 h ago · 5 changes waiting" | Sync now |
| Long content | Reasons cut to 300 characters, tap for the rest | — |
| Many items | Details list grouped by reason, each group collapsible | — |
| Slow | Sync now past 3 s: "Still syncing…" | — |
| Phone / tablet / desktop | Sheet on a phone; side panel from `lg:` | — |

## Copy deck
- "<N> products in your WhatsApp catalogue · updated <time>"
- "<N> left out · Fix"; reasons "needs a photo", "needs a description", "has only AI-made pictures" (R8), "out of your shop page" never shown (not live means not in).
- "Sync now" → "Syncing…" → "Updated just now."
- Details title "What's in your WhatsApp catalogue"; groups "In your catalogue", "Left out", "Refused by WhatsApp".
- Disconnect note in the WhatsApp dialog: "Your catalogue stops updating and stays in your WhatsApp account as it was."

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
