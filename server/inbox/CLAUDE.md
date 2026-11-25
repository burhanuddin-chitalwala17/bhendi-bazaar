# CLAUDE.md — inbox domain

- **Verified:** 2026-11-25
- **Covers:** `server/inbox/**`

> Read the project-wide rules first: [`/CLAUDE.md`](../../CLAUDE.md). Requirements are in [docs/specs/social-selling/inbox-core/](../../docs/specs/social-selling/inbox-core/); every decision is in its `decisions.md`.

## Purpose
A shop's conversations on its social platforms, and every message in them: what the person wrote, what the shop sent from the platform's own app, and (later units) what a member or an automatic reply sends from here. Knows no platform: facts arrive through the sinks, sends leave through the `ConversationSource` port in channels.

## Boundaries
**Owns:** `Conversation` and `Message`. **Does not own:** Meta's payloads or tokens (channels, which hands neutral facts from `server/shared/social-events/`), the sealing key (`server/shared/seal/`), or who a connection belongs to (asked of `channels/social-owners.service`).

## Rules
- **Sinks are idempotent on the dedupe key** (D2, R12): `<orgId>:<platform>:<message id>` (a file beyond the first adds `#n`; comments, reactions and edits add their own word). A drain that hands a fact again writes nothing and moves no cursor.
- **Platform time orders a thread** (hazard: late delivery). A message's `sentAt` is when it happened; only one at least as new as the newest moves the preview and the unread flag.
- **A status only raises a row** (D2): `STATE_RANK` in `inbox.types.ts`, applied in one conditional statement scoped to the shop.
- **Bodies and previews are sealed before they are written** (A-D12), bound to their own row (`Message` / `Conversation`). No file outside this domain names a sealed column, and no log or `admin.*` file here does: `tests/unit/sealed-columns.test.ts`.
- **Every write takes a fresh `changeSeq`** from its table's sequence (A-D14, decisions Q17); a message's change also bumps its conversation, so the list's cursor sees every change.

## Structure
| Path | Holds |
|---|---|
| `inbox.types.ts` | The closed sets: kinds, directions, authors, states and their rank |
| `message-rows.ts` | What a message fact becomes in a thread, named lines included; pure |
| `inbox-intake.service.ts` | Facts into conversations and messages, one transaction per fact |
| `inbox.sinks.ts`, `inbox.jobs.ts` | The sinks, registered when the worker imports `inbox.jobs.ts` |
| `conversation.repository.ts` | The one writer of `Conversation` |
| `message.repository.ts` | The one writer of `Message` |
