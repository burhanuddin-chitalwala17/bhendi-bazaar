# UX — social-selling/inbox-instagram

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/converse.html](../prototypes/converse.html), section "Instagram"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [inbox-core ux](../inbox-core/ux.md), [connect-instagram ux](../connect-instagram/ux.md)

> The Instagram tab of the inbox: DMs, story replies and comments. What is particular here is that a
> comment is public, so every reply to one says who will see it, and that Instagram's reply windows
> (24 hours, then 7 days for a person) are shown on the box, never discovered by failing.

## Journeys
1. **A story reply.** Row "Ayesha replied to your story" → thread opens with the story's picture as
   the first bubble ("Replied to your story · 2 h ago") → reply.
2. **A comment, answered in public.** Instagram tab → comments group under their post (a post row
   expands to its comments) → tap a comment → thread shows the post, the comment, any replies →
   the box has a switch **Public reply · Private DM** (Public selected) with the line "Everyone can
   see this reply" → **Reply** → it appears under the comment on Instagram.
3. **A comment, answered privately.** Switch to **Private DM** → line "Sends one DM to @ayesha.
   Instagram allows one per comment." → **Send DM** → the comment shows "Answered by DM ›" which
   opens the new DM conversation.
4. **Hide a rude comment.** Comment thread ⋯ → **Hide on Instagram** (pending "Hiding…") → the
   comment greys with "Hidden on Instagram" and **Unhide**.
5. **Message access off.** Tab shows a note "Replies from here are off in Instagram" with
   **Show me how** (the connect-instagram "Turn on replies" sheet); comments still arrive.
6. **Private account.** Tab note "Your account is private, so Instagram doesn't send us comments.
   DMs still arrive."

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Instagram tab | Inbox `?tab=instagram`, chips "Messages · Comments" under the tab | New | R1, R2, R8 |
| Comment thread | Thread with the post on top | New | R2, R4, R5 |
| Story reply bubble | Thread | New | R1 |

## State matrix — Instagram specifics
| State | What the shop sees | Action |
|---|---|---|
| DM within 24 h | Reply box free | Send |
| DM 24 h–7 days | "Only a person can reply now · 4 days left" | Send |
| DM after 7 days | "Instagram allows no replies after 7 days." | Open in Instagram |
| Comment, public | "Everyone can see this reply" | Reply |
| Comment, private already sent | "You've already sent a DM for this comment." Private option explains on tap | Open DM |
| Comment over 7 days | Private option: "Private replies close 7 days after a comment." | Public reply |
| Hidden comment | Greyed, "Hidden on Instagram" | Unhide |
| From the app | Shop's bubble marked "From the app" | — |
| Message access off | Tab note | Show me how |
| Private account | Tab note | — |
| Disconnected | Threads readable; box "Instagram is disconnected. Reconnect to reply." | Reconnect |
| Many comments on one post | Post row "24 comments · 6 new"; inside, newest first | — |
| Phone / tablet / desktop | As inbox-core | — |

## Copy deck
- "Replied to your story", "Mentioned you in their story", "Commented on your post".
- "Public reply", "Private DM", "Everyone can see this reply", "Sends one DM to @<handle>. Instagram allows one per comment.", "Answered by DM".
- "Hide on Instagram" → "Hiding…" → "Hidden on Instagram"; "Unhide".
- Tab notes as in the journeys.

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
