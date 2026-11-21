# TRD — social-selling/inbox-core

- **Status:** Draft
- **Domain:** inbox (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), parent [decisions](../decisions.md) (Q7, Q34, Q66), [ADR-0012](../../../adr/0012-modules-are-vertical-slices-by-domain.md), [ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0048](../../../adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's; this says how they are built.

## Approach
A new `server/inbox/` domain owns conversations and messages. It knows no platform. Inbound
messages arrive as one neutral job, `inbox.message-received`, which any source enqueues; outbound
replies leave through a port, `InboxSource`, which a source registers by name. `channels` supplies
the Instagram and WhatsApp sources later; this subfeature supplies only a fake source, registered in
local and preview, so the whole tool is built and accepted before any Meta access.

## Prior art
- **Shared inbox model**: Front, Zendesk and Meta's own Business Suite inbox model a conversation as
  a thread keyed by the channel's thread id, with messages ordered by the channel's timestamp and
  deduplicated by the channel's message id. We follow that (Q2).
- **Ports and adapters** (Cockburn's hexagonal architecture): the tool declares the port, the
  adapter lives with the integration. Our `MarketplaceProvider` is the same shape inside one domain;
  here the port crosses domains, so the registry is in `server/inbox/` and the adapters are in
  `server/channels/`, wired at the worker's and app's composition root, never by `inbox` importing
  `channels`.
- **Inbound at-least-once delivery**: Meta's webhooks retry and may reorder. Idempotency on the
  sender's message id, and ordering by the sender's timestamp, is the documented answer.

## Technical decisions
- **D1 — Domain `server/inbox/`.** Public surface: `inbox.service`, `inbox.types`, and the port module
  `inbox-source` (the interface and its registry). Repositories: `conversation.repository`,
  `message.repository`, each the one writer of its table.
- **D2 — The port, `InboxSource`.** Verbs: `send(conversation, message) → {externalId} | failure`,
  `window(conversation) → OPEN | HUMAN_AGENT | SHUT_TEMPLATES | SHUT`, `templates(shop) → [{id, name, costPaise}]`,
  `hide(conversation, externalCommentId, hidden)`, and `capabilities` (`canHide`, `canSendImage`).
  The window is computed by the source from the last inbound time it stores on the conversation;
  the tool never knows a platform's hours (Q7).
- **D3 — Inbound is one job.** `inbox.message-received` (spec in `server/shared/jobs/`) carries shop,
  source, thread id, person (name, handle), external message id, kind (text, image, comment,
  unsupported with a label), text, media URL, sent-at, direction (in, or out-echo from a phone app).
  Its handler upserts the conversation on (shop, source, thread id) and inserts the message with
  `ON CONFLICT (source, external id) DO NOTHING` (R12). Ordering is by `sentAt`, never arrival.
- **D4 — Outbound.** `POST` reply writes the message `PENDING` with the member's id, then enqueues
  `inbox.send` keyed on the message id; the handler calls the source's `send`, writes `SENT` with
  the external id, or `FAILED` with a reason code. One automatic retry for a temporary failure
  (retry spec `limit: 1`), none for `CONNECTION_DEAD` (Q9). Two members replying at once are two
  rows; nothing is locked.
- **D5 — Read state.** `Conversation.lastInboundAt` and `lastReadAt`; unread is `lastInboundAt >
  lastReadAt`, a derived read; opening a thread sets `lastReadAt = now()` for the shop (Q3). The
  unread count is one indexed count on (shop, unread).
- **D6 — Waiting event.** `inbox.conversation-waiting` is enqueued with `enqueueLater` four hours
  after an inbound message, keyed on (conversation, lastInboundAt); its handler emits the
  notifications event only if no outbound message is newer. No new schedule slot (the budget is
  four, `jobs.config.ts`).
- **D7 — Retention.** Sources call `inboxService.sourceDisconnected(shop, source)` (through the
  neutral job `inbox.source-disconnected`), which stamps `retireAfter = now + 90 days` on that
  source's conversations; a reconnect clears it. The deletion runs inside the daily maintenance
  slot that already exists, hard-deleting expired rows (messages carry no money or authorship
  that ADR-0020/0032 protects; parent Q34 is the owner's ruling). `inbox.person-deleted` deletes
  one person's conversations at once (R9).
- **D8 — No message text in logs.** Handlers log ids and codes only; the error tracker's
  `beforeSend` already strips request bodies; the job payload is not logged on failure.
- **D9 — The fake source.** The fake source (`fake-source.ts` in the new domain) registers only when `appEnv()` is not
  `production`, with a dev-only route `POST /api/org/[orgId]/inbox/fake` that enqueues inbound
  messages and sets the window, so every state in ux.md is reachable by hand and by tests.
- **D10 — Images.** An outgoing image is a media-library asset id; the source receives its public
  delivery URL. An inbound image is stored as the platform's URL, shown through the optimizer only
  while it lives; expired shows "Photo no longer available".
- **D11 — Public reads for other domains.** `inboxService.hasConversation(shop, source, threadId)`
  (whatsapp-contacts D3 uses it before deleting a contact), `unreadCount(shop)` (the badge, through
  notifications), `recordDelivery(externalId, status, at)` (inbox-whatsapp D2), and the command
  `recordAutomaticReply(shop, source, threadId, externalId, text)` (comment-automations D10; unique
  external id drops the platform's echo of it). Nothing else.

## Packages
None.

## UI approach
Per ux.md. Rules: [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md).
- **Phone:** list page and thread page are two routes; the reply box docks to the bottom above the
  keyboard. **`md:`** list and thread side by side (list 360px). **`lg:`** adds the person's panel
  (handle, platform, first seen).
- **Rendering:** `inbox/page.tsx` and `inbox/[conversationId]/page.tsx` are server components reading
  `inbox.dal.ts` (`InboxListDTO`, `ConversationDTO`). Client leaves: `ReplyBox`, `HideToggle`,
  `TabChips`, `LiveRefresher` (re-reads every 20 s while visible, no sockets).
- **Behaviour:** `inboxApiClient` (`reply`, `retry`, `hide`, `markRead`) through `useMutation`;
  copy in `inbox-copy.ts` under `src/components/inbox/`.
- **Surfaces:** template picker is a picker sheet (ADR-0040); no new token.

## Gates touched
- `module-boundaries` — `inbox` in `PUBLIC_SURFACE` with `inbox-source`; a new rule that `inbox` imports
  no `channels/providers` (A8).
- `docs-integrity` — the new domain's `CLAUDE.md` in `LIVING_DOCS`; the root domain table gains inbox.
- `portal-boundary`, `route-reachability`, `request-body-parsing` — the reply, retry, hide, read and
  fake routes use `withOrg` and Zod schemas.
- `one-repository` — `Conversation`, `InboxMessage` written only by their repositories.
- `rate-limit` registry — the routes classified under the portal policy.

## Data model [MIGRATION]
`Conversation`: shop, source, external thread id, kind (DM, COMMENT_THREAD, CHAT), person name,
handle, post reference (comment threads), lastInboundAt, lastReadAt, lastReadBy, hiddenAt,
retireAfter. Unique (shop, source, external thread id). `InboxMessage`: conversation, direction,
external id, kind, text, media asset id or URL, unsupported label, sentAt, status, failure code,
sent-by member. Unique (source, external id) where present. Both cascade from a conversation only.

## API / contract changes [CONTRACT]
`InboxListDTO`, `ConversationDTO`, `MessageDTO`, `REPLY_WINDOW`; the `InboxSource` port and the
`inbox.message-received` job payload. CONTRACTS.md gains an "Inbox" section.

## Test plan
- Unit: unread derivation; window → reply box mode; dedupe on external id; ordering by sentAt.
- Integration: duplicate inbound is one row; two concurrent replies both stored; send failure then
  retry; waiting event fires once and not after a reply; retention deletes only the disconnected
  source's rows after 90 days, and none after a reconnect; person deletion scoped to one person
  and one shop; another shop's conversation is 404.
- Boundary: mutation-tested rule that `server/inbox/**` never imports `server/channels/**`.
- Manual: A1–A7 on dev with the fake source, at 360px.

## Delivery (units)
1. Schema, repositories, inbound job and handler, the port and fake source — no UI.
2. Inbox list and thread pages, reply and read; menu item with count — behaviour-changing.
3. Reply windows, template picker, hide, send failure and retry.
4. Waiting event, retention, person deletion; the D11 public reads and `recordAutomaticReply`.

## Open questions
None.
