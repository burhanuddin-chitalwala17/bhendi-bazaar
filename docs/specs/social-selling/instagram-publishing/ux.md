# UX — social-selling/instagram-publishing

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [../post-scheduling/prototype.html](../post-scheduling/prototype.html), journey 2. Open locally; artifact publishing was unavailable in this session
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [post-scheduling ux](../post-scheduling/ux.md)

> No screen of its own: it fills post-scheduling's destination row for Instagram feed and story.
> Every string below is the string that ships.

## Journeys
1. **Published.** At the post's time the Instagram row turns Publishing…, then Published with the
   time and View on Instagram (opens the post in Instagram's app or site).
2. **Failed, will not fix itself.** The row turns Failed at once with one of the reasons below and
   the action that answers it.
3. **Failed, retried out.** Three temporary failures over about 30 minutes → post-scheduling's
   "Instagram didn't answer after 3 tries. Try again now." with Publish now.
4. **Connection lost.** Failed with Reconnect Instagram → Channels; the Instagram card there reads
   Needs reconnecting (connect-instagram).

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Post detail, Instagram rows | post-scheduling's post page | Changed: real reasons and link | R4–R8 |
| Posts list chips | post-scheduling's list | Unchanged | R1 |

## State matrix — Instagram destination row
| State | What the person sees | Action |
|---|---|---|
| First use | n/a — a row exists only once a post picks Instagram | — |
| Empty | n/a | — |
| Loading | "Publishing…" chip, "Started <time>" | — |
| Partial | Carousel partly uploaded then refused: Failed with the item's reason; nothing was posted | Duplicate and change |
| Success | Feed: "Published · <day, date, time>" + View on Instagram. Story without link: "Published · on your story for 24 hours" | View on Instagram |
| Retryable error | Retried by itself; after three: "Instagram didn't answer after 3 tries. Try again now." | Publish now |
| Terminal error | "Instagram couldn't use this photo. Try a different one." · "Instagram couldn't use this video. Reels and stories take upright videos from 3 to 90 seconds." · "Instagram refused this caption. Remove links or unusual characters and try again." | Duplicate and change |
| Refused | "Instagram's daily limit is reached for this account. Try after <time, day>." · "Instagram isn't connected any more. Reconnect it, then publish again." | Publish now · Reconnect Instagram |
| Stale | n/a — set by the worker, read fresh | — |
| Long content | Reasons wrap; never truncated | — |
| Many items | n/a — at most two Instagram rows per post | — |
| Slow | Video processing: "Publishing… Instagram is processing your video." | — |
| Phone / tablet / desktop | Same row at every width | — |

## Copy deck
- "Publishing…", "Instagram is processing your video.", "Published", "View on Instagram",
  "Published · on your story for 24 hours".
- Reasons as in the matrix; never Instagram's own error text (spec R8).

## Sign-off
Awaiting the owner's review of the prototype.
