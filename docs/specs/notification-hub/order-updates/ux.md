# UX — notification-hub/order-updates

- **Status:** Signed off 2026-11-23
- **Verified:** 2026-11-22
- **Prototype:** [social-selling/prototypes/notify.html](../../social-selling/prototypes/notify.html), sections "Settings", "What a buyer gets"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [whatsapp-sending ux](../../social-selling/whatsapp-sending/ux.md)

> One switch with its price beside it. Buyers who agreed get order confirmed, shipped and delivered
> on WhatsApp, where they actually look; the receipt and everyone else stay on email as today.

## Journeys
1. **Turn it on (A1).** Shop details → **Notifications** → card **Order updates on WhatsApp** · Off
   → body "Buyers who agreed to WhatsApp get confirmed, shipped and delivered there. About ₹0.12 a
   message, billed by Meta. Everyone else gets email, as now." → **Turn on** (pending) → On, and the
   card adds "This month · 84 sent · ₹10.08".
2. **Not connected.** The card reads "Connect WhatsApp to send order updates there." with
   **Connect WhatsApp**; returns here.
3. **The buyer (A1, A3).** WhatsApp: "Your order BB-7KQ2 is confirmed ✓" → "Shipped 🚚 Track:
   <link>" → "Delivered. Enjoy! 🌙"; the receipt by email. Undelivered in 15 min: the email follows.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Order updates card | Notification settings | New | R1, R5 |
| Buyer messages | WhatsApp, the starter utility templates | New | R2, R3 |

## State matrix — Order updates card
| State | What the shop sees | Action |
|---|---|---|
| Off | Body with the price | Turn on |
| Not connected | Connect line | Connect WhatsApp |
| Template in review | "Your order update template is in review with WhatsApp. Updates go by email until it's approved." | — |
| On | Counts and cost this month | Turn off |
| At the spending limit | "Paused · monthly limit reached. Updates go by email." | Raise limit |
| Retryable error | "Couldn't save. Try again." | Try again |

## Copy deck
- "Order updates on WhatsApp", body as above, "Turn on" → "Turning on…", toast "Order updates on WhatsApp are on."
- "This month · <n> sent · ₹<x>".
- Buyer EN: "Your order <no> is confirmed ✓" · "Shipped 🚚 Track: <link>" · "Delivered. Enjoy! 🌙"; HI versions in the starter templates.

## Sign-off
Signed off by the owner on 2026-11-23, after the senior UX review ([ux-review](../../social-selling/ux-review.md)) and the final cross-feature check.
