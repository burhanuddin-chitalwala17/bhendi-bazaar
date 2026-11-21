# UX — social-selling/inbox-whatsapp

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [../inbox-core/prototype.html](../inbox-core/prototype.html) (local file shared with inbox-core; publish as a private artifact once a claude.ai login is available)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [inbox-core ux](../inbox-core/ux.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). The list, thread and reply box are inbox-core's; this file is what the
> WhatsApp plug adds. Every string below is the string that ships.

## Journeys
Step before each: the shop connected WhatsApp on Channels (connect-whatsapp).
1. **Answer a chat.** Inbox → WhatsApp tab → "Rehana · +91 98200 12345" (unread) → thread → reply →
   ticks go grey ✓, ✓✓, then blue ✓✓ when read; the reply also shows in the shop's Business app.
2. **A reply from the phone.** Owner answers in the Business app → the thread shows it, labelled
   "From the WhatsApp app".
3. **Reply after a day.** Thread older than 24 hours → reply box: "This chat is older than 24 hours…"
   → Send a template → picker sheet lists approved templates with "about ₹0.86" → pick → preview
   with filled values → Send → bubble shows "Template · ₹0.86".
4. **It goes wrong.** No payment method → "Not sent · Add a payment method in WhatsApp Manager".
   Number not on WhatsApp → "Not sent · This number isn't on WhatsApp". Connection removed →
   "Not sent · WhatsApp needs reconnecting".

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| WhatsApp tab of the Inbox | `/org/[orgId]/inbox?tab=whatsapp` | Changed: real source | R1, R9 |
| Chat thread | `/org/[orgId]/inbox/[conversationId]` | Changed: ticks, app label, template send | R2–R7 |
| Template picker | Sheet over the thread (inbox-core) | Changed: cost and preview | R4, R5 |

## State matrix — WhatsApp tab
| State | What the person sees | Action |
|---|---|---|
| First use | Connected, nothing yet: "No chats yet. New WhatsApp messages to {number} show here from today." | — |
| Empty | Same as first use | — |
| Loading | inbox-core's skeletons | — |
| Partial | Some chats unread, some answered | — |
| Success | Rows: profile name, number, last line, ticks on the shop's last message | Open |
| Retryable error | inbox-core's load error | Try again |
| Terminal error | n/a | — |
| Refused (needs reconnecting) | Note: "WhatsApp needs reconnecting. New chats won't arrive until you do." | Reconnect |
| Stale | inbox-core's 20 s refresh | — |
| Long content | Long profile names truncate; number always shown in full | — |
| Many items | inbox-core's paging and search (name or number) | — |
| Slow | inbox-core's | — |
| Phone / tablet / desktop | inbox-core's | — |

## State matrix — Chat thread and template send
| State | What the person sees | Action |
|---|---|---|
| First use / Empty | n/a — a thread starts with a message | — |
| Loading | Bubble skeletons | — |
| Partial | A reply Failed among delivered ones | Try again |
| Success | Ticks: ✓ Sent, ✓✓ Delivered, blue ✓✓ Read | — |
| Retryable error | "Not sent · No connection" | Try again |
| Terminal error (payment) | "Not sent · Add a payment method in WhatsApp Manager" | Open WhatsApp Manager |
| Terminal error (not on WhatsApp) | "Not sent · This number isn't on WhatsApp" | — |
| Terminal error (connection) | "Not sent · WhatsApp needs reconnecting" | Reconnect |
| Refused (window shut) | Box: "This chat is older than 24 hours. WhatsApp only allows an approved template now." | Send a template |
| Template picker empty | "No approved templates yet. Write one in Templates." | Go to Templates |
| Template preview | Filled message, "Costs about ₹0.86, paid from your WhatsApp account." | Send |
| Refused (past spend cap, parent Q8) | Bubble: "Not sent · This would pass your monthly WhatsApp limit (₹{spent} of ₹{limit})" | Raise limit |
| Stale | New messages within 20 s | — |
| Long content | Long messages wrap | — |
| Many items | inbox-core's "Earlier messages" | — |
| Slow | "Sending…" after 3 s | — |
| Unsupported | "Voice note — open it in WhatsApp to listen" | — |
| Phone / tablet / desktop | inbox-core's | — |

## Copy deck
- Empty tab: "No chats yet. New WhatsApp messages to {number} show here from today."
- Needs reconnecting: "WhatsApp needs reconnecting. New chats won't arrive until you do." · "Reconnect".
- Echo label: "From the WhatsApp app".
- Ticks (screen-reader text): "Sent", "Delivered", "Read", "Not delivered".
- Window shut: "This chat is older than 24 hours. WhatsApp only allows an approved template now." · "Send a template".
- Picker row: "{template name} · about ₹{cost}" · empty: "No approved templates yet. Write one in Templates." · "Go to Templates".
- Preview: "Costs about ₹{cost}, paid from your WhatsApp account." · "Send" · "Back".
- Sent template bubble tag: "Template · ₹{cost}".
- Past cap: "Not sent · This would pass your monthly WhatsApp limit (₹{spent} of ₹{limit})" · "Raise limit" (opens WhatsApp settings).
- Failures: "Not sent · Add a payment method in WhatsApp Manager" · "Not sent · This number isn't on WhatsApp" · "Not sent · WhatsApp needs reconnecting" · "Not sent · WhatsApp refused this message".
- Unsupported: "{Voice note | Sticker | Location | Contact card} — open it in WhatsApp to see it".

## Sign-off
Awaiting the owner.
