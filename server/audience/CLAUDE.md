# CLAUDE.md — audience domain

- **Verified:** 2026-11-25
- **Covers:** `server/audience/**`

> Read the project-wide rules first: [`/CLAUDE.md`](../../CLAUDE.md). Requirements are in
> [docs/specs/social-selling/consent-core/](../../docs/specs/social-selling/consent-core/); every decision is in its `decisions.md`.

## Purpose
A shop's contacts and their marketing consent: who said yes to whom, on which channel, when, and how we know.
It answers one question for the platform, *may this sender message this person on this channel?*

## Boundaries
**Owns:** `Contact` (one person known to one shop), `ConsentEvent` (the append-only log) and `Consent` (its
current-state projection). **Does not own:** sending, counting sends or caps (campaigns), the chat (inbox).

## Rules
- **A contact belongs to one shop** (R1). A shop is answered, and may record, only about its own contacts;
  `PLATFORM_SENDER` is Bhendi Bazaar's own consent and never shows in a shop's history (parent Q27).
- **Not yet is the absence of a row** (Q7). Only OPTED_IN and STOPPED are stored.
- **The projection is written only with its event, in one transaction, under the row's advisory lock**
  (`consent.repository.ts`). `ConsentEvent` is never updated.
- **An upload never revives a STOP** (R5); every other opt-in source may (`consent-rules.ts`).
- **Every marketing sender calls `audienceService.may` inside its own transaction** (D2), so a STOP
  committed first wins.

## Structure
| Path | Holds |
|---|---|
| `consent.types.ts` | The closed sets, `MayAnswer`, the DTOs |
| `consent-rules.ts` | `answerMay`, `nextConsent`: the pure rules |
| `audience.service.ts` | `may`, `recordOptIn`, `recordStop`, `history` |
| `contact.repository.ts` | The one repository of `Contact` |
| `consent.repository.ts` | The one writer of `ConsentEvent` and `Consent` |
