# Spec — social-selling/comment-automations

- **Summary:** A buyer who comments the shop's keyword on its Instagram post gets one DM with what the shop chose to send, the product link suggested, and optionally a public reply
- **Status:** Draft
- **Domain:** automations (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [post-scheduling](../post-scheduling/spec.md), [inbox-instagram](../inbox-instagram/), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 8 of
> social-selling; it needs inbox-instagram's comment events.

## What this feature is
Comment-to-DM. Under a post a buyer writes "SHOP", and seconds later gets a DM from the shop with
the product's link, or whatever the shop wrote instead. The rule is set when the post is scheduled;
a shop-wide rule covers posts made anywhere else.

## Why
An Instagram caption cannot hold a clickable link (parent Q39). Comment-to-DM is how Indian shops
turn a post into a sale today, through paid tools that know nothing of their stock. It costs the
shop nothing with Meta (parent Q6), and the link lands the buyer on the product page here.

## Requirements
- R1 — A post's rule is its products, keyword and DM text, set when scheduling (post-scheduling);
  this subfeature adds nothing to set per post (Q1).
- R2 — A shop may also set one shop-wide rule, used for any of its posts with no rule of its own,
  including posts made in the Instagram app (Q2).
- R3 — A comment matches when it holds the keyword as a whole word, ignoring case and punctuation
  (Q3). Comments by the shop itself, and replies within a thread, never match (Q9).
- R4 — A match sends the rule's DM: the product links by default, or the shop's own words (Q4,
  parent Q53). A public reply goes too only if the shop turned it on (Q5).
- R5 — One DM per comment, ever, and at most one per person per post, whatever Meta redelivers
  or the worker retries (Q6, Q7).
- R6 — A comment older than 7 days when reached gets nothing, and says so (Q8).
- R7 — A burst of comments is answered within Meta's rate limit; none under 7 days old is dropped
  (Q10).
- R8 — Each post shows its rule, DMs sent today and in total, and its recent matches with their
  outcome; each DM appears in the inbox marked Automatic (Q11).
- R9 — A rule can be paused and resumed without losing its settings (Q12).
- R10 — An archived product's link is never sent; if nothing the shop wrote would remain, nothing
  is sent and the activity says why (Q13).
- R11 — The tool knows no platform: comments arrive as neutral events and replies leave through a
  port, so another platform is a new plug (Q14, parent Q7). No AI (Q15).

## Hazards the TRD must answer
- **Double DMs**: Meta delivers a webhook more than once, and the worker retries a send that may
  have reached Meta.
- **Two rules match one comment** (the post's and the shop-wide): which one, and only one.
- **A viral post**: thousands of matches in an hour against a per-post limit.
- **A rule edited while sends are in flight**: which text goes.
- **Comment events that may not reach us before review** (parent Q81): acceptance on recorded
  payloads first, live after approval.

## Product acceptance
Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).
- A1 — A comment "Shop 🙏" on a post with keyword SHOP gets one DM with the product link; the
  post's activity shows Sent.
- A2 — The same webhook delivered twice, and a second matching comment by the same person, send
  nothing more.
- A3 — A shop that rewrote the DM has its words sent, not the suggestion.
- A4 — With the public reply on, "Sent you a DM 📩" appears under the comment; off, nothing public.
- A5 — A comment on a post made in the Instagram app gets the shop-wide rule's DM.
- A6 — A comment reached after 7 days, a comment by the shop, and a paused rule send nothing,
  each with its reason in the activity.
- A7 — 1,000 matching comments in a minute (recorded payloads, fake port) are all answered, none
  twice, at no more than the configured rate.
- A8 — Every state in ux.md's matrices is reachable and reads as written.

## Scope
- **Outcome:** a keyword comment gets the shop's DM, the product link suggested.
- **In:** R1–R11, tested by A1–A8.
- **Later:** several shop-wide rules; story-mention automations (decisions, Parked). Outside: AI
  replies (parent Q31).

## Open questions
None.
