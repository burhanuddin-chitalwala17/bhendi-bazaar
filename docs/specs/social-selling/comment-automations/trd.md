# TRD — social-selling/comment-automations

- **Status:** Draft
- **Domain:** automations (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (draft), [decisions.md](decisions.md), parent [decisions](../decisions.md), [post-scheduling trd](../post-scheduling/trd.md), [inbox-instagram](../inbox-instagram/), [ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0068](../../../adr/0068-meta-is-a-connected-shopfront.md), [ADR-0069](../../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's; this says how they are built.

## Approach
A new platform-free domain, `server/automations/`, consumes the neutral `comment.received` job
that inbox-instagram's webhook handling enqueues (parent Q80), decides whether a rule matches, and
claims the comment in one insert. A second job sends: the DM and optional public reply leave
through a `CommentReplyPort` that `channels` implements for Instagram. The claim row is the
idempotency key and the activity the shop sees. Rules are read from social's post (post-scheduling
Q6) or the shop-wide rule this domain owns.

## Prior art
- **Comment-to-DM tools** (ManyChat, Zorcha, LinkDM; checked 2026-11-06) all key a rule on a post
  plus a keyword, send one private reply per comment, and offer an "any post" fallback. Followed.
- **Meta's private replies** allow one message per comment within 7 days, at 750 an hour per post
  (research 2026-11-06). Followed as hard limits, not settings.
- **Idempotent consumers** (the transactional outbox/inbox pattern; Stripe's idempotency keys): a
  unique claim row before any side effect, and a side effect retried only under that key. Followed.
  Our own `Notice` unique-per-kind row (`server/notifications/notice.repository.ts`) is the same
  shape; matched as evidence, checked against the field above.

## Technical decisions
- **D1 — Domain `server/automations/`.** Public surface: `automation.service` (shop-wide rule read
  and save, pause, a post's activity) and `.types`. Files: `comment-rule.ts` (pure match and DM
  build), `comment-claim.repository.ts`, `shop-rule.repository.ts`, `automations.jobs.ts`.
- **D2 — The port.** `CommentReplyPort` (declared in `automations`, implemented in
  `channels/providers/instagram/`): `privateReply(orgId, commentId, text)`, `publicReply(orgId,
  commentId, text)`, each answering sent, `too_late`, `rate_limited(retryAfter)`, `connection_lost`
  or `refused(reason)`. Registered at worker start, as the stock push is; the boundary test forbids
  `automations` importing `channels` (parent Q7).
- **D3 — The event.** `comment.received` payload (Zod, in `server/shared/jobs/`): `orgId`,
  `platform`, `commentId`, `postExternalId`, `authorExternalId`, `authorIsShop`, `isReply`, `text`,
  `createdAt`. Nothing Meta-shaped; another platform would fill the same fields.
- **D4 — Which rule.** The post's own rule when social knows the post (by `postExternalId`, via
  `socialPostService.ruleFor`), else the shop-wide rule; never both (spec hazard 2). Paused,
  missing, shop-authored or reply → no claim, nothing logged beyond a counter.
- **D5 — Match** (pure): Unicode NFKD, strip marks, lower-case, split on anything not a letter or
  digit, keyword equal to a token (Q3). Mutation-tested: "shopping" must not match.
- **D6 — Claim.** Insert `CommentClaim` unique on (platform, commentId) and a second unique on
  (orgId, postExternalId, authorExternalId) for Q7; a conflict on either is a skip, recorded as
  `repeat`. The DM text is frozen into the claim at claim time (spec hazard 4). Then enqueue
  `automations.send` in the same transaction (ADR-0038).
- **D7 — Send.** The handler reads the claim; if `sent`, returns. Over 7 days → `too_late`. Calls
  `privateReply`; on `rate_limited` re-enqueues after `retryAfter` (not counted as a retry);
  `connection_lost` → `failed`, no retry; a network error is retried 5 times with back-off. A
  retry after an unknown outcome is safe because Meta refuses a second private reply to one comment
  and we read that refusal as `sent`. The public reply follows only after the DM is sent.
- **D8 — Rate.** Jobs carry `group: orgId:postExternalId`, and the handler spaces sends to at most
  12 a minute per post (inside 750/hour) so a viral post drains without tripping Meta (A7).
- **D9 — Archived products** (Q13): links are built at claim time from catalog's public read; an
  archived product's line is removed; if the text equals the untouched suggestion and no link is
  left, the claim is `skipped_no_link`.
- **D10 — Inbox.** A sent DM is handed to inbox's `recordAutomaticReply` (inbox-core D11), marked
  `automatic`, so it appears in the thread (Q11).
- **D11 — Failure tells the shop** through `notify.service.emit` (kind `automation_failing`, added to
  hub-core's `NOTIFY_KIND`) when a
  rule fails 5 times in an hour, resolved on the next success (ADR-0069).

## Packages
None.

## UI approach
Cites [ux.md](ux.md). Server-rendered post detail section and Settings card; one client leaf each.
- **Phone first:** activity is a list of rows (name initial, comment excerpt, outcome chip); the
  shop-wide rule a card with one form. `md:`/`lg:` keep one column at the portal form width.
- **Behaviour:** `automationsApiClient.ts`; `useServerForm` for the shop-wide rule (a new
  automation schema beside the others in `src/lib/validation/schemas/`), `useMutation` for Pause/Resume. DTOs from
  `automation.types`.
- **Surfaces:** existing `Card`, `Badge`, `Switch`, `Textarea`, `Button` primitives; no new token.

## Gates touched
- New domain → `PUBLIC_SURFACE` (module-boundaries) and the tools-never-import-providers rule.
- `one-repository` — `CommentClaim`, `ShopCommentRule` each one repository.
- Routes → `route-reachability`, `portal-boundary` (`withOrg`), rate-limit registry (ADR-0063).
- `file-cohesion` — `automations.jobs.ts` reaches social, catalog, inbox: recorded in `RECORDED`.

## Data model
[MIGRATION] `ShopCommentRule` (orgId unique, keyword, dmText, publicReplyText nullable, paused,
updatedBy, updatedAt). `CommentClaim` (id, orgId, platform, commentId, postExternalId,
authorExternalId, commentExcerpt ≤120 chars, dmText, publicReply bool, outcome closed set
`CLAIM_OUTCOME`, reason, attempts, createdAt, sentAt; uniques per D6). Claims are deleted with the
inbox's retention (parent Q34) by the same daily pass.

## API / contract changes
`GET|PUT /api/org/[orgId]/automations/shop-rule`, `POST …/shop-rule/pause`,
`GET /api/org/[orgId]/social/posts/[postId]/automation` (activity). New DTOs in CONTRACTS.md:
`ShopCommentRuleDTO`, `CommentActivityDTO` — [CONTRACT].

## Test plan
- Unit: match table (case, emoji, punctuation, "shopping"), rule choice, DM build with archived
  product, 7-day boundary — mutation-tested per [TESTING.md](../../../TESTING.md).
- Integration: duplicate event → one claim; same author twice → `repeat`; rate-limited answer
  re-enqueued without consuming a retry; refusal-as-sent; 1,000 recorded payloads through a fake
  port, none twice, spacing held (A7).
- Live after approval (parent Q81): A1, A4, A5 on the owner's account — listed in going-live.md.

## Delivery (PRs)
1. Domain, tables, pure match, claim, fake port, tests (no behaviour visible).
2. Send job, rate spacing, inbox hand-off, notify emit.
3. API + UI: post activity section, shop-wide rule card (behaviour-changing).
4. Instagram plug of `CommentReplyPort` in channels; recorded-payload acceptance.

## Open questions
None.
