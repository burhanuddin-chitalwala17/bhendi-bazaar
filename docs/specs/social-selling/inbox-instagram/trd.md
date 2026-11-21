# TRD — social-selling/inbox-instagram

- **Status:** Draft
- **Domain:** channels (the Instagram plug for inbox)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), parent [decisions](../decisions.md) (Q7, Q36, Q2), [inbox-core TRD](../inbox-core/trd.md), [connect-instagram TRD](../connect-instagram/trd.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0063](../../../adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's (the inbox's own screens are inbox-core's).

## Approach
`channels` gains the Instagram webhook route (parent Q7) and an Instagram `InboxSource`. The route
verifies Meta's signature, stores each event once, and enqueues neutral jobs: `inbox.message-received`
for every DM and comment, and `comment.received` for every new comment, which comment-automations
consumes (its D3). The
source sends replies, public comment replies, private replies and hides through the connection's
token, which never leaves `channels`. The inbox sees none of Meta.

## Prior art
- **Meta webhooks**: a `GET` verify handshake (`hub.challenge` with our verify token) and signed
  `POST`s (`X-Hub-Signature-256`, HMAC-SHA256 of the raw body under the app secret), retried on
  failure. Meta's docs prescribe exactly this; we follow it.
- **Our Razorpay webhook** (`src/app/api/webhooks/razorpay`) verifies a signature over the raw body
  and is exempt from the same-origin check and named in `EXTERNALLY_CALLED`; the Meta route follows
  the same pattern.
- **Inbox of record**: storing the raw event first, then processing from the store (an "inbox
  table", as in the transactional outbox pattern's mirror), is how Stripe and Shopify integrations
  survive reprocessing. We keep one `MetaEvent` row per Meta event, the table connect-whatsapp D7
defines; whichever subfeature lands first creates it.

## Technical decisions
- **D1 — Route `GET|POST /api/channels/instagram/webhook`**, the twin of connect-whatsapp D7.
  `GET` answers Meta's verify challenge against `META_WEBHOOK_VERIFY_TOKEN`; `POST` reads the raw
  body, checks `X-Hub-Signature-256` with the app secret in constant time (bad → 401, nothing
  written), and in one transaction inserts one `MetaEvent` per entry change (`ON CONFLICT` on Meta's
  id or a hash of the change) and enqueues `channels.instagram-event` for each new row. It answers
  200 within Meta's timeout; nothing is processed inline.
- **D2 — Dispatch.** `channels.instagram-event`'s handler finds the connected `ChannelConnection` by the
  entry's Instagram account id (unknown → marked ignored, R9), parses the change with a Zod schema
  per field, and enqueues `inbox.message-received` with neutral fields (inbox-core D3). Echoes of
  the shop's own messages (`is_echo`) go as direction out-echo (Q2). Unsupported attachments become
  a kind label (inbox-core Q5). A new top-level comment also enqueues `comment.received`
  (comment-automations D3). The raw payload is deleted once dispatched; only ids stay.
- **D3 — The Instagram `InboxSource`** (`providers/instagram/inbox.ts`), registered with the inbox
  port at the composition root (`server/channels/channels.jobs.ts` for the worker, the route layer
  for the app). `send` on a DM thread → `POST /<IG_ID>/messages`, with `tag: HUMAN_AGENT` when the
  window is human-agent; on a comment thread → a public reply (`POST /<comment-id>/replies`);
  `privateReply` → `POST /<IG_ID>/messages` with `recipient.comment_id`. `hide` → `POST /<comment-id>`
  `hide=true|false`. Capabilities: `canHide`, `canSendImage`, `canPrivateReply`.
- **D4 — Windows.** Computed from the conversation's last inbound time, which inbox stores and passes
  in: < 24 h open; 24 h–7 d human-agent; else shut (parent Q36). For a comment thread the private-reply
  window is 7 days from the comment.
- **D5 — One private reply per comment.** The inbox and comment-automations both call the same
  `privateReply` verb (comment-automations D2). Meta refuses a second private reply to one comment;
  that refusal maps to `ALREADY_REPLIED` (A3), whichever caller got there first. No claim row of our
  own: comment-automations' `CommentClaim` keeps its rule from firing twice, and Meta is the
  authority on the one-reply rule.
- **D6 — Rate limits.** The send job is grouped per connection (pg-boss `group`) so one account's
  sends run one at a time, under Meta's 100/s text and 750/h private-reply caps; a 429 or code 4/17/32
  retries with backoff and the message stays Sending.
- **D7 — Errors.** Meta errors map to inbox failure codes: token invalid → `CONNECTION_DEAD` (and
  the connection set `NEEDS_RECONNECT` through connect-instagram's command); outside window →
  `WINDOW_SHUT`; else `PLATFORM_REFUSED`. No body is logged (R12).
- **D8 — Subscriptions.** On connect (connect-instagram's callback) the account is subscribed to
  `comments` and `messages` through `POST /<IG_ID>/subscribed_apps`; this subfeature adds that call
  and its check to the daily pass. The app-level webhook fields are set once in the Meta dashboard
  (going-live.md).
- **D9 — Retention and deletion.** Disconnect enqueues `inbox.source-disconnected`; reconnect of the
  same account clears it. connect-instagram's data-deletion job `channels.person-deleted` enqueues
  `inbox.person-deleted` for the person's Instagram-scoped id (R10).
- **D10 — Recorded payloads.** Real webhook bodies from Meta's dashboard "Test" button and our own
  account are stored under `tests/fixtures/meta/instagram/` with ids replaced, and replayed through
  the route with a valid signature in the integration suite (parent Q2, A7).

## Packages
None.

## UI approach
inbox-core's screens, with what this plug adds (ux.md): the post header on a comment thread,
"Reply publicly" / "Reply by DM" on comment threads, the human-agent banner, the private-account
note on the Instagram tab. Copy in the inbox components' `inbox-copy.ts`.

## Gates touched
- `route-reachability` — `/api/channels/instagram/webhook` in `EXTERNALLY_CALLED` ("Meta posts webhooks").
- `same-origin` — the route added to the signed-webhook exemptions in `src/lib/same-origin.ts`.
- `rate-limit` registry — `GET` and `POST /api/channels/instagram/webhook` exempt, reason: signed by Meta.
- `request-body-parsing` — every change parsed with a Zod schema after the signature check.
- `one-repository` — `MetaEvent` written only by its repository (shared with connect-whatsapp).
- `module-boundaries` — `channels` imports `inbox`'s port module only (declared surface).

## Data model [MIGRATION]
`MetaEvent` exactly as connect-whatsapp's Data model defines it (its `source` column, `instagram` /
`whatsapp`, lets one table serve both routes); created here if this lands first. No other table.

## API / contract changes
The webhook route is external. No DTO change beyond inbox-core's; CONTRACTS.md's "Inbox" section
notes the Instagram capabilities.

## Test plan
- Unit: signature check (valid, wrong secret, altered body, missing header); each field schema;
  window boundaries at 24 h and 7 d; Meta error → failure code.
- Integration: recorded DM, comment, echo and unsupported payloads through the route reach inbox
  once; a replay adds nothing; an unknown account is ignored; Meta's refusal of a second private
  reply shows as already replied; a new comment also enqueues `comment.received`;
  a 429 retries; disconnect then reconnect clears retention.
- Manual (A1–A5): owner's account on dev at 360px; re-walked after approval if webhooks were not live.

## Delivery (units)
1. `MetaEvent` (if not yet made), the signed route, dispatch job — no inbox effect yet.
2. Instagram inbound into inbox (DMs, comments, echoes), and `comment.received` — behaviour-changing.
3. Instagram source: DM replies with windows, public comment replies, hide.
4. Private replies; subscriptions in the daily pass; retention hooks.

## Open questions
None.
