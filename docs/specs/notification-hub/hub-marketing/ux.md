# UX — notification-hub/hub-marketing

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [social-selling/prototypes/notify.html](../../social-selling/prototypes/notify.html), section "Unsubscribe"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [whatsapp-sending ux](../../social-selling/whatsapp-sending/ux.md) (the how-often rule under Advanced), [consent-core ux](../../social-selling/consent-core/ux.md)

> Almost invisible by design: it picks WhatsApp or email for each buyer message and keeps the
> how-often rule. Its screens are the rule's line under Messaging → Advanced (whatsapp-sending), the
> skipped counts in reports, and the one-tap unsubscribe a buyer reaches from an email.

## Journeys
1. **Unsubscribe (A4).** Buyer taps "Unsubscribe" in a Niqab Boutique email → page (no sign-in):
   "You won't get offers from Niqab Boutique by email any more." with the line "Orders and receipts
   still come by email." and **Undo** for 30 days → done in one tap.
2. **Skipped, explained (A3).** Campaign report and alert counts show "Skipped · over the
   how-often limit" with the number; tapping opens the people and the line "They already had
   offers from you today or 4 this week."

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Unsubscribe page | `/unsubscribe/<token>`, public | New | R4 |
| How-often rule | Messaging → Advanced (whatsapp-sending) | — | R3 |
| Skipped reasons | Reports of campaigns and alerts | New | R5 |

## State matrix — Unsubscribe page
| State | What the buyer sees | Action |
|---|---|---|
| Success | Confirmation as above | Undo |
| Undone | "You'll get offers from <shop> by email again." | — |
| Already unsubscribed | Same confirmation, no error | — |
| Altered or old link | "This link isn't valid. Reply STOP to <shop> on WhatsApp, or contact the shop." | — |
| Phone / tablet / desktop | One centred column, shop's name and logo on top | — |

## Copy deck
- "You won't get offers from <shop> by email any more." · "Orders and receipts still come by email." · "Undo".
- "Skipped · over the how-often limit" · "They already had offers from you today or 4 this week."
- Email footer "You agreed to offers from <shop>. Unsubscribe".

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
