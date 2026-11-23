# TRD — social-selling (architecture)

- **Status:** Accepted
- **Domain:** channels (Meta platform layer), and five new tool domains: social, inbox, automations, audience, campaigns; with notifications, content, cart and analytics
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns.md](ux-patterns.md), [going-live.md](going-live.md), [INTEGRATIONS.md](../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), ADRs [0003](../../adr/0003-one-repository-per-aggregate.md), [0012](../../adr/0012-modules-are-vertical-slices-by-domain.md), [0033](../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [0046](../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [0060](../../adr/0060-mutations-stay-on-route-handlers-and-a-mutating-request-must-come-from-our-origin.md), [0063](../../adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md), [0068](../../adr/0068-meta-is-a-connected-shopfront.md), [0069](../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md), and the new [0078](../../adr/0078-meta-events-arrive-through-one-signed-intake-and-are-drained-per-account.md), [0079](../../adr/0079-a-shops-conversations-are-sealed-under-its-own-key.md), [0080](../../adr/0080-every-effect-on-a-platform-is-a-row-claimed-before-the-call.md), [0081](../../adr/0081-text-generation-goes-through-the-generation-port.md)

> Technical approach and decisions. No code — references to existing code only, to justify a
> decision. This is the architecture every subfeature TRD builds on; a subfeature cites its D ids
> as **A-D<n>** and decides only what is its own.

## Approach
Social selling is one feature built in one go on `meta-whatsapp-connector`, in the dependency order
of parent Q107 (an order of construction, not of release). Its shape follows from four pressures:
Meta talks to us through **webhooks that arrive at least once, out of order and in bursts**; we
talk to Meta through **rate-limited calls that can time out after taking effect**; a shop's
**chats are private** (Q116); and a viral post or a 10,000-person campaign must not slow a quiet
shop down. The answer is a small set of mechanisms, each written once and used by every subfeature:

1. **One Meta platform layer inside `channels`** (ADR-0068): connections, tokens, one Graph client,
   one webhook intake, and ports that speak in our words. No other domain sees a token, a Graph URL
   or a Meta field name.
2. **Store first, process later, per account in order** (ADR-0078): the webhook route verifies the
   signature, writes each event once, answers 200, and a drain job per connection turns raw events
   into neutral facts handed to whichever domain owns them.
3. **Every effect on a platform is a row claimed before the call** (ADR-0080): a message, a
   publish, a catalogue batch. The row is the idempotency key, the progress record and the audit;
   an answer we never received is *uncertain*, never silently retried.
4. **Serial per account, parallel across accounts**: a lease per (connection, lane) paces calls
   to each account inside Meta's limits without a distributed rate limiter, and one hot shop never
   starves the rest.
5. **Sealed per shop** (ADR-0079): message bodies are encrypted under the shop's own data key;
   no staff read model can select them.

## Prior art
- **Webhook intake: verify, persist, acknowledge, process asynchronously.** Stripe, Shopify and
  Meta's own guidance say the same: answer fast, deduplicate on the provider's event id, process
  off the request path, tolerate reordering. Hookdeck's WhatsApp guide adds that Meta retries
  unacknowledged deliveries for days and duplicates are normal. We follow it, with the
  deduplication key per event kind (D5) and the drain per account for ordering (D6).
- **Transactional outbox and claim-check.** The send row written in the business transaction and
  claimed by a conditional update is the outbox pattern (Richardson, *Microservices Patterns*).
  This repository already does it: `enqueue` writes the job in the caller's transaction
  (`server/shared/jobs/jobs.enqueue.ts`), a listing publish is claimed by state (channels CLAUDE.md).
  We follow both.
- **At-most-once for messages, at-least-once for everything else.** Messaging platforms (Twilio's
  idempotency guidance, Meta's `biz_opaque_callback_data`) accept that a timed-out send may have
  gone; a duplicate WhatsApp message costs money and trust, a missed one costs a retry the shop
  chooses. We follow it (D8).
- **Envelope encryption with a key per tenant** is the AWS KMS / Google Tink pattern: data keys
  per tenant, wrapped by a key-encryption key, rotated by re-wrapping. Our KEK is the existing
  versioned ring in `server/shared/crypto.ts` (channel-connectors TRD D3). We follow it (D12).
- **Short polling over sockets** for an inbox at this scale: Intercom and Front fell back to
  polling under load; Vercel functions cannot hold sockets open. We poll a monotonic change cursor
  (D14) and park a push transport.
- **Pattern in our code that does not fit:** ADR-0069 decision 4 still names a global marketing
  cap and a daily window, which parent Q40 and Q112 replaced with one how-often rule and the shop's
  hours. ADR-0069 is Proposed, so it is revised in place in the first unit (D19).

## Technical decisions

### Boundaries
- **D1 — Domains and who owns what.** New directories under `server/`, each a vertical slice
  (ADR-0012) with its own `CLAUDE.md` and public surface (ADR-0033):

  | Domain | Owns | Subfeatures |
  |---|---|---|
  | `channels` (exists) | Social connections, tokens, the Graph client, webhook intake and drain, the Instagram, WhatsApp and Meta-catalogue ports, the catalogue mirror | meta-foundation, connect-*, whatsapp-catalogue*, instagram-publishing, inbox-instagram, inbox-whatsapp (their platform halves) |
  | `social` (new) | Posts, destinations, the Status handoff | post-composer, whatsapp-status-kit |
  | `inbox` (new) | Conversations, messages, read state, the send hold, privacy log | inbox-core |
  | `automations` (new) | Comment rules, auto-reply settings, matching, the bot pause | comment-automations, enquiry-autoreplies, product-answers |
  | `audience` (new) | Contacts, consent, lists, first offers | consent-core, audience |
  | `campaigns` (new) | Templates, the WhatsApp send port, spend, how-often, campaigns | whatsapp-sending, whatsapp-campaigns |
  | `notifications` (exists) | The hub, deliveries, badge, digest, alerts | notification-hub/* |
  | `content` (exists) | Post pictures and captions through the generation port | ai-images/social-posts |
  | `cart` (exists) | Checkout links | checkout-links |
  | `analytics` (exists) | The admin overview, read-only | social-home (admin half) |

  `social-home`'s shop card is a server component composing the public surfaces of the domains it
  counts; it owns no table.
- **D2 — Dependency direction.** Tools depend on `channels`' ports; `channels` never imports a
  tool. Inbound facts travel the other way through **event sinks** (D7): a registry in
  `shared/social-events/` that tool domains register into at worker start, exactly as job
  handlers register today (`server/shared/jobs/jobs.registry.ts`). Cross-tool calls (automations
  sending through inbox, campaigns asking audience for consent) go through public services; a
  cycle is broken by a shared job spec, as `stock-changed.job.ts` does. `tests/unit/module-boundaries.test.ts`
  gains each new domain in `PUBLIC_SURFACE`.
- **D3 — Ports, named for what they do.** In `channels/social/ports.ts`:
  `InstagramPort` (publish, reply to comment, private reply, hide comment, send DM, read
  conversations, account health), `WhatsAppPort` (send text/media/interactive/template, mark read
  and typing, templates CRUD, number health, register, subscribe, contact sync start) and
  `MetaCataloguePort` (create/attach catalogue, batch upsert/delete, read items). Ports take and
  return our DTOs (`channels/social/types.ts`), never Graph JSON, and are reached through a
  service that resolves the connection and asserts the plan (as `accessToken()` does for
  marketplaces). A `fake` adapter implements every port for tests and local development.

### The Meta platform layer
- **D4 — One Graph client.** `channels/providers/meta/graph-client.ts`: the Graph version
  pinned as one constant (an upgrade is a reviewed change with its changelog read); every call
  carries `appsecret_proof` (HMAC-SHA256 of the token with the app secret), which Meta recommends
  and which makes a leaked token useless without our secret; a 10 s timeout; JSON parsed with Zod
  at the edge; failures classified into one `MetaError` carrying our `SOCIAL_ERROR` code: auth (reconnect),
  rate limited (with retry-after), unavailable (try later), refused (with Meta's reason, 300
  characters, only where ux.md shows it) and uncertain (sent, no answer) (meta-foundation Q6). It reads `X-Business-Use-Case-Usage` and
  `X-App-Usage` on every response and reports pressure to the lane (D9). Bodies are never
  logged (channels CLAUDE.md). Limits Meta publishes (100 API posts a day per Instagram account,
  80 messages a second per WhatsApp number, 5,000 items per catalogue batch, private reply once
  per comment within 7 days) live in `meta-limits.ts` as data, each with its source and checked
  date, because Meta's own pages disagree and change (INTEGRATIONS).
- **D5 — One webhook intake, two routes (ADR-0078, meta-foundation R2).** `app/api/webhooks/meta/instagram/route.ts`
  and `…/meta/whatsapp/route.ts`, thin handlers over one intake service in `channels` (one Meta app):
  - `GET` answers Meta's verification with `hub.challenge` when `hub.verify_token` matches
    `META_WEBHOOK_VERIFY_TOKEN`, compared in constant time.
  - `POST` reads the raw body (capped at 3 MB, Meta's limit), verifies `X-Hub-Signature-256`
    against `META_APP_SECRET` with `timingSafeEqual`, rejects with 401 on mismatch, then splits
    the envelope into one row per change in `MetaEvent`: object, field, the account's external id,
    the connection it resolves to (one indexed lookup on external id, nullable), a **dedupe key**
    per kind (WhatsApp message `id`; a status `id:status`; Instagram `mid`; a comment's `id:verb`;
    otherwise SHA-256 of the canonical change), `occurredAt` from the payload, and the payload
    sealed under the platform key ring (D12: raw events are not yet routed to a shop, and are kept
    30 days only, meta-foundation Q2). One `INSERT … ON CONFLICT (dedupeKey) DO NOTHING` per
    delivery, then one `enqueueLater` per connection touched (D6). Answers 200 in well under a
    second; a database failure answers 500 so Meta retries, keeping at-least-once intact.
  - An event for an account we do not hold (disconnected, or never ours) is dropped: its payload
    is never stored, a per-day `UNROUTED` count is incremented (meta-foundation R5), and it is
    answered 200: Meta delivers late events after a disconnect by design, and repeated non-2xx
    answers get an app's webhooks disabled. This departs from the Razorpay rule ("an
    unmatched payload answers non-2xx", `src/app/api/CLAUDE.md`) for that reason, and the
    count of `UNROUTED` and failed events is on the admin overview so it is never invisible.
  - Rate limiting: classified `exempt` in `src/lib/rate-limit/registry.ts` with the reason
    "signed by Meta; a 429 would lose events Meta then retries for days" (ADR-0063), and named in
    `EXTERNALLY_CALLED`.
- **D6 — Drained per connection, in order.** `channels.drain-events` (payload: connection id) is
  enqueued with `enqueueLater(afterSeconds 0, onePerSeconds 2, slot = connection)`, so a burst of a
  thousand webhooks for one account costs a handful of jobs. The job claims the connection's
  `events` lease (D9), reads up to 500 `PENDING` events ordered by `(occurredAt, receivedAt, id)`,
  translates each into a neutral fact (D7), hands consecutive facts of one kind to its sink in one
  batch, and marks them `DONE` in one statement. A fact whose sink throws is retried with the run;
  after 5 attempts it becomes `DEAD` with its error code and the lane moves on, so one poison event
  never blocks a shop's inbox. More pending → it re-enqueues itself. Ordering holds per account,
  which is the order Meta guarantees nothing about but a reader expects; across accounts, drains
  run in parallel up to the worker's concurrency.
- **D7 — Neutral facts and sinks (meta-foundation R4).** The drain is the queue job that hands
  events on; no tool sees a Meta payload. `shared/social-events/` declares the facts as Zod
  schemas: `InboundMessage`, `OutboundEcho` (sent from the shop's app), `MessageStatus`,
  `Reaction`, `MessageEdit`, `CommentEvent`, `CartOrder`, `ContactChange`, `TemplateStatus`,
  `AccountUpdate`, `Deauthorized`, `DeletionRequest`. A sink is `{ fact, handle(batch) }`; several
  sinks may take one fact (an `InboundMessage` goes to inbox, then automations, then audience's
  YES/STOP reader), run in a declared order inside one drain so automations see the message inbox
  has stored. A sink is idempotent on the fact's dedupe key, because a drain may re-run.
- **D8 — Every effect on a platform is a claimed row (ADR-0080).** Each tool keeps its own outbox
  table (inbox `Message`, social `PostDestination`, campaigns `CampaignSend`, channels
  `CatalogueBatch`, `TemplateSubmission`) with one state machine:
  `HELD → QUEUED → CLAIMED → SENT | FAILED | UNCERTAIN`. The row is written in the business
  transaction with its job (`enqueue`, same commit); the worker claims it by
  `UPDATE … SET state = 'CLAIMED', claimedAt = now() WHERE id = $1 AND state = 'QUEUED'` and only a
  count of 1 proceeds; the platform's id is written on success. Retry policy per kind:
  - **Messages** (inbox, automations, campaigns): retried only on an error Meta documents as
    "not sent" (rate limit, temporary unavailability with an error code). A timeout or a bare 5xx
    after the request left is `UNCERTAIN`: WhatsApp sends carry `biz_opaque_callback_data` = our
    row id, so a later status webhook for it settles the row to `SENT`; otherwise the thread shows
    "Not sure it was sent · Check in WhatsApp" and the member may send again. A duplicate message
    is worse than a missing one.
  - **Publishes**: the container is created, then `media_publish` once per container id; a retry
    reuses the stored container while it is younger than 24 hours, and Instagram refuses a second
    publish of the same container, so a retried publish cannot post twice (instagram-publishing).
  - **Catalogue batches and template submissions** are idempotent by retailer id and template name,
    so they retry freely with backoff.
  Backoff is exponential with full jitter (base 2 s, cap 5 min, 3 attempts for messages, 6 for the
  rest), through `server/shared/retry.ts` within a run and the queue's retry across runs.
- **D9 — Leases: serial per account, parallel across.** A `ConnectionLane` row per (connection,
  lane) with `leaseUntil` and `holder`; a job claims it with a conditional update, renews it while
  working, releases it at the end, and a job that cannot claim exits (the holder re-checks for work
  before releasing, so nothing is stranded). Lanes: `events` (drain), `messages` (sends),
  `publish`, `catalogue`, `campaign`. Inside a lane, calls are paced from `meta-limits.ts`
  (WhatsApp sends default to 20 a second, a quarter of the 80 Meta allows, leaving room for the
  inbox and the Business app; Instagram sends to 10 a second) and slowed when the usage headers
  pass 75% or Meta answers 130429 / code 4 / 17 / 32 / 613, resuming after the header's reset or
  a backoff. Serial-per-account pacing needs no shared rate-limit store, survives more than one
  worker process, and cannot exceed an account's limit by two workers racing.
- **D10 — Things that happen at a time.** A post, a campaign, a held message (7 s, inbox Q16) and
  a greeting delay (30 s, enquiry Q2) each enqueue their job with pg-boss `startAfter` at the due
  moment, carrying the row's `version`; editing bumps the version and enqueues again, so a stale
  job finds a newer version and ends. This uses no schedule slot (`JOBS_MAX_SCHEDULES` is 4 and
  full). A daily sweep (`social.sweep`, self-rescheduling with `enqueueLater` like inventory-sync's
  order check) re-enqueues anything due more than 10 minutes ago and still not started, so a lost
  job costs minutes, not a missed post.
- **D11 — Reconciliation where Meta can miss.** Instagram's conversations API is re-read per
  active connection every 15 minutes while the account had a message in the last 7 days
  (inbox-instagram R7), feeding the same intake as synthetic events with the same dedupe keys, so
  a recovered message is shown once. WhatsApp offers no history read: its statuses and our
  `biz_opaque_callback_data` settle sends; the catalogue's nightly full re-send repairs drift
  (whatsapp-catalogue Q4).

### Data, privacy and money
- **D12 — Sealed per shop (ADR-0079, Q116).** `OrgDataKey(orgId, version, wrappedKey, createdAt)`:
  a random 256-bit data key per shop, wrapped with the current `CREDENTIAL_KEYS` version. Message
  bodies, conversation previews, captions of inbound comments, and attachments' captions are
  stored as `AES-256-GCM(dataKey, plaintext, aad = orgId|table|rowId)`; the additional data binds a
  ciphertext to its row so one cannot be pasted into another shop. Data keys are unwrapped in the
  process that needs them and cached for 10 minutes in memory, never logged or returned. Only the
  shop's member sessions (route handlers after the org guard) and its own automation sinks call
  `inboxSeal.open`. Raw `MetaEvent` payloads are sealed under the platform ring and deleted after
  30 days. Names and handles stay plain (search needs them, Q3). `sealed-columns.test.ts`
  fails any `admin.*` file, analytics query or log call that selects a sealed column; support access
  goes through a `SupportGrant` row (inbox Q116) checked by the same `open`.
- **D13 — Money and counts are integers, claimed atomically.** Spend lives in
  `MessagingSpend(orgId, month, reservedPaise, spentPaise, limitPaise)`; a paid send reserves with
  `UPDATE … SET reservedPaise = reservedPaise + $cost WHERE … AND spentPaise + reservedPaise + $cost <= limitPaise`
  and settles to the actual price from Meta's status webhook (Invariant 3; whatsapp-sending Q11).
  The how-often rule takes `pg_advisory_xact_lock(hashtext(org||contact))`, counts
  `MarketingTouch` rows for the IST day and week, and inserts the touch in the same transaction;
  no race can pass it, unlike ADR-0069's accepted burst-by-one, which D19 retires.
- **D14 — Live screens poll a change cursor.** Inbox rows, campaign progress, settle progress and
  the bell carry `changeSeq bigint` set from a Postgres sequence by their repository on every write.
  The client polls `GET …/changes?after=<seq>` every 5 s while the tab is visible (Page
  Visibility API), every 60 s hidden, backing off to 30 s after errors; the query is a keyset read
  on `(orgId, changeSeq)` and answers 304 when nothing changed. Rate-limited under a new `poll`
  policy. A push transport (SSE through a hosted relay) is parked; the cursor contract is the one
  it would carry.
- **D15 — Retention, in batches, off the request path.** One self-rescheduling `social.retention`
  job a day deletes in batches of 1,000 by indexed timestamp: `MetaEvent` after 30 days
  (meta-foundation Q2), a disconnected account's conversations 90 days after disconnect unless it
  reconnected (parent Q34), deliveries after 13 months (notifications Q7), consent 3 years after its
  last change (consent-core Q10). A deletion request (meta-foundation Q1) runs the same deletes for
  one person immediately.

### Scale, safety and operation
- **D16 — Indexes and query shapes are part of the design.** Every list is keyset-paginated on an
  index that matches its order: conversations on `(orgId, platform, sortRank, lastMessageAt DESC,
  id)` with a partial index `WHERE needsYou`; messages on `(conversationId, sentAt, id)`;
  `MetaEvent` on `(connectionId, state, occurredAt)` partial `WHERE state = 'PENDING'`; contacts on
  `(orgId, lower(name))` and `(orgId, phoneE164)`; sends on `(campaignId, state)`. Counts on screens
  (Needs you, Failed) are partial-index counts, not stored counters, so they cannot drift. Each
  subfeature TRD lists its indexes; a list without one is a defect.
- **D17 — Budgets, tested.** Webhook intake p95 < 300 ms at 200 deliveries a second; a drain turns
  ≥ 300 events a second into rows on one worker; inbox list p95 < 300 ms for a shop with 50,000
  conversations; a 10,000-person campaign finishes in under 10 minutes at 20 messages a second;
  catalogue sync of 5,000 products in one batch call. `scripts/load/` holds a dependency-free load
  script for the webhook route (signed payloads, concurrency flag) and a seeding script for the
  large-shop cases; results are recorded in each TRD's acceptance report.
- **D18 — Security and access.**
  - Every shop route runs the existing org-member guard and the plan assert (`social-plan.ts`,
    the pattern of `channel-plan.ts`).
  - Mutations stay on route handlers and must come from our origin (ADR-0060); bodies are parsed
    with Zod schemas in `lib/validation/schemas/social/` (Invariant 4).
  - OAuth `state` reuses `connect-state.ts`.
  - Secrets: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_SIGNUP_CONFIG_ID`
    (Embedded Signup's configuration). They are read only in `providers/meta/`, and the app refuses
    to start without them in production, as `src/instrumentation.ts` does for the rate limiter.
  - The public routes, data deletion and checkout links, are classified for rate limiting.
- **D19 — ADR-0069 revised in place.** Decision 4 becomes: the hub owns which events a shop has
  switched on and channel order; the **one how-often rule** (parent Q40) and **spending limit**
  are campaigns' facts, checked at the WhatsApp channel and counted across channels through
  `MarketingTouch`; alerts wait for the **shop's hours** (Q112). The consequence on a racing
  burst is removed (D13).
- **D20 — Observability without bodies.** One structured log line per platform call and per
  drain run (`scope`, `orgId`, `connectionId`, `lane`, `ms`, our error code, Meta's numeric code),
  never a body or token. Health is read from the tables, not from logs: `DEAD` events, `UNCERTAIN`
  and `FAILED` sends in the last day, lanes whose lease expired, per platform, on the admin overview
  (social-home). When error-tracking ships, its seam captures `MetaUncertainError` and `DEAD`
  transitions; nothing here waits for it.
- **D21 — Availability switch and plan.** `SOCIAL_CONNECT` (beside `CHANNELS_CONNECT` in
  `channel-availability.ts`) lists the platforms open to connect; a closed one shows Coming soon
  (meta-foundation). Every shop-facing action and every per-shop job asserts the Social selling plan
  (parent Q8; subscriptions/feature-access Q36); a job for a shop without it ends succeeded with a
  skip, as channels' jobs do.

## Packages
None. Meta is plain `fetch`; pg-boss, Zod, Prisma and Node's `crypto` cover the rest.
DEPENDENCIES.md unchanged.

## UI approach
Every screen is signed off in its subfeature's ux.md; the rules are [ux-patterns.md](ux-patterns.md)
and `src/components/CLAUDE.md`. Shared across the feature:
- **Components by domain**: `components/social/`, `inbox/`, `audience/`, `campaigns/`,
  `automations/`; `channel/` gains the social cards. Each has its `*-copy.ts`, its `*ApiClient.ts`
  and hooks beside it (ADR-0048, ADR-0067).
- **Pages are server components** reading through each domain's service; leaves earn
  `"use client"` (composer, thread, selection, polling).
- **One `useChangeFeed(url, cursor)` hook** in the core hooks folder (ADR-0057) runs D14's poll
  for every live screen.
- **Pending buttons, holds and toasts** follow ux-patterns §3; the 7-second hold is a client
  countdown over a server state, so a reload shows the truth.

## Gates touched
- **New domains** `social`, `inbox`, `automations`, `audience`, `campaigns`: `PUBLIC_SURFACE`
  (module-boundaries), a `CLAUDE.md` each (`LIVING_DOCS`, docs-integrity).
- **New routes**: their callers and portal guards (route-reachability, portal-boundary). The
  webhook, data-deletion and checkout-link routes go in `EXTERNALLY_CALLED`.
- **Rate limiting**: every public route classified (rate-limit-registry).
- **One repository per aggregate**: every new table has exactly one `*.repository.ts`
  (one-repository).
- **Sealed columns**: a new test, `sealed-columns.test.ts` (D12).
- **Overlays**: sheets listed in `MAY_USE_SHEET`.
- **Copy and routes**: every string in a copy module and every link through `ROUTES`
  (hardcoded-copy).

## Data model
[MIGRATION]. Each subfeature TRD specifies its tables, columns and indexes; this lists the shared
ones introduced by meta-foundation and inbox-core:
- `ChannelConnection` gains social columns (externalAccountId kinds, scopes, token kind,
  `webhookSubscribedAt`, health fields) rather than a second connection table: one connection
  per (org, channel) for every kind (ADR-0068).
- `MetaEvent` (D5, D6), `ConnectionLane` (D9), `OrgDataKey` (D12), `MessagingSpend` and
  `MarketingTouch` (D13), `DataDeletionRequest` (meta-foundation).
- Sequences: `inbox_change_seq`, `social_change_seq`, `campaign_change_seq` (D14).

## API / contract changes
[CONTRACT]: CONTRACTS.md gains the social ports' DTOs (D3), the neutral facts (D7), the WhatsApp
send port (whatsapp-sending Q12), the hub's event shape (ADR-0069) and the checkout-link DTO.

## Test plan
Per TESTING.md's targets, plus for this feature:
- **Contract fixtures**: recorded, anonymised Meta webhook payloads and Graph answers in
  `fixtures/meta/`, replayed through the intake and the fake adapters; every subfeature's
  acceptance runs on them.
- **Signature**: a payload with a wrong, missing or truncated signature is refused; a correct one
  in constant time.
- **Idempotency**: every sink, replayed twice, writes once; a drain re-run after a crash changes
  nothing.
- **Concurrency (integration, real Postgres)**: two workers claiming one send row, one lane, one
  spend reservation at the limit, one how-often touch: exactly one wins in each.
- **Uncertain sends**: a timeout after send lands `UNCERTAIN` and is settled by a status carrying
  `biz_opaque_callback_data`.
- **Sealed columns**: a test reads a body from the database raw and finds ciphertext; the
  source-scanning gate (D12).
- **Load**: D17's budgets with `scripts/load/`, recorded per acceptance report.
- Every new guard is mutation-tested as /bb-build requires.

## Delivery
One feature on one branch, built in parent Q107's order. Each subfeature TRD lists its own units;
this architecture lands as the first units of meta-foundation (D4–D7, D9, D12) and inbox-core
(D8, D13, D14), because everything else stands on them. Units:
1. ADRs 0078–0081 and ADR-0069's revision (docs).
2. Graph client, limits table, fake adapters (no behaviour).
3. Webhook intake, `MetaEvent`, drain, sinks registry, lanes (behaviour: events stored and drained).
4. `OrgDataKey` and the seal (behaviour: nothing sealed yet).
5. Retention and sweep jobs.

## Architecture review (2026-11-23)
Every subfeature TRD was read against this one, the seven invariants, the ADRs and each feature's
decisions before acceptance. Found and fixed in the same change:
- meta-foundation's spec asked for one webhook route per Meta product, events as neutral jobs and
  unrouted events dropped; D5 now has two routes over one intake, D5 drops unrouted payloads and
  counts them, and R4's wording names facts handed on by the drain (meta-foundation Q3).
- Two decisions still described superseded behaviour and were replaced in place: inbox-core Q5
  (voice notes play) and hub-marketing Q2 (the one how-often rule, not a global cap).
- The bot pause showed 2 hours in the UX against enquiry-autoreplies Q5's 12; aligned.
- checkout-links could not open "the shop's page" for an edited link with a bare token; the URL
  now carries the shop.
- Invariants: money is integer paise throughout (A-D13, whatsapp-sending D3, campaigns D5); prices a
  buyer pays are computed by checkout only (inbox-whatsapp D4, checkout-links D4, catalogue D1 via
  the one resolver); every body is parsed with Zod (A-D18); one repository per new table, listed per
  TRD; no stock moves outside catalog's commands (checkout-links only adds to a cart).
**Accepted by the owner's standing instruction of 2026-11-23** ("if nothing major arises in the
architecture and TRD review, go ahead and build"): nothing major arose.

## Open questions
None. Facts confirmed by spike during the first units, none of which changes a decision here:
the contact sync re-running on a fresh onboarding (consent-core Q12), Instagram's API offering no
unsend (inbox-core Q16), whether Instagram's API sets the AI label (instagram-publishing Q10), and
the Meta platform-terms clause behind parent Q117.
