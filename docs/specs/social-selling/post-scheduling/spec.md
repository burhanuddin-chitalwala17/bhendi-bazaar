# Spec — social-selling/post-scheduling

- **Summary:** A shop schedules a post, carousel, reel or story from finished media in its library and a caption, to one or more destinations, and sees each one scheduled, published or failed
- **Status:** Draft
- **Domain:** social (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [instagram-publishing](../instagram-publishing/spec.md), [whatsapp-status-kit](../whatsapp-status-kit/spec.md), [media-library](../../media-library/), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 4 of
> social-selling. It publishes; it never makes the post (parent Q26).

## What this feature is
A Posts page in the shop's portal. The shop picks photos or a video from its media library, writes
a caption, ticks where it should go (Instagram feed, Instagram story, WhatsApp Status), and chooses
now or a time. The post then shows as scheduled, published or failed for each destination.

## Why
Shops post to sell, and today juggle a scheduler beside their stock. Posting from where the
products live means the picture, the caption and the product link come from one place. How the
picture was made is not this feature's business: an upload, an enhanced photo or a future generator
all arrive as finished media (parent Q26). The platforms are plugs, so this tool is built and
proven before any Meta access, against a fake publisher (parent Q7).

## Requirements
- R1 — Any member creates a post from media already in the shop's library and a caption (parent Q26,
  parent Q8). Nothing here edits, generates or captions media for the shop.
- R2 — A post is an image, a carousel of 2–10 images, a reel or a story, within the limits each
  destination accepts (Q4); what would be refused says why before scheduling.
- R3 — A post picks one or more destinations, shown only where they can work (Q4, parent Q51).
- R4 — A post goes now or at a chosen minute up to 60 days ahead, in IST, and publishes within two
  minutes of that time (Q5).
- R5 — A post may name the product(s) it is about and a comment keyword, with a DM text pre-filled
  from the product links that the shop may rewrite; comment-automations reads them (Q6, parent Q89).
- R6 — Each destination of a post has its own state: scheduled, publishing, published (with a link
  where the platform gives one), failed (with the reason), cancelled (parent Q51).
- R7 — A temporary failure is retried three times over about 30 minutes; then the destination is
  failed, offers Publish now, and the shop is told through notifications. A lost connection fails
  at once and offers Reconnect (parent Q51, parent Q51, Q66).
- R8 — A scheduled post can be edited or cancelled until its publish starts; a published one is
  read-only; any post can be duplicated (Q7).
- R9 — The Posts page lists Scheduled, Published and Failed, and works on a phone first (Q7).
- R10 — This tool knows no platform: a destination is a plug, so adding one (Facebook Page,
  Threads; parent Q21) changes no screen logic here (parent Q7).

## Hazards the TRD must answer
- **A post published twice** by two workers, or by a retry after a publish that did succeed.
- **An edit racing the publish**: the shop saves while the worker is sending the old version.
- **A media item deleted or archived** after scheduling, before the time comes.
- **Clock and time zone**: a time chosen in IST stored or compared as anything else.
- **A connection lost** between scheduling and publishing.

## Product acceptance
Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).
- A1 — A member picks two photos, writes a caption, ticks Instagram feed and WhatsApp Status, and
  schedules for tomorrow 7pm; both destinations show Scheduled for that time.
- A2 — At the time, the fake publisher receives the post once per destination, and each shows
  Published.
- A3 — A destination whose plug fails temporarily three times shows Failed with the reason and
  Publish now, and a "post failed" event reaches notifications; the other destination is unaffected.
- A4 — Editing a scheduled post before its time publishes the edited version; editing after the
  publish started is refused with the reason.
- A5 — A carousel of 11 images, a caption over 2,200 characters, or a video in a carousel each
  explains itself before scheduling.
- A6 — A post naming two products and keyword SHOP stores both, with the DM pre-filled from their
  links and rewritable.
- A7 — Every state in ux.md's matrices is reachable and reads as written.

## Scope
- **Outcome:** a shop schedules a post from finished media and sees each destination's state.
- **In:** R1–R10, tested by A1–A7.
- **Later:** calendar view (Q7); insights (parent Q21); Facebook Page and Threads plugs (parent
  Q21). Outside: making media or captions (parent Q26).

## Open questions
None.
