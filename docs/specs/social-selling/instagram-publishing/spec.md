# Spec — social-selling/instagram-publishing

- **Summary:** A scheduled post reaches the shop's connected Instagram as a feed image, carousel, reel or story at its time, with a link to it once published or Instagram's reason if not
- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [connect-instagram](../connect-instagram/spec.md), [post-scheduling](../post-scheduling/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 6 of
> social-selling: the Instagram plug for post-scheduling. ⏳ behind the single review (parent Q2).

## What this feature is
The Instagram feed and Instagram story destinations in post-scheduling become real. At a post's
time, it is published to the shop's own Instagram account, and the Posts page shows it published
with a link, or failed with Instagram's reason in plain words.

## Why
Post-scheduling is built against a fake publisher so it can be proven without Meta. This plug is
what makes it reach the shop's followers, from the shop's own account (parent Q3). Instagram has no
scheduling of its own, so we hold the time and publish at it (Q1).

## Requirements
- R1 — A post with an Instagram destination publishes to the shop's connected account within two
  minutes of its time, as the shape it was scheduled as: image, carousel, reel or story (parent Q51).
- R2 — It is published once, never twice, however often the work is retried (Q7).
- R3 — Pictures reach Instagram in the size and format it accepts for each destination; a video it
  refuses fails with the reason (Q3, Q4).
- R4 — A published destination shows when and a link to the post on Instagram (Q8).
- R5 — A temporary failure is retried as post-scheduling says; a refusal fails at once with
  Instagram's reason in plain words; a revoked connection fails at once and offers Reconnect (Q6).
- R6 — When the account's daily publishing limit is reached, the destination says so, with when it
  can be tried again, and is not retried by itself (Q5).
- R7 — Captions may @mention accounts; nothing claims a product tag (parent Q18) or a sticker (Q9).
- R8 — Instagram's text never reaches the shop raw: every failure maps to a short reason we wrote,
  and response bodies are never logged.

## Hazards the TRD must answer
- **A container made too early expires** (24 hours) before a far-off post's time (Q2).
- **The answer is lost after a successful publish**, so a retry posts again (Q7).
- **A carousel half made**: some items uploaded, one refused.
- **A container still processing** (video) when publish is called.
- **The daily limit reached** mid-way through a busy day of scheduled posts (Q5).
- **The token expires or is revoked** between scheduling and publishing.

## Product acceptance
On the owner's account on dev, before review (Q10).
- A1 — A single-image post scheduled for 7pm appears on the owner's Instagram feed by 7:02pm, and
  the Posts page shows Published with a working "View on Instagram".
- A2 — A carousel of three, a reel from the library, and an image story each publish as that shape.
- A3 — A publish whose answer is dropped and retried leaves exactly one post on Instagram.
- A4 — A video Instagram refuses shows Failed with a plain reason, at once, without retries.
- A5 — With the daily limit used up, the next post fails with the limit reason and a time.
- A6 — With the app removed inside Instagram, a due post fails at once with Reconnect, and the
  connection card reads Needs reconnecting.

## Scope
- **Outcome:** scheduled posts reach the shop's Instagram, once, or say why not.
- **In:** R1–R8, tested by A1–A6. No UI of its own beyond post-scheduling's states (ux.md lists the
  Instagram-specific reasons and links).
- **Later:** insights (parent Q48); user tags, collaborators, location (Q9).

## Open questions
None.
