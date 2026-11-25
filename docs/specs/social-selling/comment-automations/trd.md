# TRD — social-selling/comment-automations

- **Status:** Accepted
- **Domain:** automations (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [inbox-core TRD](../inbox-core/trd.md), [post-composer TRD](../post-composer/trd.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A sink on `CommentEvent` that matches the comment against the post's rule (or the shop-wide rule),
claims the comment once, and sends one private reply through inbox's automatic send. Rules are this
domain's rows keyed by post; the composer shows the panel through a slot.

## Prior art
- **ManyChat and LinkDM "comment to DM"**: a keyword per post, a DM with buttons, one DM per
  commenter per post, an optional public reply. We follow the behaviour; Meta's one-private-reply
  rule makes the per-comment claim mandatory.

## Technical decisions
- **D1 — Model.** `CommentRule(id, orgId, postId nullable (null = shop-wide, unique per org),
  keyword, messageTemplate, productIds, publicReply bool, paused bool, version)`;
  `CommentMatch(id, orgId, ruleId, commentId UNIQUE, personKey, postId, outcome
  SENT|FAILED|TOO_LATE|REPEAT|NOTHING_TO_SEND, messageId, at)` with unique (ruleId, postId, personKey)
  where outcome = SENT (one per person per post, Q6).
- **D2 — Default on (Q12).** When a post naming a product is scheduled, post-composer's
  `afterSchedule` hook (a registry like sinks, so social imports nothing) creates the post's rule with
  keyword SHOP and the product DM, unless the panel turned it off.
- **D3 — Matching (R3, Q3).** Normalise to NFKD, strip marks, case-fold, split on non-letters and
  digits; a whole-token equal to the keyword matches. Pure, table-tested with Hinglish and emoji.
- **D4 — Claim and send (R4, R5, R6, R7, Q6).** Insert `CommentMatch` with `ON CONFLICT DO
  NOTHING` on commentId: no row → already handled. Shop's own comments and replies within a thread
  are skipped. Older than 7 days → `TOO_LATE`. Else build the DM (products' links from cart's
  `checkoutLinks.create` with source AUTOMATIC plus product page link, Q114; archived products
  dropped; nothing left → `NOTHING_TO_SEND`) and call `inboxService.sendAutomatic` as a private
  reply; optional public reply after it. Paced by the connection's `messages` lane so a burst of
  comments waits, never drops (R7).
- **D5 — Activity (R9, Q11).** The post's section reads counts (today, total) and the last 50 matches
  by index `(ruleId, at DESC)`; Pause and Resume flip `paused` with a version check.

## Packages
None.

## UI approach
ux.md's composer panel as a slot component registered for the composer (`automations` contributes
`CommentRulePanel` through post-composer's panel registry), the post's activity section, and the
shop-wide rule inside the Auto-replies tab. Words in `automations-copy.ts`.

## Gates touched
New domain `automations`; routes rule save, pause, shop-wide; one repository each.

## Data model
[MIGRATION] `CommentRule`, `CommentMatch` (D1), indexes `(orgId, postId)`, `(ruleId, at DESC)`.

## API / contract changes
[CONTRACT] Composer panel slot and `afterSchedule` hook (social ↔ automations).

## Test plan
- Matcher table (unit, 100% branches).
- Redelivered comment sends nothing; second comment by the same person nothing (A2); paused sends
  nothing (A4); too late recorded (A5); shop-wide rule on an app-made post (A3).
- Burst of 500 comments: all under 7 days answered, paced (integration with the fake source).

## Delivery
1. **after inbox-instagram U2 (`CommentEvent` and the private reply), inbox-core U3 (`sendAutomatic`), checkout-links U1 (`checkoutLinks.create`) and post-composer U1 (rules keyed by post)** — Model, matcher, sink, claim and send (behaviour).
2. **after U1 and post-composer U2 (scheduling, where the `afterSchedule` hook is called)** — Default-on hook, activity, pause.
3. **after U2, post-composer U4 (the composer the panel slots into) and enquiry-autoreplies U3 (the Auto-replies tab holding the shop-wide rule)** — Composer panel and shop-wide rule UI.

## Open questions
None.
