# Spec — social-selling/post-composer

- **Summary:** A shop composes a post, carousel, reel or story from pictures in its library, a caption and the products it is about, sends it now or at a chosen minute to any of its destinations, and sees each destination scheduled, published or failed
- **Status:** Draft
- **Domain:** social
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q3, Q7, Q8, Q26, Q51), [instagram-publishing](../instagram-publishing/spec.md), [whatsapp-status-kit](../whatsapp-status-kit/spec.md), [ai-images/social-posts](../../ai-images/social-posts/spec.md), [media-library](../../media-library/)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Post.
> Knows no platform: each destination is a plug (instagram-publishing, whatsapp-status-kit).

## What this feature is
A Posts page and a composer. The shop picks pictures or a video from its library, writes a
caption, names the products the post is about, picks where it goes, and sends it now or schedules
it. Other modules add their own panel to the composer, such as comment-to-DM.

## Why
A shop posting to Instagram and to its Status today does each by hand on the phone, at the moment
it remembers. One composer, fed by the library and its AI-made pictures, lets it plan the week's
posts in one sitting and see what went out (parent Q51).

## Requirements
- R1 — Any member composes from media already in the shop's library; an upload lands in the library
  first. A "Make a picture" button opens post generation, whose result lands in the library and is
  picked like any other (parent Q26).
- R2 — A post is one image, a carousel of 2–10 images, a reel (one video) or a story (one image or
  video), within what each destination accepts (Q4).
- R3 — A post picks any of its destinations, Instagram feed, Instagram story and WhatsApp Status,
  and is scheduled once. A destination shows only where it can work: Instagram once connected,
  Status always (Q4).
- R4 — The caption takes hashtags and @mentions as typed, within 2,200 characters and 30 hashtags;
  over a limit the field says so and Schedule explains on tap, never disabled (Q4).
- R5 — Fields only one destination has (people tagged, collaborators, location on Instagram) come
  from that destination's plug and show only when it is picked.
- R6 — A post may name up to 10 products it is about. The composer keeps that list and nothing else
  of other modules: comment-to-DM and later panels store their own settings, keyed by the post (Q6).
- R7 — A post goes now or at any minute up to 60 days ahead, in IST, and starts publishing within two
  minutes of its time (Q5).
- R8 — Each destination has its own state: Scheduled, Publishing, Published with a link, or Failed
  with the reason and Publish now (or Reconnect when the connection is gone). A temporary failure is
  retried three times over about 30 minutes first. The post's line shows the worst ("1 of 2 failed")
  (parent Q51).
- R9 — A failure, and a Status falling due, tell the shop through notifications-core.
- R10 — A scheduled post can be edited or cancelled until its publish starts; then it is locked,
  and once published read-only with its link. Duplicate starts a new draft from it (Q7).
- R11 — The Posts page lists Scheduled (soonest first), Published (newest first) and Failed, phone
  first (Q7).

## Hazards the TRD must answer
- **A post published twice** when its time's job runs twice or a retry overlaps.
- **A destination that disappears** (Instagram disconnected) between scheduling and its time.
- **Media deleted or replaced in the library** after the post was scheduled.
- **The worker down at a post's time:** catching up late, or holding for the shop to decide.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A member picks two library pictures, writes a caption with a hashtag, names one product, picks
  Instagram feed and Status, schedules for 6pm, and sees both destinations Scheduled.
- A2 — At 6pm the feed post is Published with a link and the Status is Ready for Status.
- A3 — A failed destination shows its reason and Publish now; the other stays Published.
- A4 — Editing a scheduled post changes what is published; cancelling keeps it as cancelled.
- A5 — With Instagram not connected, only Status is offered, with a line on connecting Instagram.
- A6 — "Make a picture" returns an AI-made picture into the library and into the post.

## Scope
- **Outcome:** a shop composes and schedules a post and sees each destination's state.
- **In:** R1–R11, tested by A1–A6.
- **Later:** a calendar view (Q7); Facebook Page and Threads destinations (parent Q21); insights (parent Q21).

## Open questions
None.
