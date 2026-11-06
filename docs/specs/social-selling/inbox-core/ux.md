# UX — social-selling/inbox-core

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [prototype.html](prototype.html) (local file covering inbox-core, inbox-instagram and inbox-whatsapp; publish as a private artifact once a claude.ai login is available)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)

> Phone first (~360px). Buttons are never disabled; an action that cannot happen explains itself on
> tap. Every string below is the string that ships.

## Journeys
1. **Answer a new message.** Shop menu shows "Inbox 3" → Inbox → tab with the unread dot →
   conversation (bold, unread) → thread → type, Send → message appears with "You · just now",
   conversation no longer bold.
2. **See a colleague's answer.** Inbox → conversation answered by Farida → thread shows her reply
   labelled "Farida".
3. **Reply after the window.** Thread → reply box reads "You can reply until Thu 4:30 pm" (extended)
   or "Window closed" → Send a template → picker sheet with cost → Send → message appears.
4. **It goes wrong.** Send → network drops → message shows "Not sent · No connection" → Try again.
   Connection dead → "Not sent · Reconnect Instagram" → Channels.
5. **Hide a rude comment.** Comment thread → Hide → "Hidden on Instagram" with Unhide.
6. **Find someone.** Inbox → search "ayesha" → matching conversations.

Step before journey 1: the shop connected a platform on Channels (connect-instagram,
connect-whatsapp); without one the Inbox shows first use.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Inbox list | `/org/[orgId]/inbox`, shop menu under Channels (Q13) | New | R1–R3, R11 |
| Conversation thread | `/org/[orgId]/inbox/[conversationId]` | New | R2, R4–R8 |
| Reply box | Docked at the thread's foot | New | R4, R5, R8 |
| Template picker | Sheet over the thread | New | R5 (parent Q76) |
| Shop menu | Sidebar / phone menu | Changed: "Inbox" with count | R3 |

## State matrix — Inbox list
| State | What the person sees | Action |
|---|---|---|
| First use | No platform connected: "Messages from Instagram and WhatsApp arrive here once you connect them." | Go to Channels |
| Empty | Tab shown, no conversations: "No messages yet. When someone writes to you on Instagram, it shows here." | — |
| Loading | Six row skeletons | — |
| Partial | One tab has conversations, another is empty; each tab states itself | — |
| Success | Rows: name, platform mark, last line (2 lines max), time, unread dot and bold | Open a row |
| Retryable error | "Couldn't load your messages. Check your connection and try again." | Try again |
| Terminal error | n/a — loading is always retryable | — |
| Refused | Shop suspended: the portal's suspended screen | — |
| Stale | Re-read every 20 s while open; "Updated just now" under the tabs | Pull or tap Refresh |
| Long content | Names truncate on one line; last message clamps to two lines | — |
| Many items | 30 per page, "Show more" at the foot; search by name or handle | Show more |
| Slow | Skeletons; after 3 s "Still loading…" | — |
| Phone / tablet / desktop | List full width / list 360px beside the open thread (`md:`) / plus the person panel (`lg:`) | — |

## State matrix — Conversation thread and reply box
| State | What the person sees | Action |
|---|---|---|
| First use | n/a — a thread exists only with a message | — |
| Empty | n/a | — |
| Loading | Bubble skeletons | — |
| Partial | Some replies Not sent among sent ones | Try again on each |
| Success | Sent reply shows "You · just now", then "Farida · 2 min" to others | — |
| Retryable error | Bubble: "Not sent · No connection" | Try again |
| Terminal error | Bubble: "Not sent · Instagram needs reconnecting" | Reconnect |
| Refused (window shut, templates) | Box replaced: "This chat is older than 24 hours. WhatsApp only allows an approved template now." | Send a template |
| Refused (window shut, none) | "Instagram allows a reply only after they write again." | — (explains on tap) |
| Extended window | Above box: "You can reply until Thu 4:30 pm." | Send |
| Stale | New inbound appears within 20 s; "New message" pill if scrolled up | Jump to latest |
| Long content | Bubbles wrap; 1,000-character counter appears at 900 | — |
| Many items | Latest 50 messages; "Earlier messages" loads more | Earlier messages |
| Slow | Sending bubble shows a clock; after 3 s "Sending…" | — |
| Unsupported message | "Voice note — open it in Instagram to listen" | — |
| Phone / tablet / desktop | Full-screen thread with back arrow / right pane / right pane plus person panel | — |

## Copy deck
- Menu: "Inbox" · count badge "3".
- Tabs: "Instagram", "WhatsApp"; chip "Unread".
- Search placeholder: "Search by name or handle".
- First use: "Messages from Instagram and WhatsApp arrive here once you connect them." · button "Go to Channels".
- Empty tab: "No messages yet. When someone writes to you on {platform}, it shows here."
- Load error: "Couldn't load your messages. Check your connection and try again." · "Try again".
- Reply placeholder: "Write a reply" · buttons "Send", "Add photo".
- Sender labels: "You", "{member name}", "From the WhatsApp app".
- Not sent: "Not sent · No connection", "Not sent · {Platform} needs reconnecting", "Not sent · {Platform} refused this message" · "Try again", "Reconnect".
- Windows: "You can reply until {day time}." · "This chat is older than 24 hours. WhatsApp only allows an approved template now." · "Instagram allows a reply only after they write again."
- Template picker: title "Send a template" · row "{name} · about ₹{cost}" · "Send" · empty "No approved templates yet. Write one in Templates."
- Hide: "Hide" · "Hidden on Instagram" · "Unhide".
- Unsupported: "{Kind} — open it in {Platform} to see it".
- Expired photo: "Photo no longer available".
- Fresh: "Updated just now" · pill "New message".

## Sign-off
Awaiting the owner.
