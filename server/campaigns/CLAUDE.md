# CLAUDE.md — campaigns domain

- **Verified:** 2026-11-25
- **Covers:** `server/campaigns/**`

> Read the project-wide rules first: [`/CLAUDE.md`](../../CLAUDE.md). Requirements are in
> [docs/specs/social-selling/whatsapp-sending/](../../docs/specs/social-selling/whatsapp-sending/); every decision is in its `decisions.md`.

## Purpose
The one door every business-initiated WhatsApp message goes through: it asks consent, applies the shop's
how-often rule and its spending limit, and answers sent, skipped or held. It also keeps the shop's messaging
settings and what each message costs.

## Boundaries
**Owns:** `MessagingSettings`, `MessagingSpend`, `WhatsAppSend`, `MarketingTouch`. **Does not own:** contacts or
consent (audience, asked through `audienceService.may` inside the send's transaction), the WhatsApp connection
(channels).

## Rules
- **Every send goes through `whatsAppSendService.deliverByWhatsApp`** (D1). Consent, how-often and spend are
  checked in one transaction; a utility send skips only how-often.
- **How-often counts under the buyer's advisory lock** (`marketing-touch.repository.ts`), and a touch is written
  only by a queued marketing send, so no race passes the rule.
- **Spend is reserved by one conditional statement** (`messaging-spend.repository.ts`): two senders at the limit
  cannot both pass. All amounts are integer paise; rates are whole paise, rounded up (`rates.ts`).
- **A held send keeps its row** and is released only by Send held, oldest first, re-running every check.
- **Every settings change is audited in its own transaction** (D7).

## Structure
| Path | Holds |
|---|---|
| `campaigns.types.ts` | Closed sets, the port's input and answers, settings DTOs, words |
| `rates.ts` | The dated India rate table and the estimate |
| `messaging-rules.ts` | IST windows, the how-often rule, defaults and settings refusals: the pure rules |
| `whatsapp-send.service.ts` | `deliverByWhatsApp`, `whatsAppCounts`, `sendHeld`, `spendThisMonth` |
| `messaging-settings.service.ts` | `get`, `limitSet`, `hoursFor`, `setLimit`, `setHours`, `setAdvanced` |
| `messaging-settings.repository.ts` | The one writer of `MessagingSettings` |
| `messaging-spend.repository.ts` | The one writer of `MessagingSpend` |
| `whatsapp-send.repository.ts` | The one writer of `WhatsAppSend` |
| `marketing-touch.repository.ts` | The one writer of `MarketingTouch` |
