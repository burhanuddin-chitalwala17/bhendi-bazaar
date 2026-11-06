# UX — social-selling/connect-whatsapp

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [connect-instagram/prototype.html](../connect-instagram/prototype.html) (local file; to be published as a private artifact)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [connect-instagram ux.md](../connect-instagram/ux.md), [channel-connectors ux.md](../../marketplace-integration/channel-connectors/ux.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Buttons are never disabled. Every string below ships as written. Meta's
> pop-up is Meta's; we draw it in the prototype only to show where the shop goes.

## Journeys
1. **Connect, coexistence.** Channels → WhatsApp card → Connect WhatsApp → Meta's pop-up (log in
   with Facebook → pick business → "Connect your existing WhatsApp Business app" → scan the QR code
   in the app) → pop-up closes → "Setting up your number…" on the card → spend-cap step → Save →
   Connected, toast "WhatsApp connected."
2. **No business account.** Same, but in the pop-up "Create a business portfolio" first.
2a. **Cannot coexist** (blue-tick number, or Meta refuses the app number). Pop-up says so → the
   shop picks Meta's "new number" path for the same number → card's "Before you move your number"
   note → Continue → journey 1 from setting up. The Inbox is then its WhatsApp (parent Q84).
3. **No payment method.** Journey 1 ends Connected with "Add a payment method in Meta to send
   messages." → Add payment method opens Meta's billing page in a new tab.
4. **Cancel or fail.** The shop closes the pop-up, or setup fails → note on Channels, Connect again.
5. **Refused.** Number in another shop, a different number on reconnect, or Meta's weekly limit →
   the reason; nothing connected.
6. **Kept true.** Nobody acts. Our app removed in Meta → card and dashboard "WhatsApp needs
   reconnecting" → Reconnect → journey 1, same number. Quality drops → amber chip and dashboard line.
7. **Disconnect.** Card → Disconnect → dialog → Disconnect → card Not connected; the app keeps working.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| WhatsApp card | Channels, after Instagram | New, replaces the Coming soon WhatsApp card | R1, R2, R7, R8, R12 |
| Meta's pop-up | Meta's window over Channels | Meta's own | R1, R3 |
| Spend-cap step | Sheet over Channels, after setting up | New | R6a |
| Return outcome note | Top of Channels | Changed: WhatsApp outcomes | R4, R5 |
| Disconnect dialog | Over Channels | Changed: WhatsApp wording | R10 |
| Dashboard banner | `/org/[orgId]` | Changed: WhatsApp counted | R9 |

## State matrix — WhatsApp card
| State | Chip | Body | Primary action |
|---|---|---|---|
| First use (not connected) | Not connected | "Show your catalogue in chats and message customers who asked for it. Keep using the WhatsApp Business app on the same number." Small line: "Your WhatsApp catalogue will then be managed from Bhendi Bazaar. Chats, broadcasts and Status stay in your app." Expandable "What else changes": "Broadcast lists become read-only. View-once and disappearing messages turn off. Open the app at least every two weeks to stay linked. Messages you type in the app stay free." | Connect WhatsApp |
| Moving the number (Q84 fallback) | — | "Before you move your number: the WhatsApp Business app stops working on it. You'll chat with customers from Inbox here, on your phone or computer." | Continue · Back |
| Pop-up open | — | Button spinner, "Finish in the Meta window…" | — |
| Setting up | — | "Setting up your number…" (exchange, register, subscribe) | — |
| Connected | ● Connected | "+91 98•••• 4321 · Bhendi Bazaar" · "Quality: High" · "Payments set up" · "Connected by Farida · 6 Nov 2026" · "Last checked 2 min ago" | Disconnect (secondary) |
| Connected, no payment method | ● Connected | Same, with "Add a payment method in Meta to send messages. Replies within 24 hours are free." | Add payment method · Disconnect (secondary) |
| Quality Medium / Low | Quality: Medium (amber) / Low (red) | "WhatsApp rates your number Low. Sending marketing may be limited." | Why? (explains) |
| Needs reconnecting | Needs reconnecting | One of: "WhatsApp stopped accepting our access." · "Bhendi Bazaar was removed in Meta Business Suite." | Reconnect · Disconnect (secondary) |
| Full for now (Q12) | Full for now | "WhatsApp lets us add a limited number of new shops each week. Try again in a few days." | Why? |
| Coming soon | Coming soon | "Connecting WhatsApp isn't open yet. We'll show it here when it is." | Why? |
| Disconnected (before) | Not connected | "Disconnected by Farida · 6 Nov 2026." | Connect WhatsApp |
| Empty / Partial / Many items | n/a — one number per shop (Q10) | — | — |
| Retryable / terminal / refused | Shown as the return note | — | — |
| Stale | "Last checked 3 days ago" amber past 24 h | — | Check now |
| Long content | A long WhatsApp display name truncates on one line; tap shows it | — | — |
| Slow | "Setting up your number…" past 3 s adds "This can take up to a minute." | — | — |
| Phone / tablet / desktop | Same card grid as channel-connectors; Meta's pop-up is a window on desktop, a full tab on phone | — | — |

## State matrix — Spend-cap step
| State | What the person sees | Action |
|---|---|---|
| Default | Title "Set a monthly WhatsApp limit" · "WhatsApp charges for messages you send to customers, billed by Meta to your account. We stop paid sends when this month's total reaches your limit. Replies within 24 hours are free." · rupee field, empty · "You can change it any time in WhatsApp settings." | Save limit |
| Field error | "Enter an amount in rupees, like 500." | Fix |
| Working / Success | "Saving…" / toast "WhatsApp connected. Monthly limit ₹{x}." | — |
| Left without answering | Card Connected with the line "Choose a monthly limit before sending paid messages."; a paid send asks for the limit first | Set limit |
| Phone / tablet / desktop | Bottom sheet on phone; dialog from `md:` | — |

## State matrix — Return outcome note (WhatsApp)
| Outcome | Tone | Text | Action |
|---|---|---|---|
| Connected | Success toast | "WhatsApp connected." | — |
| Closed the pop-up | Neutral note | "Nothing was connected. You can connect WhatsApp any time." | Connect WhatsApp |
| Setup failed after Meta | Error note | "Meta connected your number but we couldn't finish setting it up. Nothing is half-done; try again." | Try again |
| Started by someone else / expired | Warning note | "This connection was started from another sign-in. Start again from here." | Connect WhatsApp |
| Number in another shop (Q10) | Error note | "This WhatsApp number is already connected to another shop. A number can belong to one shop only; disconnect it there first." | — |
| Different number on reconnect (Q11) | Warning note | "That's a different number from the one connected here. To switch numbers, disconnect this one first, then connect the new one." | Disconnect |
| Full for now | Warning note | "WhatsApp is full for now. Try again in a few days." | — |
| Meta did not answer | Error note | "WhatsApp didn't respond. Nothing was connected. Try again in a minute." | Try again |

## State matrix — Disconnect dialog (WhatsApp)
| State | What the person sees | Action |
|---|---|---|
| Default | "Disconnect WhatsApp?" · **Stops:** "Your catalogue stops updating, chats stop arriving here, and campaigns can't be sent." · **Stays:** "Your number keeps working in the WhatsApp Business app. Your chats stay here for 90 days, then are deleted." · "To remove us completely, also remove Bhendi Bazaar in Meta Business Suite → Settings → Integrations." | Disconnect · Keep connected |
| Working / Success / Error | "Disconnecting…" / toast "WhatsApp disconnected." / "Couldn't disconnect. Try again." | — |
| Phone / tablet / desktop | Bottom sheet on phone; dialog from `md:` | — |

## State matrix — Dashboard banner (WhatsApp)
| State | Text | Action |
|---|---|---|
| Needs reconnecting | "WhatsApp needs reconnecting. Chats and your catalogue aren't updating." | Reconnect |
| Quality Low | "WhatsApp rates your number Low. Marketing messages may be limited." | Open Channels |
| None / several | No banner / "2 channels need attention." | — / Open Channels |

## Copy deck
Every string above ships. Words: a number is "connected"; "Meta" names the company and its
pop-up, "WhatsApp" names the app and the number; the masked number shows only the last four
digits; quality reads High, Medium or Low as Meta does.

## Sign-off
Awaiting the owner's review of the prototype.
