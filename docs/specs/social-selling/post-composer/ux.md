# UX — social-selling/post-composer

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/post.html](../prototypes/post.html), sections "Posts page", "Compose", "Schedule", "After it goes"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md), [instagram-publishing ux](../instagram-publishing/ux.md), [whatsapp-status-kit ux](../whatsapp-status-kit/ux.md), [ai-images/social-posts ux](../../ai-images/social-posts/ux.md), [comment-automations ux](../comment-automations/ux.md)

> One page to plan a post and send it everywhere at once. The composer asks for what the shop
> already has in mind, in that order: the pictures, where it goes, the words, the products, when.
> It never asks the shop to name a shape: one picture is a post, two to ten a carousel, a video a
> reel, and a story is just a place to send it (R2, derived rather than chosen).

## Journeys
1. **Plan a post.** Menu → **Posts** → **New post** → composer: **Add pictures** opens the library
   picker (multi-select, in tap order) → two picked, a strip shows them with "Carousel · 2" →
   **Where** chips: Instagram post ✓, WhatsApp Status ✓ → caption typed, or **Write a caption** →
   **Products**: one picked → **When**: chip "Today 6 pm" → **Schedule** (pending "Scheduling…") →
   back on Posts, Scheduled tab, the new row on top with both destinations Scheduled; toast
   "Scheduled for today, 6:00 pm."
2. **Make the picture here.** In Pictures, **Make a picture** → Improve with AI's window, shaped for
   the post (ai-images/social-posts) → **Use this** → the picture joins the strip, already in the
   library.
3. **Post now.** **When**: "Now" → the button reads **Post now** (pending "Posting…") → Posts,
   Published tab, the row Publishing, then Published with links.
4. **See how it went.** At the time each destination turns Publishing → Published ("View on
   Instagram") or Ready for Status (the Status kit). A failure shows on the row as "1 of 2 failed"
   and arrives as a notification; the post opens with the reason and **Publish now** or
   **Reconnect** against that destination only.
5. **Change or cancel.** Scheduled row → post → **Edit** → composer with everything filled → **Save
   changes** (pending "Saving…") → toast "Changes saved." Or ⋯ → **Cancel post** → sheet "Cancel
   this post? It won't be published. You can duplicate it later." → **Cancel post** → it moves under
   "Cancelled" at the foot of the Scheduled tab.
6. **Do it again.** Published row → ⋯ → **Duplicate** → composer with the same pictures, caption,
   products and panels, **When** empty.
7. **Come back to a draft.** Leave the composer half-done → Posts shows "2 drafts" at the top of
   Scheduled → tap → the composer as left, "Draft saved · 4 min ago" (ux-patterns §5).

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Posts page | `/org/[orgId]/posts`, tabs `?tab=scheduled\|published\|failed` | New | R1, R8, R11 |
| Composer | `/org/[orgId]/posts/new`, `/posts/[postId]/edit`; full page on a phone, `TaskDialog` from `lg:` with a live preview beside it | New | R1–R7, R10 |
| Library picker | `ResponsivePicker` over the composer (the media-library picker, multi-select) | Reused, multi-select added | R1, R2 |
| Product picker | `ResponsivePicker`, search and recent products first | Reused | R6 |
| When picker | Chips plus a date-and-time sheet | New | R7 |
| Post detail | `/org/[orgId]/posts/[postId]`: preview, each destination's state and action | New | R8, R10 |
| Cancel sheet | `HandoffSheet` | New | R10 |

## The composer, top to bottom
1. **Pictures.** Strip of thumbnails, drag to reorder (on a phone: long-press then drag; a ⋯ on
   each also offers Move left/right and Remove); **Add pictures** and **Make a picture**. Under the
   strip one line names what it will be: "Post", "Carousel · 4", "Reel", or for a mix "A carousel
   takes pictures only. Remove the video or pick it alone for a reel."
2. **Where.** One chip per destination: **Instagram post**, **Instagram story**, **WhatsApp
   Status**. Instagram chips appear only when connected; otherwise a quiet line "Connect Instagram
   to post there too" links to Channels and returns here (R3, A5). A story or Status with several
   pictures uses the first, said under the chip: "Story uses your first picture."
3. **Caption.** Text area, counter "1,840 / 2,200 · 4 / 30 #" shown from 80% of either limit;
   **Write a caption** above it. Hidden when only a story is picked (a story has no caption), with
   the line "Stories don't show a caption."
4. **Products.** "What's this post about?" · up to 10 as chips with photo; **Add products**. The
   one line of why: "Used to answer comments and DMs, and to write your caption."
5. **More for Instagram** (shown when an Instagram chip is on, folded by default): Tag people,
   Collaborators (up to 3), Location (instagram-publishing).
6. **Panels from other modules**, each folded with a one-line summary when set: "Comment-to-DM ·
   keyword SHOP" (comment-automations).
7. **When.** Chips **Now** · **Today 6 pm** · **Tomorrow 10 am** · **Pick a time** (the next two
   chips are the shop's own two most-used times once it has them). Picked time in words: "Fri 28
   Nov, 6:00 pm".
8. **Action bar** (sticky at the foot): **Preview** (secondary) and **Schedule** / **Post now** /
   **Save changes**. "Draft saved · just now" sits above it.

Every rule is shown where it applies and explains itself on tap of Schedule (ux-patterns §3): the
button is never disabled; tapping it with a problem scrolls to the first one and marks it.

## State matrix — Composer
| State | What the shop sees | Action |
|---|---|---|
| First use | Empty strip with **Add pictures** and **Make a picture**, a one-line hint "Pick the pictures first; everything else follows." Where pre-ticks every connected destination | Add pictures |
| Empty | = First use | — |
| Loading | Edit/duplicate: fields as skeletons, then filled | — |
| Partial | Draft: "Draft saved · 4 min ago" | Carry on |
| Success | Schedule → Posts with the row on top, toast "Scheduled for <when>." | — |
| Retryable error | Inline under the bar: "Couldn't schedule. Your draft is safe. Try again." | Try again |
| Terminal error | Post started publishing while being edited: "This post has started publishing and can't be changed now." | See post |
| Refused | Over a limit, no picture, no destination, time in the past or past 60 days: the field marks itself in red with its reason; Schedule scrolls to the first | Fix field |
| Stale | A picture deleted from the library: its thumbnail greyed, "This picture was deleted from your library. Pick another." | Replace |
| Long content | Caption grows to 8 lines then scrolls inside; the counter stays visible | — |
| Many items | 10 pictures: strip scrolls sideways; picker says "That's the most a carousel takes" at 10 | — |
| Slow | Scheduling past 3 s: "Still working…" | — |
| Phone / tablet / desktop | Phone: one column, Preview as a sheet. Tablet: one column, wider. Desktop: `TaskDialog`, form left, live preview right with a tab per destination | — |

## State matrix — Posts page
| State | What the shop sees | Action |
|---|---|---|
| First use | `EmptyState` "Plan your posts for the week" · "Pick pictures from your library, write once, and send to Instagram and your Status at the times you choose." | New post |
| Empty tab | Scheduled: "Nothing scheduled." Published: "Nothing published yet." Failed: "No failed posts." | New post |
| Loading | Row skeletons | — |
| Partial | A row with mixed results: worst state on the line, "1 of 2 failed" (R8) | Open |
| Success | Row: first picture, caption's first line, when, a small badge per destination (Scheduled · Publishing · Published · Ready for Status · Failed) | Open |
| Retryable error | List failed to load: `ErrorState` "Couldn't load your posts." | Try again |
| Refused | No Social selling plan: Posts in the menu with the lock; the page shows the plan note (ux-patterns §8) | Talk to us |
| Stale | A Ready for Status older than 24 h: "Not posted · was due <time>" | Share |
| Many items | Paged, 20 a page; Published groups by week ("This week", "Last week", dates) | — |
| Phone / tablet / desktop | Rows on a phone; table from `md:` with a column per destination | — |

Tab counts show on Failed only when non-zero (it is the one that needs the shop). Drafts sit as a
folded "2 drafts" line atop Scheduled; cancelled posts as a folded "Cancelled" line at its foot.

## State matrix — A destination on the post detail
| State | Badge | Line | Action |
|---|---|---|---|
| Scheduled | Scheduled | "Fri 28 Nov, 6:00 pm" | Edit · Cancel post |
| Publishing | Publishing (spinner) | "Posting to Instagram…" | — |
| Published | Published | "Posted Fri 28 Nov, 6:01 pm" | View on Instagram |
| Retrying | Publishing | "Instagram didn't answer. Trying again in 10 min (2 of 3)." | Publish now |
| Failed | Failed | The reason in our words (instagram-publishing) | Publish now / Reconnect / Edit |
| Ready for Status | Ready for Status | "Due now" | Share to Status (whatsapp-status-kit) |
| Cancelled | Cancelled | "Cancelled by Farida · 27 Nov" | Duplicate |

## Copy deck
- Menu "Posts"; page title "Posts"; hint "Plan posts for Instagram and your WhatsApp Status."
- Buttons "New post", "Add pictures", "Make a picture", "Write a caption", "Add products",
  "Preview", "Schedule" → "Scheduling…", "Post now" → "Posting…", "Save changes" → "Saving…",
  "Publish now", "Duplicate", "Cancel post".
- Shape lines "Post", "Carousel · <n>", "Reel", "Story uses your first picture.",
  "A carousel takes pictures only. Remove the video or pick it alone for a reel."
- Limits "Captions can be up to 2,200 characters." "Up to 30 hashtags." "Up to 10 products."
  "Pick at least one picture." "Pick where to post." "Pick a time in the future." "You can schedule up to 60 days ahead."
- Toasts "Scheduled for <when>." "Posted." "Changes saved." "Post cancelled." "Draft deleted."
- Cancel sheet "Cancel this post?" · "It won't be published. You can duplicate it later." · "Cancel post" · "Keep it".

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
