# Contracts — campaigns

- **Verified:** 2026-11-25
- **Covers:** `server/campaigns/*.types.ts`

The campaigns shapes other domains call. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## social-selling/whatsapp-sending

The WhatsApp send port (`server/campaigns/campaigns.types.ts`, D1, Q12).
**`whatsAppSendService.deliverByWhatsApp(input)`** takes **`DeliverByWhatsAppInput`** (`orgId`, `contactId`,
`template`: `{ name, language }` with `language` one of `TEMPLATE_LANGUAGE`, `values`: the template's blanks as a
JSON object, `purpose`: one of `SEND_PURPOSE` (MARKETING, UTILITY), `sourceRef`, `idempotencyKey`) and answers
**`DeliverAnswer`**: `{ outcome: SENT_QUEUED, sendId, estimatePaise }`, `{ outcome: SKIPPED, sendId, reason }` with
`reason` one of `SKIP_REASON` (NOT_OPTED_IN, STOPPED, NO_CHANNEL, HOW_OFTEN), or `{ outcome: HELD, sendId, reason,
tellShop }` with `reason` one of `HELD_REASON` (LIMIT, LIMIT_NOT_SET); `tellShop` is true on the month's first hold at
the limit. A repeated `idempotencyKey` for the shop answers the first call's outcome. A UTILITY send skips the
how-often rule only. **`whatsAppCounts(orgId, contactId)`** answers **`TouchCounts`** (`today`, `week`): marketing
touches in the IST day and the IST week from Monday, across channels.
**`sendHeld(orgId, actorId)`** answers **`SendHeldResult`** (`queued`, `skipped`, `stillHeld`).
**`spendThisMonth(orgId)`** answers **`MonthSpendDTO`** (`month`, `spentPaise`, `reservedPaise`, `limitPaise`,
`heldCount`).

Messaging settings (D4, D6). **`messagingSettingsService.get(orgId)`** answers **`MessagingSettingsDTO`**
(`limitPaise`, `limitSet`, `hours`: `ShopHours`, `version`, and Advanced: `howOftenDay`, `howOftenWeek`,
`greetingDelaySeconds`, `botPauseHours`, `alertsPerProductPerDay`). **`limitSet(orgId)`** answers whether the shop
answered the limit step; **`hoursFor(orgId)`** answers **`ShopHours`**: each of `WEEKDAYS` to `{ open, close }`
("HH:MM", IST) or null for closed. **`setLimit`** (paise, at least `MIN_LIMIT_PAISE`, or null for No limit),
**`setHours`** and **`setAdvanced`** take `(orgId, actorId, value)`, refuse with a 400 naming the field, audit the
change, and answer the settings.
