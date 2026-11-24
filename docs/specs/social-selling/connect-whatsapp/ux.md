# UX — social-selling/connect-whatsapp

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/connect.html](../prototypes/connect.html), sections "WhatsApp"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md), [whatsapp-sending](../whatsapp-sending/spec.md) (the spending-limit step), [whatsapp-catalogue-import](../whatsapp-catalogue-import/ux.md)

> The WhatsApp card on Channels, on the existing channel card. New here: Meta's pop-up, the
> spending-limit step that ends connecting (owned by whatsapp-sending), and the setup checklist that
> carries the shop through catalogue, templates and auto-replies (parent Q111).

## Journeys
1. **Connect, keeping the Business app.** Channels → WhatsApp card (a quiet line says what changes)
   → **Connect WhatsApp** (pending "Opening Meta…") → Meta's pop-up, pre-filled: choose "Connect your
   existing WhatsApp Business app" → scan Meta's code in the Business app → pop-up closes → card
   "Setting up your number…" (pending, up to a minute) → **Spending limit** step opens as a sheet:
   pick an amount or "No limit" → **Save** → card Connected, checklist with **Catalogue** next.
2. **No Meta business yet.** Same, choosing "Create a business portfolio" inside Meta's pop-up.
3. **A number that can't keep the app.** Meta refuses coexistence: the pop-up offers its new-number
   path; before continuing, our note says the Business app will stop working on this number and the
   Inbox becomes its WhatsApp → the shop decides inside Meta's pop-up.
4. **Carry on setting up.** Checklist: **Catalogue** opens settle (or shows "142 products · all in
   your catalogue" and ticks) → **Templates** shows "12 in review" and ticks itself when approved →
   **Auto-replies** opens Inbox settings → all ticked: "Setup done".
5. **Something goes wrong.** Pop-up closed, setup failed after Meta, number in another shop,
   different number on reconnect, Meta's weekly limit: a return note or the card's own state.
6. **Health.** No payment method, quality Low, offboarded (the app moved phone), our app removed:
   the card says so, Home once; each with the one action that fixes it.
7. **Disconnect.** Card → **Disconnect** → dialog → **Disconnect** → Not connected; the number keeps
   working in the Business app.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| WhatsApp card | Channels, "Where you sell", after Instagram | New | R1, R2, R9–R11, R13, R14 |
| Meta's pop-up | Meta's window (theirs) | — | R1–R3 |
| Setting up | The card, pending | New | R6 |
| Spending limit sheet | `HandoffSheet` over Channels (whatsapp-sending's) | New | R8 |
| Return note | Top of Channels | Changed: WhatsApp outcomes | R4, R5 |
| Disconnect dialog | Over Channels | Changed: WhatsApp wording | R12 |

## State matrix — WhatsApp card
| State | Badge | Body | Main action |
|---|---|---|---|
| First use | Not connected | "Your catalogue in WhatsApp chats, every chat answered from here, and messages to customers who asked for them. Works like WhatsApp Web: your chats, on one more screen. Keep using the WhatsApp Business app on the same number." + "🔒 Private to your shop" + quiet line "Your WhatsApp catalogue will then be managed from Bhendi Bazaar. Chats, broadcasts and Status stay in your app." | Connect WhatsApp |
| Opening Meta | Not connected | Button pending "Opening Meta…"; card line "Finish in the Meta window…"; before it opens, once: "Meta will ask to let Bhendi Bazaar manage your WhatsApp messages. That's what lets you reply from here. Your chats stay between you and your buyers." | — |
| Setting up | — | "Setting up your number…"; past 3 s "This can take up to a minute." | — |
| Connected, setup open | ● Connected | "+91 98•••• 4321 · Niqab Boutique" + checklist: Connect ✓ · Spending limit ✓ · **Catalogue · 40 items to settle** · Templates · Auto-replies | Settle catalogue |
| Templates waiting | ● Connected | Checklist "Templates · 12 in review" (dashed tick, no tap needed) | Next step |
| Setup done | ● Connected | Number · name · "Quality: High · Payments set up" · "Connected by Farida · 22 Nov 2026 · Last checked 2 min ago"; "Setup done" | Disconnect (secondary) |
| No payment method | ● Connected | "Add a payment method in Meta to send messages. Replies within 24 hours are free." | Add payment method (opens Meta) |
| Quality Low | Quality: Low (red) | "WhatsApp rates your number Low. Marketing messages may be limited." | Why? |
| Needs reconnecting | Needs reconnecting | One of: "Bhendi Bazaar was removed in Meta Business Suite." · "Your WhatsApp Business app was set up on another phone, so the connection stopped." | Reconnect · Disconnect |
| Full for now | Full for now | "WhatsApp lets us add a limited number of new shops each week. Try again in a few days." | Why? |
| Empty | n/a | — | — |
| Loading | Card skeleton in place | — | — |
| Partial | Setup part-done | — | The next step |
| Retryable error | Return note "Meta connected your number but we couldn't finish setting it up. Nothing is half-done; try again." | — | Try again |
| Terminal error | Number in another shop (return note) | — | — |
| Refused | Different number on reconnect; or no Social selling lock | — | — |
| Stale | "Last checked 3 days ago" amber | — | Check now |
| Long content | Display name truncates on one line; tap shows it whole | — | — |
| Many items | n/a — one number per shop | — | — |
| Slow | Setting up past 60 s: "Still setting up. You can leave this page; we'll show it here when it's done." | — | — |
| Phone / tablet / desktop | Meta's window: a full tab on a phone, a pop-up from `md:` | — | — |

## State matrix — Spending limit sheet
| State | What the shop sees | Action |
|---|---|---|
| First use | Title "Set a monthly limit for WhatsApp messages"; body "Replies within 24 hours are free. Other messages cost about ₹0.86 each, billed to your WhatsApp account by Meta. We stop sending when you reach your limit."; choices ₹500 · ₹1,000 (selected, marked "Suggested") · ₹2,500 · Other amount · No limit | Save |
| Saving | Button pending "Saving…" | — |
| Success | Sheet closes, checklist ticks "Spending limit · ₹1,000 a month", toast "Limit saved." | — |
| Retryable error | Inline "Couldn't save. Try again." | Try again |
| Refused | Amount below ₹100: "The lowest limit is ₹100." | — |
| Left without answering | Step stays unticked; asked again before the first paid send | — |
| Phone / tablet / desktop | Bottom sheet on a phone; centred dialog from `md:` | — |

## Copy deck
- Card title "WhatsApp"; purpose "Your catalogue in chats, every chat answered, and messages to customers who asked."
- Checklist: "Connect" · "Spending limit" · "Catalogue" (with "N items to settle", "N need a fix" or "all in your catalogue") · "Templates" ("N in review", "approved") · "Auto-replies".
- Coexistence note before the new-number path: "This number can't stay on the WhatsApp Business app. If you continue, the app stops working on it and your Bhendi Bazaar Inbox becomes your WhatsApp."
- Disconnect dialog: "Stops: your catalogue stops updating, chats stop arriving here, and messages can't be sent." "Stays: your number keeps working in the WhatsApp Business app. Your chats stay here for 90 days, then are deleted." "To remove us completely, also remove Bhendi Bazaar in Meta Business Suite → Settings → Integrations." Buttons "Disconnect", "Keep connected"; toast "WhatsApp disconnected."
- Return notes: "WhatsApp connected." · "Nothing was connected. You can connect WhatsApp any time." · "This WhatsApp number is already connected to another shop. A number can belong to one shop only; disconnect it there first." · "That's a different number from the one connected here. To switch, disconnect this one first, then connect the new one."

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
