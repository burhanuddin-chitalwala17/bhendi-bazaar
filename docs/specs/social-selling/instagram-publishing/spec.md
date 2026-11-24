# Spec — social-selling/instagram-publishing

- **Summary:** A post's Instagram destinations reach the shop's connected account at their time, as a feed image, carousel, reel or story with everything Instagram's publishing allows, once, with a link when published or Instagram's reason in plain words when not
- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q1, Q18, Q51), [post-composer](../post-composer/spec.md), [connect-instagram](../connect-instagram/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0077](../../../adr/0077-the-pixel-promise-belongs-to-the-backdrop-tools-and-an-ai-picture-is-labelled-and-secondary.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Post.
> The Instagram plug for post-composer; stands on connect-instagram.

## What this feature is
What happens when a post's Instagram feed or story destination falls due: the picture or video
goes to Instagram in the shape it accepts, with the caption, tags and collaborators, and the
composer learns whether it worked.

## Why
Instagram's API publishes but does not schedule, refuses media it does not like in its own terms,
and limits how many posts an account may publish a day. The shop should see none of that: only
Published with a link, or a reason it can act on (parent Q51).

## Requirements
- R1 — A destination due now is published to the shop's connected account within two minutes of
  its time.
- R2 — It is published once, never twice, however often the work is retried (Q2).
- R3 — Pictures reach Instagram in the size and format each destination accepts (feed square or
  4:5, story 9:16); a video Instagram refuses fails with its reason in plain words (Q2).
- R4 — Everything Instagram's publishing allows is offered as fields in the composer: hashtags and
  @mentions in the caption, people tagged on feed images and stories, up to three collaborators on
  a feed post or reel, and a location where the API accepts one. Stickers, music and product tags
  are not offered, since the API cannot publish them (Q9, parent Q18).
- R5 — Before publishing, the account's remaining daily allowance is read; at zero the destination
  fails at once with when to try again, and Publish now (Q5).
- R6 — A temporary failure is retried as post-composer says; a refusal (media, caption) fails at
  once with Instagram's reason in our words; a lost connection fails with Reconnect (Q5).
- R7 — A published destination shows when it was published and opens the post on Instagram.
- R8 — A post using an AI-made picture reminds the shop, before scheduling, how Instagram expects
  realistic AI pictures to be disclosed (Q10).

## Hazards the TRD must answer
- **A container expires** (24 hours) or is still processing when its time comes.
- **A retry after Instagram published** but before we heard back: published twice.
- **The daily allowance** spent by posts the shop made in the Instagram app.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A feed post with two pictures, a caption with hashtags, a tagged person and a collaborator
  appears on the shop's Instagram at its time, and the composer shows Published with the link.
- A2 — A story appears at its time as a 9:16 story.
- A3 — A video Instagram refuses shows its reason in our words; nothing is posted.
- A4 — A retried job after a successful publish leaves one post on Instagram.
- A5 — With the daily allowance used, the destination says when to try again.
- A6 — A post with an AI-made picture shows the disclosure reminder before scheduling.

## Scope
- **Outcome:** scheduled posts reach the shop's Instagram once, with everything it allows, or say why not.
- **In:** R1–R8, tested by A1–A6.
- **Later:** insights (parent Q21).

## Open questions
Q10.
