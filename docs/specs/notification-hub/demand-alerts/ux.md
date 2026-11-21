# UX — notification-hub/demand-alerts

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [../prototype.html](../prototype.html) — journeys 2 (alerts, window, spend) and 4 (local file; publish as a private artifact once a claude.ai login is available)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [hub-core ux](../hub-core/ux.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Nothing is disabled; every string below is the string that ships.

## Journeys
1. **Turn on an alert.** Shop → Notifications → Alerts → Price drop on (cost line read first) → toast "Saved."
2. **Set the window.** Sending window → From / To → saved.
3. **Set the spend limit.** Monthly WhatsApp spend → ₹ amount → Save → meter updates.
4. **A wishlister hears.** Offer starts on a wishlisted product → in the window → WhatsApp "now ₹X
   (was ₹Y)" → View product; outside the window → at its opening, re-checked.
5. **Limit reached.** Spend meets the limit → shop sees it on the card and once on the badge →
   further alerts by email to buyers who allowed it → Raise limit.
6. **Goes wrong.** An alert no longer true at send (price back up, sold out, auction closed,
   ordered) → nothing sent.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Alerts card | Notifications settings | New | R1–R5 |
| Sending window card | Notifications settings | New | R7 |
| Monthly WhatsApp spend card | Notifications settings | New | R8 |
| Alert messages | Buyer's WhatsApp or email | New | R2–R6, R9 |

## State matrix — Alerts, window and spend cards
| State | What the person sees | Action |
|---|---|---|
| First use | Four alerts off with cost estimates; window 9:00 am–9:00 pm; spend limit as set while connecting WhatsApp (social-selling Q8), the same figure as WhatsApp settings | Turn on |
| Empty | No history: "about ₹0 a month (no history yet)" | Turn on |
| Loading | Card skeletons | — |
| Partial | Some alerts on, some off; each row states itself | Each switch |
| Success | Toast "Saved." | — |
| Retryable error | Control returns; "Couldn't save. Try again." | Change again |
| Terminal error | Window "to" before "from": "The window must end after it starts." | Fix the time |
| Refused | WhatsApp not connected: line "Alerts go by email until you connect WhatsApp." with Connect WhatsApp; spend limit card hidden behind the same line | Connect WhatsApp |
| Stale | Spend read on each visit; "updated {time}" under the meter | — |
| Long content | n/a — fixed copy | — |
| Many items | n/a — four alerts | — |
| Slow | Skeletons; "Still loading…" after 3 s | — |
| Limit reached | Meter full; "Limit reached. Alerts go by email until {date}." | Raise limit |
| Phone / tablet / desktop | One column, portal form width | — |

## State matrix — buyer's alert
| State | What the buyer gets | Action |
|---|---|---|
| WhatsApp reachable | One WhatsApp message with a button | View product / Bid again |
| WhatsApp not reachable, email opted in | One email with an unsubscribe link | View product |
| Neither | Nothing | — |
| Outside window | Delivered at opening, if still true | — |
| No longer true | Nothing | — |
| Shop's daily cap reached | Nothing | — |

## Copy deck
- Card: "Alerts to buyers who asked for offers"
- "Price drop" · "Wishlisters hear when the price falls · about ₹{x} a month"
- "Back in stock" · "Wishlisters hear when it's back · about ₹{x} a month"
- "Abandoned cart" · "One reminder an hour after a cart is left · about ₹{x} a month"
- "Auctions" · "Bidders hear when outbid and 1 hour before the end · about ₹{x} a month"
- "about ₹0 a month (no history yet)" · "Alerts go by email until you connect WhatsApp." · "Connect WhatsApp"
- Window: "Sending window" · "From" · "to" · "Alerts outside these hours wait until it opens." · "The window must end after it starts."
- Spend: "Monthly WhatsApp spend" · "₹{spent} of ₹{limit}" · "resets {date}" · "At the limit, alerts go by email to buyers who allowed it." · "Limit reached. Alerts go by email until {date}." · "Raise limit" · badge/digest line "WhatsApp spend limit reached"
- WhatsApp (EN): "Good news, {name}: the {product} on your wishlist is now ₹{new} (was ₹{old})." · "{product} is back in stock. Only a few are in stock, and they're not held for you." · "You left {product} in your cart. It's still available." · "You've been outbid on \"{product}\". Current bid ₹{bid}." · "\"{product}\" ends in 1 hour. Current bid ₹{bid}." · buttons "View product" / "Bid again" / "View cart" · footer "Reply STOP to stop offers from {shop}."
- Hindi versions of each, from whatsapp-templates' starter set (social-selling Q37).
- Email: same sentences; subject = first sentence; footer unsubscribe (hub-core copy).

## Sign-off
Awaiting the owner's review.
