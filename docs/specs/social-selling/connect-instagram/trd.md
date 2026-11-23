# TRD — social-selling/connect-instagram

- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [meta-foundation TRD](../meta-foundation/trd.md), the marketplace connect flow (`server/channels/connect-state.ts`, `server/channels/channel-connection.service.ts`)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Instagram becomes a `social` channel on the same connection machinery the marketplaces use: the
signed `state`, the callback, the one repository, the daily `maintain` pass, the disconnect dialog.
What is new is Instagram Login's token exchange and renewal, the account check, the webhook
subscription, and the card's checklist and message-access step.

## Prior art
- **Instagram API with Instagram Login**: authorize at Instagram's OAuth endpoint with the business
  scopes, exchange the code for a short-lived token, exchange that for a 60-day long-lived token,
  refresh it any time after 24 hours while it is valid. Meta's documented flow; we follow it.
- **Our marketplace connect** (signed `state` bound to org and member, ten minutes, one use;
  renewal under `lockSecrets`): followed exactly; it is right for this case too.

## Technical decisions
- **D1 — Connect (R1, R2, R5, Q2).** `POST api/channels/instagram/connect` (org guard, plan assert,
  `SOCIAL_CONNECT` open) returns Instagram's authorize URL with the four business scopes and a
  `state` from `connect-state.ts` (org, member, nonce, ten-minute expiry, single use recorded).
  `GET api/channels/instagram/callback` verifies `state`, exchanges the code (short-lived, then
  long-lived), reads `me?fields=user_id,username,account_type`, and decides, in one transaction
  under the connection's row lock: personal account → nothing stored, `CONNECT_RESULT.PERSONAL`;
  account held by another shop (the unique index) → `ACCOUNT_IN_OTHER_SHOP`; reconnect with a
  different account → `DIFFERENT_ACCOUNT`; otherwise upsert the connection Connected with the
  sealed token (credential ring, as marketplaces) and its expiry. It then subscribes the account to
  webhooks (`comments`, `messages`, `messaging_postbacks`, `message_edit`, `messaging_seen`,
  `messaging_reactions`) and redirects to Channels with the result code (R3, R4).
- **D2 — Renewal (R8, Q6).** In the daily `maintain` pass: Instagram connections whose token is
  older than 7 days are refreshed under `lockSecrets`, writing token and expiry in one update. Meta
  answering 190 sets Needs reconnecting (`TOKEN_REVOKED`). Refreshing at 7 days of a 60-day life
  leaves 53 days of retries.
- **D3 — Message access (R6, Q16).** The checklist step "Turn on replies" is done when the first
  `InboundMessage` for the connection arrives (a sink sets `firstMessageAt`). When a send or a
  conversations read answers Meta's "access to messages not allowed" code, the connection's health
  records `MESSAGES_OFF` and the card shows the Needs you state; the next inbound message clears it.
  The spike confirms the code Meta returns.
- **D4 — Health and checklist (R7, R9, R12).** The card's DTO, built by
  `channel-connection.service.overview`, gains `checklist: { step, state: done|next|waiting|todo }[]`
  computed from facts other domains own, read through their public surfaces (first post from social,
  comment rule from automations), never stored. Needs reconnecting emits `connection needs you`.
  "Check now" runs the health read on demand, rate-limited per shop.
- **D5 — Disconnect (R10).** As marketplaces: confirm, call Instagram to unsubscribe webhooks (best
  effort), delete the token, keep the record Disconnected; inbox starts the 90-day clock through
  its public `connectionClosed(connectionId)`.

## Packages
None.

## UI approach
ux.md's card, return note, Turn on replies sheet and disconnect dialog, on the existing channel card
components (`channel-card-shell.tsx`, `connect-result-note.tsx`, `disconnect-dialog.tsx`); the
checklist is a new `channel-setup-checklist.tsx` shared with WhatsApp. Phone: one card per row,
checklist inside, main action full width; `md:` two across; `lg:` three. Server-rendered card;
the buttons are the client leaf (`useMutation` through `channelsApiClient.ts`). Words in
`channel-copy.ts`.

## Gates touched
Routes connect, callback (`EXTERNALLY_CALLED`: Instagram's redirect), check-now; rate limiting
(callback under the existing OAuth policy). Copy: `channel-copy.ts`.

## Data model
None beyond meta-foundation's connection columns; `firstMessageAt` on `ChannelConnection` (health).

## API / contract changes
None beyond the card DTO (internal to channels' UI).

## Test plan
- Callback: valid; replayed, edited, expired or other-browser `state` (A2); personal (A3); other
  shop and different account (A4), each with Instagram's answers stubbed.
- Renewal under concurrency: two `maintain` runs, one refresh, both tokens consistent (A5).
- Deauthorize to Needs reconnecting and the Home line (A6).
- Disconnect leaves no readable credential: a repository read of the row's columns (A7).
- Checklist states from stubbed facts.

## Delivery
1. Connect and callback with results (behaviour).
2. Renewal, health, deauthorize wiring, disconnect.
3. Card, checklist, Turn on replies sheet, return notes (UI).

## Open questions
None.
