# Spec — social-selling/whatsapp-status-kit

- **Summary:** At a post's time its picture and caption are ready on the shop's phone, and one tap hands them to WhatsApp to post as a Status, since WhatsApp lets no app post a Status itself
- **Status:** Draft
- **Domain:** social
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q18, Q51, Q66), [post-composer](../post-composer/spec.md), [notifications-core](../../notification-hub/notifications-core/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Post.
> The WhatsApp Status plug for post-composer. Needs no WhatsApp connection.

## What this feature is
WhatsApp Status as a destination in the composer. Because WhatsApp offers no way for an app to post
a Status, the kit gets the picture and caption ready on the shop's phone at the right time, and the
shop posts it with one tap (parent Q18).

## Why
Status is where Indian shops show new stock to everyone in their contacts, every day. Doing it
from the plan the shop already made in the composer, rather than remembering at the right moment,
is the most the platform can do, and it is honest about that.

## Requirements
- R1 — Any post may pick WhatsApp Status, whether or not WhatsApp is connected (Q7).
- R2 — At the post's time the destination turns Ready for Status and the shop is told it is due,
  through notifications-core, so it reaches the shop on time (Q4, Q9).
- R3 — On a phone, Share to Status hands WhatsApp the picture (or video) sized for Status and the
  caption; the caption is also copied, since some phones drop shared text (Q2).
- R4 — Where the device cannot share files, the shop can download the picture and copy the caption,
  with a line to open this on its phone (Q2).
- R5 — The destination turns Published only when the shop taps "I've posted it", or is marked
  skipped; nothing claims to have posted to WhatsApp or reads anything back from it (Q4).
- R6 — A Status not posted within 24 hours reads "Not posted · was due <time>", still shareable (Q4).

## Hazards the TRD must answer
- **A phone that shares the file but drops the caption,** or crops a non-portrait picture.
- **The due alert arriving late** makes a "6pm Status" a 9pm one.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A post with a Status destination due at 6pm turns Ready for Status at 6pm and the shop is told.
- A2 — On an Android and an iPhone, Share to Status opens WhatsApp's Status with the picture; the
  caption is on the clipboard.
- A3 — On a desktop, Download and Copy caption work, with the line to use the phone.
- A4 — "I've posted it" turns the destination Published; after 24 hours an unposted one reads Not posted.

## Scope
- **Outcome:** a shop's Status is ready on time and one tap from WhatsApp.
- **In:** R1–R6, tested by A1–A4.
- **Later:** none: posting a Status by API does not exist (parent Q18).

## Open questions
None.
