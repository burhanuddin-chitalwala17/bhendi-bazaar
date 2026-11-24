# UX — social-selling/inbox-core

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/converse.html](../prototypes/converse.html), sections "Inbox", "A conversation", "The reply box"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md), parent Q63, Q89, Q110, Q114, [inbox-instagram ux](../inbox-instagram/ux.md), [inbox-whatsapp ux](../inbox-whatsapp/ux.md), [enquiry-autoreplies ux](../enquiry-autoreplies/ux.md)

> The one place a shop answers its buyers. Built like the chat apps the shop already uses (a list,
> then a thread, a box at the foot), with two things those apps lack: what needs a person is always
> on top, and the reply box always says what the platform allows right now. The platform tabs and
> their message kinds belong to inbox-instagram and inbox-whatsapp; this file is the frame.

## Journeys
1. **Answer what needs me.** Tab bar shows **Inbox · 3** → Inbox opens on the last tab used, unless
   that tab has nothing needing the shop and another has; each platform tab shows its own count, and
   **Needs you** is pre-selected when anything needs the shop → tap the first → thread,
   with the automatic exchange so far and the line "Handed to you · buyer asked for the shop" → type
   → **Send** (pending, then the bubble shows Sent) → back: the row leaves Needs you, the count
   falls to 2.
2. **Catch up.** Filter **Unread** → open each; opening marks it read for every member.
3. **Check what the bot did.** Filter **Answered automatically** → a thread shows the bot's
   bubbles marked Automatic; the shop can step in at any time by replying (that pauses
   automatic replies in it, enquiry-autoreplies R7).
4. **Find someone.** Search icon → type a name or handle → results across the current tab.
5. **Send fails.** The bubble shows **Not sent · <reason>** and **Try again** (one automatic retry
   happened first, R9).
6. **Something we can't show.** A voice note arrives as "🎤 Voice message · open in WhatsApp" (or
   Instagram); nothing is dropped (R8).
7. **Nothing connected yet.** Inbox → `EmptyState` "Messages from Instagram and WhatsApp will
   appear here" → **Connect** → Channels → back.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Inbox list | `/org/[orgId]/inbox?tab=<platform>&filter=needs-you\|unread\|auto` | New | R1, R2, R4, R4a, R11 |
| Thread | `/org/[orgId]/inbox/[conversationId]`: full page on a phone; right pane from `lg:` | New | R2, R3, R5–R9 |
| Details panel | Thread's ⓘ: person, platform, products tied, recent orders; a sheet on a phone, third pane from `xl:` | New | R2 |
| Inbox settings | `/org/[orgId]/inbox/settings`, tabs Auto-replies (enquiry-autoreplies) | New | R11 |
| Menu item | "Inbox" with the Needs you count; a tab-bar slot on a phone | Changed | R4 |

## The list row
Avatar (initials on a platform-coloured ring, never a profile photo, R13) · name or handle · the
last message's first line · time · a state chip: **Needs you** (amber), unread dot (bold name),
**Auto** (quiet). A comment row shows its post's thumbnail at the right. Rows sort: Needs you first
(oldest waiting first, so nobody is forgotten), then the rest newest first.

## The thread
Bubbles: the buyer's left; the shop's right with the sender's first name under it to members
("Farida", "From the app", "Automatic"); a day divider; Sent · Delivered · Read ticks where the
platform reports them. A handover line in the middle of the thread when a bot hands over ("Handed to
you · buyer tapped Talk to the shop"). The reply box at the foot (below); platform actions in the
header ⋯ (R7).

## The reply box (R6)
| What the platform allows | What sits above the box | Box |
|---|---|---|
| Reply freely | nothing | "Reply…" · 📷 · **Send** |
| Only a person may reply (Instagram, 24 h–7 days) | "Only a person can reply now · 4 days left" | as above |
| Only a paid template (WhatsApp, after 24 h) | "Free replies ended 26 h ago. Send a template to restart the chat." | **Choose a template** · "about ₹0.86" |
| Nothing (Instagram after 7 days) | "Instagram allows no replies after 7 days." | Box hidden; Open in Instagram |
| Not connected | "Instagram is disconnected. Reconnect to reply." | Reconnect |

Over 1,000 characters the counter turns red and Send explains on tap. Send never disables; while
sending it is pending and a second tap is ignored.

## State matrix — Inbox list
| State | What the shop sees | Action |
|---|---|---|
| First use, nothing connected | `EmptyState` "Messages from Instagram and WhatsApp will appear here" · "Connect a platform to answer every message from here." | Connect |
| First use, connected | "No messages yet. When someone messages @niqab.boutique, it appears here." | — |
| Empty filter | Needs you: "Nothing needs you. 🎉" · Unread: "All read." · Auto: "No automatic answers yet." | Clear filter |
| Loading | Row skeletons; filters and tabs drawn at once | — |
| Partial | One platform failing to load: its tab shows `ErrorState`, the other works | Try again |
| Success | Rows as above | Open |
| Retryable error | `ErrorState` "Couldn't load your messages." | Try again |
| Refused | No Social selling plan: the lock (ux-patterns §8) | Talk to us |
| Stale | New messages while the list is open: a pill "3 new" at the top; tapping scrolls up. Never jumps rows under the thumb | Show |
| Long content | Names truncate on one line; message preview one line | — |
| Many items | Infinite scroll, 30 at a time | — |
| Slow | Search past 3 s: "Still searching…" | — |
| Phone / tablet / desktop | Phone: list, then thread as its own page. Tablet: list and thread side by side in landscape. Desktop: list, thread and details | — |

## State matrix — Thread
| State | What the shop sees | Action |
|---|---|---|
| Loading | Bubble skeletons; the box ready at once | — |
| Success | Bubbles, newest at the foot, scrolled there | Reply |
| Sending | Bubble at 60% opacity with a clock | — |
| Retryable error | "Not sent · Instagram didn't answer." | Try again |
| Terminal error | "Not sent · The buyer can't receive messages from you." | — |
| Refused | Reply box states above | — |
| Stale | A member replied elsewhere while typing: their bubble appears; the draft stays | — |
| Long content | Long messages fold after 12 lines, "Show more" | — |
| Many items | Older messages load on scroll up, position kept | — |
| Unknown kind | "🎤 Voice message · open in WhatsApp", "Sticker", "Unsupported message" | Open in app |

## Copy deck
- Menu "Inbox"; title "Inbox"; filters "Needs you", "Unread", "Answered automatically".
- Sender lines "<first name>", "From the app", "Automatic".
- Handover lines "Handed to you · buyer tapped Talk to the shop", "Handed to you · a question we couldn't answer".
- Reply states as in the table; "Reply…", "Send", "Not sent", "Try again", "<n> new".
- Empty states as in the matrix.

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
