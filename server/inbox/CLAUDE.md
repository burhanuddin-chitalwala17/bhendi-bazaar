# CLAUDE.md — inbox domain

- **Verified:** 2026-11-25
- **Covers:** `server/inbox/**`

> Read the project-wide rules first: [`/CLAUDE.md`](../../CLAUDE.md). Requirements are in [docs/specs/social-selling/inbox-core/](../../docs/specs/social-selling/inbox-core/); every decision is in its `decisions.md`.

## Purpose
A shop's conversations on its social platforms, and every message in them: what the person wrote, what the shop sent from the platform's own app, and (later units) what a member or an automatic reply sends from here. Knows no platform: facts arrive through the sinks, sends leave through the `ConversationSource` port in channels.

## Boundaries
**Owns:** `Conversation`, `Message`, `SupportGrant` and `SealAccess`. **Does not own:** Meta's payloads or tokens (channels, which hands neutral facts from `server/shared/social-events/`), the sealing key (`server/shared/seal/`), or who a connection belongs to (asked of `channels/social-owners.service`).

## Rules
- **Sinks are idempotent on the dedupe key** (D2, R12): `<orgId>:<platform>:<message id>` (a file beyond the first adds `#n`; comments, reactions and edits add their own word). A drain that hands a fact again writes nothing and moves no cursor.
- **Platform time orders a thread** (hazard: late delivery). A message's `sentAt` is when it happened; only one at least as new as the newest moves the preview and the unread flag.
- **A status only raises a row** (D2): `STATE_RANK` in `inbox.types.ts`, applied in one conditional statement scoped to the shop.
- **Bodies and previews are sealed before they are written** (A-D12), bound to their own row (`Message` / `Conversation`). No file outside this domain names a sealed column, and no log or `admin.*` file here does: `tests/unit/sealed-columns.test.ts`.
- **A cart's and a location's body is sealed JSON, not words** (`STRUCTURED_KINDS`, `LocationBody` in `message-rows.ts`; inbox-whatsapp Q12): the list names them by kind, never by a preview.
- **A person's new id moves their DM thread in place** (`person-rekeyed`, inbox-whatsapp D1), unless a thread already holds the new id.
- **Every write takes a fresh `changeSeq`** (except `waitingEmittedAt`, which no screen shows) from its table's sequence (A-D14, decisions Q17); a message's change also bumps its conversation, so the list's cursor sees every change.
- **Waiting is told once a spell** (D5, decisions Q19): `waitingEmittedAt` is claimed by the sweep and cleared where a thread starts waiting again. The sweep and retention are woken by `enqueueLater`, never a schedule slot.
- **Support opens a chat only through a live share, and every open is logged first** (D9, Q21): `inboxPrivacy.openForSupport`. Nothing outside this domain calls `seal.open`: `tests/unit/sealed-columns.test.ts`.
- **Retention pulls, it is not told** (D10, Q20): a thread's `accountRef` against channels' `socialOwners.settledBefore`.

## Structure
| Path | Holds |
|---|---|
| `inbox.types.ts` | The closed sets: kinds, directions, authors, states and their rank |
| `message-rows.ts` | What a message fact becomes in a thread, named lines included; pure |
| `inbox-intake.service.ts` | Facts into conversations and messages, one transaction per fact |
| `inbox.sinks.ts`, `inbox.jobs.ts` | The sinks, the jobs and the forgetter, registered when the worker imports `inbox.jobs.ts` |
| `conversation.repository.ts` | The one writer of `Conversation` (`conversationCare`: Needs you, waiting, retention) |
| `inbox-waiting.service.ts` | Needs you, the waiting sweep and its still-open check |
| `inbox-privacy.service.ts`, `inbox-privacy.types.ts` | Support shares, support's one open, the shop's open log |
| `inbox-retention.service.ts` | Retention and a person's deletion |
| `inbox-care.job.ts` | The sweep's and retention's job specs and their wake-ups |
| `support-grant.repository.ts`, `seal-access.repository.ts` | The one writers of `SupportGrant` and `SealAccess` |
| `message.repository.ts` | The one writer of `Message` |
