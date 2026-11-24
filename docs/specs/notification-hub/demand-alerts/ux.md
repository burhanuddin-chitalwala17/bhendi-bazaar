# UX — notification-hub/demand-alerts

- **Status:** Signed off 2026-11-23
- **Verified:** 2026-11-22
- **Prototype:** [social-selling/prototypes/notify.html](../../social-selling/prototypes/notify.html), sections "Settings", "What a buyer gets"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [hub-marketing ux](../hub-marketing/ux.md), [whatsapp-sending ux](../../social-selling/whatsapp-sending/ux.md)

> Four alerts that sell while the shop sleeps, each a switch with an honest estimate of what it
> costs a month, worked out from the shop's own wishlists and carts. Each tells the shop what it
> did ("sent 23 · 4 orders").

## Journeys
1. **Turn one on (A1).** Notifications → **Alerts to buyers** → four rows: Price drop · Back in
   stock · Left in cart · Auctions; each "Off · about ₹40 a month for your 46 wishlisters" →
   switch on → toast "Price drop alerts are on." → row shows "On · last 30 days: 23 sent · 4 orders".
2. **See what one did.** Tap the row → a sheet: the last alerts with product, sent / skipped (with
   why: "price rose back", "over the how-often limit", "outside shop hours, sent at 10 am") and orders.
3. **The buyer (A1–A4).** "Good news! Black nidha abaya is now ₹1,999 (was ₹2,200) 👇 Buy now" ·
   "Kashmiri shawl is back in stock 👇" · "You left 2 items in your cart 👇 Finish your order" ·
   "You've been outbid on the silver necklace. Current bid ₹4,500 👇".

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Alerts to buyers | Notification settings, section | New | R1 |
| Alert activity | Sheet from a row | New | R6–R8 |

## State matrix — Alerts to buyers
| State | What the shop sees | Action |
|---|---|---|
| First use | Four rows off, each with its estimate | Switch on |
| Not connected | "These go by email until you connect WhatsApp." (they still work by email) | Connect WhatsApp |
| No one opted in | Estimate "₹0 · no opted-in buyers yet" with "Grow your list" link | — |
| On | Last 30 days figures | Open |
| At the spending limit | "WhatsApp alerts paused this month; email continues." | Raise limit |
| Loading | Row skeletons | — |
| Phone / tablet / desktop | Rows; sheet for activity | — |

## Copy deck
- "Alerts to buyers"; rows "Price drop", "Back in stock", "Left in cart", "Auctions".
- "Off · about ₹<n> a month for your <n> <wishlisters/bidders>"; "On · last 30 days: <n> sent · <n> orders".
- Skip reasons "price rose back", "sold out again", "already ordered", "auction closed", "over the how-often limit", "outside shop hours, sent at <time>", "ending-soon alert dropped outside shop hours".
- Buyer texts as in journey 3.

## Sign-off
Signed off by the owner on 2026-11-23, after the senior UX review ([ux-review](../../social-selling/ux-review.md)) and the final cross-feature check.
