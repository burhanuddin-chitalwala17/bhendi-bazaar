# UX — notification-hub/notifications-core

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [social-selling/prototypes/notify.html](../../social-selling/prototypes/notify.html), sections "The badge", "The morning email", "Settings"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [social-selling ux-patterns](../../social-selling/ux-patterns.md), [whatsapp-status-kit ux](../../social-selling/whatsapp-status-kit/ux.md)

> How the shop is told, kept quiet: a badge for what needs it now, one email a morning for what is
> still waiting, and an email at once only for the one thing that cannot wait (a Status due). Every
> item opens the screen that fixes it and disappears once fixed: nothing to mark read by hand.

## Journeys
1. **Something needs me now (A1).** Portal header bell shows a dot and "2" → tap → sheet "Needs
   you": "Instagram needs reconnecting" · "A post failed: Eid edit" → tap one → its screen (Channels
   card, post detail) → fixed → the item leaves the list and the count falls.
2. **The morning email (A2).** 9:00 am: subject "3 things are waiting at Niqab Boutique" → body
   lists "2 messages waiting over 4 hours", "1 post failed" each with a button → opens the screen
   (signed in, else sign in and continue there). Nothing waiting: no email.
3. **At once (A4).** A Status due: email "Your Status is ready to post" at the minute
   (whatsapp-status-kit).
4. **Turn off the morning email.** Shop details → **Notifications** → "Morning email · 9 am" switch
   → off (saved as switched, toast "Morning email off."). The badge stays; "Status due" emails stay,
   with the line "Status alerts still come by email, since they can't wait."
5. **Parcel notices (A5).** Unchanged for the buyer.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Bell and Needs you sheet | Portal header (every org page); `ResponsivePicker`-style sheet on a phone, popover from `lg:` | New | R3 |
| Morning email | Email | New | R4 |
| At-once email | Email | New | R5 |
| Notification settings | `/org/[orgId]/shop/notifications` (Shop details) | New | R4 |

## State matrix — Needs you sheet
| State | What the shop sees | Action |
|---|---|---|
| Empty | "Nothing needs you right now." | — |
| Loading | Two row skeletons | — |
| Success | Items newest first, each "what · where · when" with an icon per platform | Open |
| Many items | Grouped by kind with counts ("Messages waiting · 6") | Open group |
| Stale | An item fixed elsewhere vanishes on next open; never a dead link | — |
| Phone / tablet / desktop | Bottom sheet; popover under the bell from `lg:` | — |

## Copy deck
- Bell label "Needs you"; empty "Nothing needs you right now."
- Items "<n> messages waiting over 4 hours", "A post failed: <first words>", "Instagram needs reconnecting", "WhatsApp needs a payment method".
- Email subject "<n> things are waiting at <shop>"; footer "You get this at 9 am when something is waiting. Turn it off in Notifications."
- Settings "Morning email · 9 am", "Status alerts still come by email, since they can't wait.", toasts "Morning email on." / "Morning email off."

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
