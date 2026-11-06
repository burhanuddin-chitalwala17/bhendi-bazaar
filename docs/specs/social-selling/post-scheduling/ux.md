# UX — social-selling/post-scheduling

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [prototype.html](prototype.html) (journeys 1, 2 and 4; shared with instagram-publishing and whatsapp-status-kit). Open locally; artifact publishing was unavailable in this session
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Buttons are never disabled; an action that cannot happen explains itself on
> tap. Every string below is the string that ships.

## Journeys
1. **Schedule a post.** Shop menu → Posts → New post → choose photos or a video from the library →
   caption and destinations → products and comment DM (or Skip) → Now or a time → Schedule post →
   back on Posts with "Post scheduled for Sat, 7 Nov, 7:00 pm." and the row at the top.
2. **It publishes, or fails.** At its time each destination turns Publishing, then Published (with
   View on Instagram) or Failed with one reason and the action that fixes it. A failure also reaches
   the shop through notifications (parent Q66), linking here.
3. **Change or cancel.** Posts → a scheduled post → Edit (the composer, filled) or Cancel post
   (confirm sheet) or Duplicate. Too late to edit → the refusal, offering Duplicate.
4. **Goes wrong while composing.** Too many photos, a video in a carousel, a caption too long, a
   past time: each says what to change at the field, and Schedule post explains on tap.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Posts list | `/org/[orgId]/posts`, menu item "Posts" under Channels (Q13) | New | R6, R9 |
| Media picker | Sheet over the composer (library's existing picker) | Reused | R1 |
| Composer | `/org/[orgId]/posts/new`, `/posts/[postId]/edit` | New | R1–R5 |
| Post detail | `/org/[orgId]/posts/[postId]` | New | R6–R8 |
| Cancel confirm | Bottom sheet on phone, dialog from `md:` | New | R8 |
| Dashboard line | `/org/[orgId]`, from notifications | Changed (notification-hub) | R7 |

## State matrix — Posts list
| State | What the person sees | Action |
|---|---|---|
| First use | Note "Plan posts for Instagram and WhatsApp Status from photos in your library. Pick photos, write a caption, choose when." and "No posts scheduled yet." | New post |
| Empty | Published: "Nothing published yet." Failed: "No failed posts." | New post |
| Loading | Three skeleton rows under the tabs | — |
| Partial | A row with mixed destinations shows "1 of 2 failed" in red beside its chips | Open the post |
| Success | After scheduling: note "Post scheduled for <day, date, time>." and the row first | — |
| Retryable error | "Couldn't load your posts. Check your connection and try again." | Try again |
| Terminal error | n/a — loading a list can always be retried | — |
| Refused | Shop suspended: the portal's existing suspended screen | — |
| Stale | n/a — read fresh on each visit; a publishing row updates on reload | Pull to refresh |
| Long content | Caption one line, ellipsis; full on the post page | — |
| Many items | 20 per tab, "Show more" | Show more |
| Slow | Skeletons, then "Still loading…" after 3 s | — |
| Phone / tablet / desktop | One column, docked New post / list left and post right (`md:`) / same, New post in header (`lg:`) | — |

## State matrix — Composer
| State | What the person sees | Action |
|---|---|---|
| First use | Empty library: "Your library is empty. Upload photos to post them." | Upload to library |
| Empty | Nothing picked: "Pick at least one photo or video." on Next | Choose photos |
| Loading | Picker tiles as skeletons | — |
| Partial | Some destinations unavailable: Instagram rows read "Connect Instagram to post here" | Connect Instagram → Channels |
| Success | Schedule post → Posts with the success note | — |
| Retryable error | "Couldn't save your post. Check your connection and try again." Inputs kept | Try again |
| Terminal error | Field errors: "A carousel takes up to 10 photos." · "Carousels take photos only. Post the video as a reel." · "Instagram allows 2,200 characters. Shorten by <n>." · "Instagram allows 30 hashtags. Remove <n>." · "A story takes one photo or one video." · "That time has passed. Pick a later time or choose Now." · "You can schedule up to 60 days ahead." · "Pick where to post." | Fix the field |
| Refused | Editing a post that started publishing: "This post started publishing at <time>, so it can't be changed. Duplicate it to post a new version." Another member saved first: "Someone else changed this post. Reload to see their version." | Duplicate / Reload |
| Stale | n/a — the version check above covers it | — |
| Long content | Caption grows to 8 lines then scrolls; counter "<n> / 2,200 · <h> / 30 hashtags" | — |
| Many items | Library of hundreds: the picker's own search and paging | — |
| Slow | Schedule post shows a spinner and "Scheduling…" | — |
| Phone / tablet / desktop | Four steps / one page, two columns (`md:`) / adds a feed and story preview column (`lg:`) | — |

## State matrix — Post detail (per destination)
| State | Chip | Body | Action |
|---|---|---|---|
| Scheduled | Scheduled | "<day, date> · <time>" | Edit · Duplicate · Cancel post |
| Publishing | Publishing… | "Started <time>" | Duplicate |
| Published | Published | "<day, date> · <time>" (+ link from the plug) | View on Instagram · Duplicate |
| Failed, retried out | Failed | "<platform> didn't answer after 3 tries. Try again now." | Publish now |
| Failed, needs change | Failed | The plug's reason (instagram-publishing ux.md) · "A photo in this post was removed from your library." | Duplicate and change |
| Failed, connection | Failed | "<platform> isn't connected any more. Reconnect it, then publish again." | Reconnect <platform> |
| Cancelled | Cancelled | "Cancelled by <name> · <time>" | Duplicate |

## Copy deck
- Menu: "Posts". Buttons: "New post", "Use <n> photos", "Use video", "Upload to library", "Next",
  "Skip — no products", "+ Add product", "Schedule post", "Post now", "Edit", "Duplicate",
  "Cancel post", "Keep it", "Publish now", "Reconnect Instagram", "Show more", "Try again".
- Composer labels: "Caption", "Post to", "Instagram feed", "Instagram story", "WhatsApp Status · you
  share it from your phone", "What's this post selling?", "Comment keyword", "DM we'll send",
  hint "Suggested from your products. Change it to anything.", "When should it go?", "Now", "Later",
  hint "India time. Up to 60 days ahead."
- Cancel sheet: "Cancel this post?" / "It won't be published anywhere. You can duplicate it later."
- Toast: "Post scheduled for <day, date, time>." · "Post cancelled." · "Publishing now."

## Sign-off
Awaiting the owner's review of the prototype.
