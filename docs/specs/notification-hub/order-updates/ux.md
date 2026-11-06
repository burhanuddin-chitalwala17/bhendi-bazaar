# UX — notification-hub/order-updates

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [../prototype.html](../prototype.html) — journeys 2 (order card) and 3 (local file; publish as a private artifact once a claude.ai login is available)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [hub-core ux](../hub-core/ux.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Nothing is disabled; every string below is the string that ships.

## Journeys
1. **Turn on.** Shop → Notifications → Order updates on WhatsApp → on → toast "Saved."; this
   month's count starts.
2. **A buyer's order ships.** Payment → receipt email (always) → shipped → WhatsApp "has shipped"
   with tracking → delivered → WhatsApp "Delivered today".
3. **WhatsApp can't reach them.** Not opted in, STOPped, or not delivered in 15 minutes → the same
   update by email, once.
4. **No WhatsApp yet.** The card says how to connect → Connect WhatsApp → Channels.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Order updates card | Notifications settings | New | R1, R7 |
| WhatsApp order messages | Buyer's WhatsApp | New | R2 |
| Order and parcel emails | Email | Unchanged words, new path | R3, R4, R6 |

## State matrix — Order updates card
| State | What the person sees | Action |
|---|---|---|
| First use | Switch off; cost line; "This month: 0 messages · ₹0" | Turn on |
| Empty | WhatsApp not connected: "Connect WhatsApp to send order updates there." | Connect WhatsApp |
| Loading | Card skeleton | — |
| Partial | n/a — one switch | — |
| Success | Switch on; toast "Saved." | — |
| Retryable error | Switch returns; "Couldn't save. Try again." | Change again |
| Terminal error | n/a | — |
| Refused | WhatsApp needs reconnecting: switch stays, line "WhatsApp needs reconnecting. Updates go by email until then." | Reconnect |
| Stale | Month count read on each visit | — |
| Long content | n/a — fixed copy | — |
| Many items | Count above 9,999 shows "9,999+" | — |
| Slow | Skeleton; "Still loading…" after 3 s | — |
| Phone / tablet / desktop | One column, portal form width | — |

## State matrix — buyer's messages
| State | What the buyer gets | Action |
|---|---|---|
| Switch on, opted in | WhatsApp confirmed, shipped (tracking), delivered | Track |
| Switch off / not opted in | Emails, as today | — |
| Not delivered in 15 min | That update by email; a late WhatsApp delivery sends nothing more | — |
| Hindi chosen | The same three in Hindi | — |
| Receipt | Email always | — |

## Copy deck
- Card: "Order updates on WhatsApp" · "Confirmed, shipped, delivered. About ₹0.12 per message, billed to your WhatsApp account by Meta." · "This month: {n} messages · ₹{x}"
- Not connected: "Connect WhatsApp to send order updates there." · button "Connect WhatsApp"
- Needs reconnecting: "WhatsApp needs reconnecting. Updates go by email until then." · "Reconnect"
- WhatsApp (EN): "Hi {name}, your order {code} is confirmed. We'll message you when it ships." · "Hi {name}, your order {code} has shipped. Track it: {link}" · "Delivered today. Thank you for shopping with {shop}."
- WhatsApp (HI): "नमस्ते {name}, आपका ऑर्डर {code} कन्फ़र्म हो गया है। भेजते ही हम आपको बताएँगे।" · "नमस्ते {name}, आपका ऑर्डर {code} भेज दिया गया है। ट्रैक करें: {link}" · "आज डिलीवर हो गया। {shop} से ख़रीदारी के लिए धन्यवाद।"
- Emails: unchanged.

## Sign-off
Awaiting the owner's review.
