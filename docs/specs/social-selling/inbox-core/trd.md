# TRD — social-selling/inbox-core

- **Status:** Accepted
- **Domain:** inbox (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md) (A-D7, D8, D9, D12, D14, D16), [ADR-0079](../../../adr/0079-a-shops-conversations-are-sealed-under-its-own-key.md), [ADR-0080](../../../adr/0080-every-effect-on-a-platform-is-a-row-claimed-before-the-call.md), [ADR-0024](../../../adr/0024-phone-is-contact-data-not-an-identity-key.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The inbox is platform-neutral: conversations and messages fed by sinks (A-D7), sent through a
`ConversationSource` port that inbox-instagram and inbox-whatsapp implement in channels. Bodies are
sealed per shop (A-D12). A member's send is a held row (7 s, Q16) that becomes a claimed outbox row
(A-D8). Every list is a keyset read on an index; live updates come from a change cursor (A-D14).

## Prior art
- **Shared team inboxes** (Front, Intercom, Zendesk): one conversation per thread per channel,
  per-conversation state, author shown to teammates only, "snooze/needs reply" queues sorted
  oldest-waiting first. We follow the model; assignment is Later (spec).
- **Undo send** (Gmail): a server-side delay with cancel, not a client trick, so it holds across a
  closed tab. Followed (D6).
- **Read state for a shared inbox** is per conversation, not per member, in Front's "shared" mode;
  matches Q3. Followed.

## Technical decisions
- **D1 — Model.** `Conversation(id, orgId, connectionId, platform, kind DM|COMMENT, threadKey,
  personKey, personName, personHandle, personPhone (contact data), postRef (comment threads),
  lastMessageAt, lastInboundAt, lastPreviewSealed, unread bool, needsYou bool, needsYouReason,
  autoAnswered bool, sortRank, botPausedUntil, window JSON (from the source), changeSeq)`, unique
  (orgId, platform, threadKey) (Q2). `Message(id, conversationId, orgId, direction IN|OUT,
  author MEMBER|AUTOMATIC|APP|PERSON, memberId, kind TEXT|IMAGE|VIDEO|AUDIO|DOCUMENT|LOCATION|
  STICKER|CART|TEMPLATE|UNSUPPORTED|EDIT|REACTION, bodySealed, attachmentRef, platformMessageId,
  dedupeKey UNIQUE, state HELD|QUEUED|CLAIMED|SENT|DELIVERED|READ|FAILED|UNCERTAIN|CANCELLED,
  sendAfter, errorCode, sentAt, changeSeq)`. `sortRank` is 0 for Needs you, 1 otherwise, so one index
  serves "Needs you first, oldest waiting first; then newest first" (ux).
- **D2 — Sinks (R1–R4a, R8, R12).** `inbox` registers sinks for `InboundMessage`, `OutboundEcho`,
  `MessageStatus`, `Reaction`, `MessageEdit`, `CommentEvent`, `CartOrder`. Each upserts the
  conversation and inserts the message on `dedupeKey` (Meta's id), seals the body, sets unread, and
  bumps `changeSeq` from `inbox_change_seq`. A status never regresses (READ never returns to
  DELIVERED: states ranked and updated with a `WHERE rank < $new`). Media is fetched lazily on open
  through the source (WhatsApp media ids expire; Instagram URLs expire), cached as a sealed object in
  the store for the conversation's life. Voice notes are `AUDIO` and play (R8, Q5 revised).
- **D3 — Window (R6, Q7).** The source computes `window` from `lastInboundAt` and platform rules
  (WhatsApp 24 h; Instagram 24 h free, 7 days human agent, then shut) and stores it with the
  conversation; the reply box renders from it; the server re-checks at send.
- **D4 — Read state and counts (R4, Q3).** Opening a thread sets `unread = false` with a
  conditional update; the menu's Needs you count and each tab's count are partial-index counts
  (`WHERE needsYou`, `WHERE unread`) per (orgId, platform), cached nowhere.
- **D5 — Needs you (R4a, parent Q114).** Set by automations (handover, unanswerable) through
  `inboxService.markNeedsYou(conversationId, reason)`; cleared when a member sends; `conversation
  waiting` is emitted to notifications by the sweep for a Needs you or unread inbound conversation
  older than 4 hours, once per conversation per waiting spell (a `waitingEmittedAt` guard) (R10).
- **D6 — Sending with a hold (R5, R9, Q9, Q16).** `POST …/conversations/[id]/messages` (Zod: text ≤
  1,000, optional library media id) re-checks the window, inserts `HELD` with `sendAfter = now + 7 s`
  and a client id for idempotent double-taps, clears Needs you, pauses automations
  (`botPausedUntil`, enquiry Q5), and enqueues `inbox.send(messageId)` with `startAfter = sendAfter`.
  `POST …/messages/[id]/undo` moves `HELD → CANCELLED` conditionally and returns the text; at 0 the
  job moves `HELD → QUEUED → CLAIMED` and sends on the connection's `messages` lane. One automatic
  retry for a not-sent error (Q9), then `FAILED` with our reason; Try again re-queues the same row.
  `UNCERTAIN` per A-D8. Templates and checkout links use the same path.
- **D7 — Sources (R7).** `ConversationSource` port in channels: `send`, `markRead`, `typing`,
  `fetchMedia`, `actions` (declared per platform: hide/unhide, private reply, template), `window`.
  The thread's ⋯ renders the declared actions only.
- **D8 — Search (R11, Q3).** By name or handle with `lower(personName) LIKE $q%` and handle on
  btree indexes (prefix), plus the last four digits of a phone; no message search (sealed).
- **D9 — Privacy (R14, Q116).** `SupportGrant(id, orgId, conversationId, requestId, grantedById,
  expiresAt, revokedAt)`; `inboxSeal.open` accepts a member session for the org or a support user
  with a live grant for that conversation, and writes `SealAccess(orgId, conversationId, who, at)`
  for any non-member open, which is "Who has opened your chats". The privacy sheet and log read
  these. `sealed-columns.test.ts` covers this domain.
- **D10 — Retention (R13, parent Q34).** Conversations whose connection has been disconnected for 90
  days, and not reconnected to the same account, are deleted in batches by `social.retention`
  (A-D15); a person's deletion (`forgetPerson`) removes their conversations at once.
- **D11 — Live updates.** `GET …/inbox/changes?after=` returns changed conversations (and, with a
  thread open, its new or changed messages) by keyset on `changeSeq`; `useChangeFeed` merges them;
  "N new" pill when rows would move under the thumb (ux).
- **D12 — Concurrency (hazard: two members replying).** Sends are independent rows; both go, both
  show with their authors, which is what a shared inbox does. Two opens of the same thread race only
  on `unread`, which is idempotent.

## Packages
None.

## UI approach
ux.md: Inbox list (server-rendered first page, client leaf for filters, search and the feed),
thread page on a phone and a right pane from `md:` landscape / `lg:`, details sheet → third pane at
`xl:`. Components in `src/components/inbox/` with `inbox-copy.ts`, `inboxApiClient.ts`, hooks
`useThread`, `useReplyBox` (the hold countdown is display only; truth is the row's state). The tab
bar gains Inbox in Earnings' slot when the plan is on (parent Q115), through `portal-nav.ts`.

## Gates touched
New domain `inbox`; routes list, thread, send, undo, retry, open (read), changes, share-with-support,
privacy log; `poll` rate-limit policy; `MAY_USE_SHEET` (details, privacy, share); sealed-columns.

## Data model
[MIGRATION] `Conversation`, `Message` (D1); `SupportGrant`, `SealAccess` (D9); sequence
`inbox_change_seq`. Indexes: conversations `(orgId, platform, sortRank, lastMessageAt DESC, id)`,
`(orgId, changeSeq)`, partial `(orgId, platform) WHERE needsYou`, `WHERE unread`,
`(orgId, lower(personName) text_pattern_ops)`; messages `(conversationId, sentAt, id)`,
`(state, sendAfter) WHERE state = 'HELD'` for the sweep.

## API / contract changes
[CONTRACT] `ConversationSource` port; `inboxService.markNeedsYou`, `sendAutomatic` (for
automations, no hold), `connectionClosed`, `forgetPerson`.

## Test plan
- Sinks idempotent; status never regresses; out-of-order messages sort by platform time.
- Hold: undo within 7 s cancels and returns text; undo at the race edge, exactly one of send or
  cancel wins (integration); a closed client still sends (A8).
- Window re-check at send; template-only path.
- Sealed: raw row is ciphertext; open refused for another org and for staff without a grant (A7).
- Counts and keyset pagination on 50,000 seeded conversations within the p95 budget (A-D17).
- Unknown kinds as named lines (A4).

## Delivery
1. Model, seal use, sinks (behaviour: messages land).
2. List, thread, read state, counts, search, changes feed.
3. Send with hold, undo, retry, uncertain (behaviour: replies).
4. Needs you, waiting event, privacy grants and log, retention.
5. UI and the tab bar slot.

## Open questions
None.
