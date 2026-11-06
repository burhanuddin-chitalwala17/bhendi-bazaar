# UX — social-selling/inbox-instagram

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [../inbox-core/prototype.html](../inbox-core/prototype.html) (local file shared with inbox-core; publish as a private artifact once a claude.ai login is available)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [inbox-core ux](../inbox-core/ux.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). The list, thread and reply box are inbox-core's; this file is what the
> Instagram plug adds. Every string below is the string that ships.

## Journeys
Step before each: the shop connected Instagram on Channels (connect-instagram).
1. **Answer a DM.** Inbox → Instagram tab → "ayesha.k" (unread) → thread → reply → it arrives in
   her Instagram as from the shop.
2. **Answer a comment in public.** Instagram tab → row "Comment on: Silk dupatta…" → thread with the
   post's thumbnail on top → reply box says "Reply publicly" → Send → shows under the comment.
3. **Answer a comment by DM.** Comment thread → "Reply by DM" → message → Send → a DM conversation
   with that person opens in the tab; the comment thread shows "Replied by DM".
4. **Late DM.** Thread older than a day → banner "You can reply until Thu 4:30 pm" → Send (tagged
   human agent). Older than 7 days → "Instagram allows a reply only after they write again."
5. **It goes wrong.** Second "Reply by DM" on the same comment → "You've already replied to this
   comment by DM. Instagram allows one." Token dead → "Not sent · Instagram needs reconnecting".
6. **Hide.** Comment thread → Hide → "Hidden on Instagram".

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Instagram tab of the Inbox | `/org/[orgId]/inbox?tab=instagram` | Changed: real source | R1, R2, R11 |
| Comment thread | `/org/[orgId]/inbox/[conversationId]` | Changed: post header, reply modes | R2, R5–R7 |
| DM thread | same | Changed: window banner | R3, R4, R8 |

## State matrix — Instagram tab
| State | What the person sees | Action |
|---|---|---|
| First use | Instagram connected, nothing yet: "No messages yet. When someone DMs or comments on your posts, it shows here." | — |
| Empty | Same as first use | — |
| Loading | inbox-core's skeletons | — |
| Partial | DMs and comments mixed, newest first; comments show "Comment on: {caption start}" | — |
| Success | Rows with a DM or comment mark | Open |
| Retryable error | inbox-core's load error | Try again |
| Terminal error | n/a | — |
| Refused (private account) | Note above the list: "Comments reach your inbox only while your Instagram account is public." | — |
| Refused (needs reconnecting) | Note: "Instagram needs reconnecting. New messages won't arrive until you do." | Reconnect |
| Stale | inbox-core's 20 s refresh | — |
| Long content | Caption start truncated to one line | — |
| Many items | inbox-core's paging and search | — |
| Slow | inbox-core's | — |
| Phone / tablet / desktop | inbox-core's | — |

## State matrix — Comment thread
| State | What the person sees | Action |
|---|---|---|
| First use / Empty | n/a — a thread starts with a comment | — |
| Loading | Post header skeleton and bubbles | — |
| Partial | Some replies sent, one Not sent | Try again |
| Success (public) | Reply under the comment, "You · just now · Public" | — |
| Success (by DM) | Line "Replied by DM · Open chat" | Open chat |
| Retryable error | "Not sent · No connection" | Try again |
| Terminal error | "Not sent · Instagram needs reconnecting" | Reconnect |
| Refused (already replied by DM) | "You've already replied to this comment by DM. Instagram allows one." | Open chat |
| Refused (over 7 days) | On tap of Reply by DM: "Instagram allows a DM reply to a comment only within 7 days." | — |
| Hidden | "Hidden on Instagram" | Unhide |
| Stale | New replies under the comment appear within 20 s | — |
| Long content | Long comments wrap; post caption clamps to two lines | — |
| Many items | A comment with many replies shows the latest 20, "Earlier replies" | — |
| Slow | "Sending…" after 3 s | — |
| Phone / tablet / desktop | inbox-core's | — |

## Copy deck
- Row prefix: "Comment on: {caption start}" · DM rows have no prefix.
- Reply box on a comment: label "Reply publicly" · second button "Reply by DM".
- After DM reply: "Replied by DM · Open chat".
- Already replied: "You've already replied to this comment by DM. Instagram allows one."
- Too late: "Instagram allows a DM reply to a comment only within 7 days."
- Window banner: "You can reply until {day time}." · shut: "Instagram allows a reply only after they write again."
- Private account: "Comments reach your inbox only while your Instagram account is public."
- Needs reconnecting: "Instagram needs reconnecting. New messages won't arrive until you do." · "Reconnect".
- Echo label: "From the Instagram app".
- Hide: "Hide" · "Hidden on Instagram" · "Unhide".

## Sign-off
Awaiting the owner.
