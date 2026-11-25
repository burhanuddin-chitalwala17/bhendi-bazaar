# Contracts — inbox

- **Verified:** 2026-11-25
- **Covers:** `server/inbox/*.types.ts`

The inbox's shapes that cross a domain or the browser/server boundary (social-selling/inbox-core). Rules, the
error envelope and pagination are in [CONTRACTS.md](../CONTRACTS.md); read those first.

## Needs you and waiting (unit 4)

**`inboxWaiting.markNeedsYou(conversationId, reason)`** — an automation hands a thread to the shop; `reason` is one
of `NEEDS_YOU_REASON` (`handover`, `unanswerable`). Unknown thread: `NotFoundError`. A member's send clears it (D6).
The inbox emits `conversation-waiting` to notifications with facts `{ conversationId, platform }`, once per
waiting spell (decisions Q19); `inboxWaiting.stillWaiting` is that kind's still-open check, listed in
`server/notifications/still-open.registry.ts`.

## Privacy (unit 4)

`server/inbox/inbox-privacy.types.ts` (D9, R14). **`SupportShareDTO`** (`conversationId`, `requestId`, `until`
ISO). **`InboxPrivacyDTO`** (`opens`: `ChatOpenDTO[]` — `id`, `at`, `conversationId`, `person` (null once the chat
is deleted); `shares`: live shares with `person`) never carries a message body or who at support opened it.
**`SharedMessageDTO`** is what support's one open under a live share returns. Body of a share: `supportShareSchema`
(`requestId`, one of the shop's open requests, else a `DomainError` on `requestId`).

A person's deletion request reaches the inbox through the `inbox` forgetter (`server/shared/social-events/forget.ts`).

## Sending (unit 3)

`POST /api/org/{orgId}/inbox/conversations/{id}/messages` takes `replySchema`
(`src/lib/validation/schemas/inbox-reply.schema.ts`: `clientId` (a UUID the box makes once per reply), `text` ≤ 1,000,
optional `mediaId` from the shop's library; text or a picture) and answers 201 `{ message: SentReplyDTO }`
(`server/inbox/inbox-send.types.ts`: `id`, `state` (`MESSAGE_STATE`, `HELD` here), `sendAfter` (ISO, when it goes)).
The same `clientId` again answers the first reply. 409 when the platform has no inbox yet or its window allows no free
reply; 400 on `mediaId` for a picture not ready in the shop's library.
`POST …/inbox/messages/{id}/undo` answers `{ reply: UndoneReplyDTO }` (`text`, `mediaId`) while the reply is held, 409
after. `POST …/inbox/messages/{id}/retry` re-queues a `FAILED` reply and answers `{ message: SentReplyDTO }`
(`QUEUED`), 409 for any other state. A failed row's `errorCode` is a `SOCIAL_ERROR` code the UI words. Every route
needs Social selling.

`inboxSendService.sendAutomatic({ orgId, conversationId, key, text })` is the automations' send: no hold, no pause,
idempotent on the caller's `key`.

## The `ConversationSource` port (channels)

`server/channels/conversation-source.types.ts`: what a platform's inbox implements inside channels (inbox-core D7):
`window`, `send`, `markRead`, `typing`, `fetchMedia`, `actions`. A source registers with
`registerConversationSource`; the inbox reaches it only through `conversationSources` (`.has`, `.window`, `.send`),
which answers a `SendOutcome` (`sent` with the platform's id, `busy`, `not-sent` with a `SOCIAL_ERROR`, `uncertain`)
and never throws a platform's error. `ReplyWindow` is `REPLY_WINDOW` (`open`, `human_agent`, `template_only`, `shut`)
and `closesAt`; a free reply goes only in `FREE_REPLY_WINDOWS`.
