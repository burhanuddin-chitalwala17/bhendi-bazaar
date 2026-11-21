# Spec — social-selling/whatsapp-status-kit

- **Summary:** At a post's time, its picture and caption are ready on the shop's phone, and one tap hands them to WhatsApp to post as a Status
- **Status:** Draft
- **Domain:** social
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [post-scheduling](../post-scheduling/spec.md), [notification-hub](../../notification-hub/spec.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 14 of
> social-selling: the WhatsApp Status destination for post-scheduling. Not behind Meta's review.

## What this feature is
WhatsApp Status as a destination in post-scheduling. WhatsApp has no way for an app to post a
Status (parent Q18), so at the post's time the picture and caption are made ready, the shop is told,
and on the phone one tap hands them to WhatsApp, where the shop posts them to My Status.

## Why
Indian shops sell on WhatsApp Status every day, by hand. Planning a Status beside the Instagram post
it goes with, and having it ready at the right moment, removes the copy-paste without promising what
WhatsApp does not allow. The shop stays in Bhendi Bazaar until the last tap (parent Q18).

## Requirements
- R1 — A post may tick WhatsApp Status as a destination, with or without WhatsApp connected (Q7).
- R2 — At its time, the destination turns Ready for Status and the shop is told through
  notifications, once per post (parent Q18, Q4, parent Q66).
- R3 — On a phone, Share to Status hands the picture or video, sized for Status, and the caption to
  WhatsApp in one tap; the caption is also copied, so it survives apps that drop shared text (Q2).
- R4 — Where the device cannot share files, the shop can download the picture and copy the caption,
  and is told to open it on the phone (Q2).
- R5 — The destination turns Published only when the shop says it posted it; it can also be marked
  skipped (Q4).
- R6 — A Status not posted within 24 hours stays shareable but stops counting as due (Q4).
- R7 — Nothing here claims to post to WhatsApp, or reads anything back from it.

## Hazards the TRD must answer
- **The share sheet drops the caption** on some phones and apps (Q2).
- **No file sharing** on desktop and some browsers (Q2).
- **The picture's address** must be one the phone can download without signing in, yet not guessable.
- **A notification fired twice** for the same post's time.

## Product acceptance
Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).
- A1 — A post scheduled with WhatsApp Status for 7pm reads Ready for Status at 7pm, and the shop gets
  one "post due" notice.
- A2 — On an Android phone, Share to Status opens the share sheet with the 9:16 picture; picking
  WhatsApp Business opens its Status editor; the caption pastes from the clipboard.
- A3 — The same on an iPhone with WhatsApp.
- A4 — On a desktop browser, Download image and Copy caption work, with the phone hint.
- A5 — "I've posted it" turns the destination Published; a day later an unposted one reads Not posted.
- A6 — Every state in ux.md's matrix is reachable and reads as written.

## Scope
- **Outcome:** a shop's Status is ready on time and one tap from WhatsApp.
- **In:** R1–R7, tested by A1–A6.
- **Later:** none. Posting to Status by API does not exist (parent Q18).

## Open questions
None.
