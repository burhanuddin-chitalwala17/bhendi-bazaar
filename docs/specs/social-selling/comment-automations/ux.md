# UX — social-selling/comment-automations

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [prototype.html](prototype.html) (local file, shared with [whatsapp-catalogue](../whatsapp-catalogue/ux.md); to be published as a private artifact once a claude.ai login is available)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [post-scheduling ux](../post-scheduling/), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Buttons are never disabled; an action that cannot happen explains itself on
> tap. Every string below is the string that ships.

## Journeys
1. **A post sells by DM.** Posts → New post → step "Sell from this post" (post-scheduling's
   screen): products, keyword, DM pre-filled, public reply switch → Schedule. A buyer comments
   "Shop 🙏" → gets the DM within a minute → the post's Comment DMs section shows Sent.
2. **Any post.** Channels → Instagram card → Comment DMs → fill keyword and DM → Turn on. A
   comment on a post made in the Instagram app gets this DM.
3. **Pause.** Post detail or the shop-wide rule → Pause → chip Paused; Resume restores it.
4. **It does not send.** A row shows Already sent, Too late, Not sent (with the reason) or Waiting;
   tap shows the reason and, where one exists, the fix (Reconnect, Edit DM).
5. **It keeps failing.** Five failures in an hour → a Home line through notifications → Open post.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Comment DMs section | Post detail, `/org/[orgId]/posts/[postId]` | New section | R1, R4, R8, R9 |
| Comment DMs for any post | `/org/[orgId]/channels/instagram/comment-dms`, from the Instagram card | New | R2, R9 |
| Activity row detail | Panel over post detail (ADR-0040 detail panel) | New | R5–R7, R10 |
| Instagram card | On Channels | Changed: "Comment DMs ›" link | R2 |
| Home line | `/org/[orgId]`, via notifications | Changed | R8 (failing) |

## State matrix — Comment DMs section (post detail)
| State | What the person sees | Action |
|---|---|---|
| First use | Post has no keyword: "This post has no comment DM. Comments here get your shop-wide DM if it's on." | Edit post |
| Empty | Rule on, no matches yet: "No comments with SHOP yet." | Pause |
| Loading | Two-line skeleton under the heading | — |
| Partial | Rows with mixed outcomes: Sent, Already sent, Too late, Not sent, Waiting | Tap a row |
| Success | "12 DMs sent today · 48 in total" and Sent rows | Pause |
| Retryable error | "Couldn't load comment DMs. Try again." | Try again |
| Terminal error | Rule's product archived and DM unchanged: "The product in this DM was archived, so there is no link to send. Edit the post's DM to send something else." | Edit DM |
| Refused | Instagram needs reconnecting: "Instagram needs reconnecting. DMs resume once it's connected." | Reconnect |
| Stale | n/a — read fresh on each visit; counts are as of the read | — |
| Long content | Comment excerpt cut at 120 characters with "…"; full text in the row detail | — |
| Many items | Last 50 rows, newest first; "Showing the latest 50" under the list | — |
| Slow | Skeleton stays; after 3 s "Still loading…" | — |
| Phone / tablet / desktop | One column / same at `md:` / section sits in the post detail's right column at `lg:` | — |

## State matrix — Comment DMs for any post
| State | What the person sees | Action |
|---|---|---|
| First use | Intro: "When someone comments your keyword on a post that has no DM of its own, we send them this message. Works on posts you made in the Instagram app too." Keyword SHOP, DM pre-filled with the store link | Turn on |
| Empty | n/a — the form is the content | — |
| Loading | Form skeleton | — |
| Partial | n/a — one rule | — |
| Success | Toast "Comment DMs saved." Chip On; "3 DMs sent today" | Save changes · Pause |
| Retryable error | Toast "Couldn't save. Try again." Form keeps what was typed | Save changes |
| Terminal error | Field errors: "Use one word of 2–20 letters or numbers." · "Keep the DM under 1,000 characters." · "Keep the public reply under 300 characters." | Fix the field |
| Refused | Instagram not connected: "Connect Instagram first. Comment DMs work on its posts." | Connect Instagram |
| Stale | n/a | — |
| Long content | DM box grows to 8 lines, then scrolls; counter "640 / 1,000" | — |
| Many items | n/a | — |
| Slow | Save shows "Saving…" in the button | — |
| Phone / tablet / desktop | One column at every size, the portal form width | — |

## Copy deck
- Section heading: "Comment DMs" · counts: "{n} DMs sent today · {m} in total"
- Chips: "On" · "Paused" · "Sent" · "Already sent" · "Too late" · "Not sent" · "Waiting" · "Automatic" (inbox)
- Row reasons: "This person already got your DM for this post." · "Instagram only lets shops reply by
  DM within 7 days of a comment." · "Instagram needs reconnecting. DMs resume once it's connected." ·
  "The product in this DM was archived, so there was no link to send. Edit the post's DM to send
  something else." · "Lots of comments at once. We're sending them as fast as Instagram allows." ·
  "Instagram didn't accept this DM: {reason}"
- Paused line: "Nothing is sent while paused. Your settings are kept."
- Buttons: "Turn on" · "Save changes" · "Pause" · "Resume" · "Edit DM" · "Reconnect" · "Try again"
- Default public reply: "Sent you a DM 📩" · default DM: "Here's the link 👇" then one line per
  product, "{name}: {link}"
- Home line: "Comment DMs aren't going out on {n} post(s)." → "Open post"

## Sign-off
Pending the owner's review.
