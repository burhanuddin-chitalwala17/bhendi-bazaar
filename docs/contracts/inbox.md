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
