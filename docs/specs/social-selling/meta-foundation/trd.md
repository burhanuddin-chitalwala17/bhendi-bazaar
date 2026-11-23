# TRD — social-selling/meta-foundation

- **Status:** Draft
- **Domain:** channels, with shared (social events, jobs) and the webhook routes
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md) (A-D1–D21), [ADR-0078](../../../adr/0078-meta-events-arrive-through-one-signed-intake-and-are-drained-per-account.md), [ADR-0079](../../../adr/0079-a-shops-conversations-are-sealed-under-its-own-key.md), [ADR-0080](../../../adr/0080-every-effect-on-a-platform-is-a-row-claimed-before-the-call.md), [going-live.md](../going-live.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The ground every other subfeature stands on: the Meta app's settings, the Graph client, the webhook
intake and drain, the sinks registry, lanes, the per-shop seal, Meta's deauthorize and
data-deletion callbacks, the availability switch, and the retention and sweep jobs. It ships no
shop-visible feature beyond the Coming soon card and the deletion status page; it is built first
and proven with the fake adapters and recorded payloads, before any account is connected.

## Prior art
Covered by the architecture TRD (A-D5–D9, D12): webhook intake per Stripe/Meta guidance, the
outbox, envelope encryption. Specific here:
- **Meta's signed requests** (deauthorize and data deletion) are `base64url(signature).base64url(payload)`
  with HMAC-SHA256 under the app secret, the format Facebook Login has used for a decade; we verify
  it exactly as Meta's sample does, in constant time, rejecting any algorithm but `HMAC-SHA256`.
- **Data deletion callbacks answer `{ url, confirmation_code }`**, Meta's required shape; the status
  page by code is what Meta's review checks.

## Technical decisions
- **D1 — Settings (R1).** `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
  `META_SIGNUP_CONFIG_ID`, read only by `providers/meta/settings.ts` in channels, validated with Zod
  at first use; production refuses to start without them once `SOCIAL_CONNECT` opens a platform
  (A-D18). Named for what they hold, not the vendor's product (ADR-0037).
- **D2 — Graph client and limits (A-D4).** `providers/meta/graph-client.ts` and `meta-limits.ts` as
  the architecture describes; `providers/meta/errors.ts` maps Meta's numeric codes (190 expired
  token, 10/200 permission, 4/17/32/613/80007/130429 rate, 131047 window closed, 131026
  undeliverable, 100 bad parameter) to `SOCIAL_ERROR` codes in `social/types.ts`.
- **D3 — Intake (R2, R3, R5, A-D5).** Two routes, `api/webhooks/meta/instagram` and
  `…/whatsapp`, each `GET` (verification) and `POST` (signed events), both calling
  `metaIntakeService.receive(product, rawBody, signature)`. The service verifies, splits, resolves
  each change's account to a connection with one query over the batch's distinct ids, writes routed
  events in one insert and increments `MetaUnroutedCount(day, product)` for the rest, then
  enqueues one drain per connection touched. A refused signature is recorded as a count
  (`MetaUnroutedCount.badSignature`) with no body (R2).
- **D4 — Drain and sinks (R4, A-D6, A-D7, Q3).** `channels.drain-events` job; translation per
  product in `providers/meta/translate-instagram.ts` and `translate-whatsapp.ts` (pure: payload in,
  facts out, unit-tested on recorded fixtures); facts and the sink registry in
  `shared/social-events/`. Sinks this subfeature registers itself: `Deauthorized` and
  `DeletionRequest` (D6, D7) and `AccountUpdate` (connection health, read by connect-*).
- **D5 — Lanes (A-D9).** `ConnectionLane` with `claim(connectionId, lane, holder, seconds)`,
  `renew`, `release` in `connection-lane.repository.ts`; a lease is 60 s, renewed every 20 s by a
  running job; an expired lease is taken over, and the job that lost it stops at its next renewal.
- **D6 — Removal (R6, Q1).** Instagram's deauthorize callback (`api/channels/instagram/deauthorize`,
  a signed request) and WhatsApp's `account_update` with `PARTNER_REMOVED` or
  `ACCOUNT_OFFBOARDED` set the connection `NEEDS_RECONNECT` with `lastErrorCode` (`REMOVED_IN_APP`,
  `OFFBOARDED`) through `channel-connection.repository.ts`, and emit `connection needs you` to
  notifications. The daily `maintain` pass stays the backstop.
- **D7 — Data deletion (R7, Q1).** `api/channels/meta/data-deletion` (POST, signed request) writes
  `DataDeletionRequest(code, metaUserIdHash, state, requestedAt, completedAt)` with a 12-character
  random code, enqueues `channels.delete-person` and answers `{ url: appUrl(ROUTES.dataDeletion(code)), confirmation_code: code }`.
  The job finds the person by app-scoped id across connections, inboxes and contacts through each
  domain's public `forgetPerson(platformId)` (registered like sinks, so channels imports none), and
  marks the request done. The public page `/data-deletion/[code]` reads only state and dates.
  Meta's user id is stored only as an HMAC under the app secret, so the table itself names nobody.
- **D8 — Availability (R10, A-D21).** `SOCIAL_CONNECT` in `channel-availability.ts`; the Channels
  page renders a closed platform's card from `PLANNED_CHANNEL_COPY` with the Why? sheet.
- **D9 — Seal (A-D12).** `shared/seal/` (in shared because inbox, automations and audience all seal):
  `OrgDataKey` repository, `seal(orgId, table, rowId, text)` and `open(...)`, unwrap cache (LRU, 10
  minutes, 1,000 shops), rotation job `seal.rewrap` for a new key-ring version. Nothing is sealed
  until inbox-core.
- **D10 — Retention and sweep (R11, A-D10, A-D15).** `social.retention` and `social.sweep`, each a
  self-rescheduling job started by the worker on boot if absent (`enqueueLater` with a day slot),
  so neither takes a schedule slot. Deletes run in batches of 1,000 with a pause between, to keep
  replication and locks light.
- **D11 — No Meta text reaches a log or person (R9).** `graph-client` logs the structured line of
  A-D20 only; a unit test runs A1–A4 with a spy on `console.*` and fails on any payload field,
  token prefix (`EAA`, `IGAA`) or Graph error message.

## Packages
None.

## UI approach
ux.md's two screens. **Coming soon card**: the existing planned channel card in
`src/components/channel/` gains a Why? button opening a `HandoffSheet`; words in `channel-copy.ts`.
**Deletion status page**: a server component at `app/(main)/data-deletion/[code]/page.tsx`, no
client code, `noindex`; phone first, one centred card at `md:` and `lg:`.

## Gates touched
- Routes: two webhook routes, deauthorize, data deletion, the status page → `EXTERNALLY_CALLED`;
  rate limiting: webhooks and callbacks `exempt` (signed by Meta), the status page under the
  existing public-read policy.
- One repository each: `MetaEvent`, `MetaUnroutedCount`, `ConnectionLane`, `OrgDataKey`,
  `DataDeletionRequest`.
- `shared/` gains `social-events/` and `seal/`: shared's CLAUDE.md lists them as genuinely
  cross-domain.
- CSP: none here (WhatsApp's SDK is connect-whatsapp's).

## Data model
[MIGRATION]
- `MetaEvent(id, product, field, connectionId, externalAccountId, dedupeKey UNIQUE, occurredAt,
  receivedAt, state PENDING|DONE|DEAD, attempts, lastErrorCode, sealedPayload, processedAt)`;
  partial index `(connectionId, occurredAt, id) WHERE state = 'PENDING'`; index `(receivedAt)` for
  retention.
- `MetaUnroutedCount(day, product, unrouted, badSignature)`, PK (day, product), incremented with
  `ON CONFLICT DO UPDATE`.
- `ConnectionLane(connectionId, lane, holder, leaseUntil)`, PK (connectionId, lane).
- `OrgDataKey(orgId, version, wrappedKey, createdAt, retiredAt)`, PK (orgId, version).
- `DataDeletionRequest(id, code UNIQUE, metaUserIdHash, state, requestedAt, completedAt)`.
- `ChannelConnection`: new values in `CHANNEL` (`instagram`, `whatsapp`) and kind `social`;
  columns `externalBusinessId` (WhatsApp account id), `externalPhoneId`, `grantedScopes`,
  `tokenKind`, `webhookSubscribedAt`, `healthJson` (quality, payments, display name: our DTO, not
  Meta's) — the unique (externalAccountId, channel) where state is not DISCONNECTED enforces one
  shop per account (connect-* Q4, Q10).

## API / contract changes
[CONTRACT] The neutral facts (shared/social-events) and the `forgetPerson` registry.

## Test plan
- Signature: valid, invalid, missing, truncated, wrong algorithm (unit).
- Intake: a delivery with three changes for two accounts writes three rows, enqueues two drains;
  the same delivery again writes nothing (A1); an unknown account increments the count only.
- Drain: order kept across shuffled `occurredAt`; a throwing sink retried then `DEAD` while the
  rest proceed; two drains racing for one lane, one proceeds (integration).
- Deauthorize and deletion with Meta's sample signed requests (A3, A4); status page states.
- Log scan (A6); retention deletes only what is due, in batches.
- Load: the webhook route at 200 deliveries a second, p95 under 300 ms (A-D17).

## Delivery
1. Settings, Graph client, errors, limits, fake adapters (no behaviour).
2. Intake routes, `MetaEvent`, unrouted counts (behaviour: events stored).
3. Drain, translators, sinks registry, lanes (behaviour: facts handed on).
4. Deauthorize, data deletion and its page; availability and Coming soon (behaviour).
5. Seal, retention, sweep.

## Open questions
None.
