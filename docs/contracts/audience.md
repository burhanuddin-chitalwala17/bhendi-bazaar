# Contracts — audience

- **Verified:** 2026-11-25
- **Covers:** `server/audience/*.types.ts`

The audience shapes other domains call. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## social-selling/consent-core

Consent per (contact, sender, channel) (`server/audience/consent.types.ts`, D1, D2). A sender is a shop's org id
or `PLATFORM_SENDER`; channels are `CONSENT_CHANNEL` (WHATSAPP, EMAIL).
**`audienceService.may(sender, contactId, channel, tx?)`** answers **`MayAnswer`**: `{ yes: true }` or
`{ yes: false, reason }`, `reason` one of `MAY_REASON` (NOT_OPTED_IN, STOPPED, NO_CHANNEL). Every marketing
sender asks it inside its own transaction. **`recordOptIn`** and **`recordStop`** take
**`ConsentChangeInput`** (`sender`, `contactId`, `channel`, `source`: one of `CONSENT_SOURCE`, `evidence`: the
order, message, file or attestation as a JSON object) and an optional `tx`, and answer
**`ConsentChangeResult`** (`changed`, `state`); `changed: false` when the state already held or an upload met a
STOP. A shop's id on another shop's contact is 404. **`history(orgId, contactId, limit?)`** answers
**`ConsentHistoryEntryDTO[]`** (`channel`, `change`, `source`, `evidence`, `at`), newest first. **`isShopContact(orgId, contactId, tx?)`** answers whether the contact is that shop's own.
