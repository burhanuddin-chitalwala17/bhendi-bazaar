# TRD — social-selling/connect-instagram

- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (draft), [decisions.md](decisions.md), parent [decisions](../decisions.md), [channel-connectors trd.md](../../marketplace-integration/channel-connectors/trd.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0068](../../../adr/0068-meta-is-a-connected-shopfront.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Instagram is a new channel of a new kind, `social` (ADR-0068), connected through the machinery
channel-connectors built: the signed `state`, the versioned `shared/crypto`, the one
`ChannelConnection` row per (shop, channel), the outcome codes and the daily `channels.maintain`
pass. What differs is the provider. Marketplaces sit behind `MarketplaceProvider`, whose verbs are
listings and stock; a social account has none of those. So the connection verbs (consent URL,
exchange, renew, identify, check) move to a small `ConnectionProvider` that both extend, and
Instagram implements only it. Later subfeatures add a `SocialProvider` plug (publish, inbox) in
`providers/instagram/`; the tools reach it through ports (parent Q7, Q79).

## Prior art
- **Instagram API with Instagram Login** (Meta's business-login page, 2026-11-06): authorization
  code → 1-hour token → `ig_exchange_token` for a 60-day token → `ig_refresh_token` once it is a
  day old. We follow it exactly; renewal at 7 days old leaves 53 days of margin for a failed pass.
- **Deauthorize and data-deletion callbacks** are Meta's signed-request contract (`signed_request`,
  HMAC-SHA256 with the app secret, answer `{url, confirmation_code}`). Followed as written.
- **Nango and similar brokers** treat a token whose refresh fails with an auth error as needing the
  user, not a retry; we already do (channel-connectors D8). Followed.
- Our own `MarketplaceProvider` mixes connection and marketplace verbs in one interface. Splitting
  out `ConnectionProvider` fixes that for a channel with no listings rather than stubbing them.

## Technical decisions
- **D1 — `CHANNEL.INSTAGRAM`, kind `CHANNEL_KIND.SOCIAL`** in `server/shared/channels.ts` (Q14).
  Not in `PUBLISHABLE_CHANNELS`' readiness or feeds: a social channel takes posts, not listings.
  `meta`'s label becomes "Meta catalogue" (Q13).
- **D2 — `ConnectionProvider`** (`configured`, `consentUrl`, `readReturn`, `exchange`, `renew`,
  `identify`, `check`, `connectionCap`), extracted from `MarketplaceProvider`, which extends it. No
  behaviour change for Amazon or Flipkart. `providerFor` returns a `ConnectionProvider`; marketplace
  verbs are reached through `marketplaceProviderFor`.
- **D3 — `providers/instagram/`.** Consent at `www.instagram.com/oauth/authorize` with the scopes of
  Q2; exchange at `api.instagram.com/oauth/access_token`, then `graph.instagram.com/access_token`
  for the long-lived token; `identify` reads `/me?fields=user_id,username,account_type`. Plain
  `fetch`, 10-second timeout, response bodies never logged.
- **D4 — Account type is checked at the callback.** `account_type` other than `BUSINESS` or
  `MEDIA_CREATOR` stores nothing and answers `CONNECT_RESULT.PERSONAL_ACCOUNT` (Q3).
- **D5 — Identity.** The Instagram-scoped `user_id` is `externalAccountId`: another shop's is
  refused (`other_shop`), a different one on reconnect is refused (`different_account`), as Amazon's
  is (channel-connectors D9). `username` and account type are stored as display fields, refreshed
  by each check.
- **D6 — Renewal.** No refresh token: the access token is renewed in place. The daily pass takes the
  row `FOR UPDATE` (channel-connectors D8), renews when `authorizedAt` or the last renewal is over
  7 days old, writes token and expiry in one update. An `OAuthException` code 190 sets
  `NEEDS_RECONNECT` with `CONNECTION_ERROR.REJECTED`; a 5xx or timeout is left for the next pass.
  Every move to `NEEDS_RECONNECT` (here, D7) enqueues `channels.needs-reconnect` (orgId, channel,
  reason) in the same transaction, for notification-hub (parent Q41); a reconnect enqueues its
  `resolved` twin.
- **D7 — Deauthorize: `POST /api/channels/instagram/deauthorize`.** Verifies `signed_request`,
  finds connected rows with that `user_id`, sets `NEEDS_RECONNECT` / `REVOKED`, nulls the token.
  Unknown user answers 200; a bad signature answers 400.
- **D8 — Data deletion: `POST /api/channels/instagram/data-deletion`.** Same verification; nulls
  token, username and account type on every row for that `user_id`, writes a `DataDeletionRequest`
  row (confirmation code, user id hash, received, completed) and answers
  `{url: appUrl('/data-deletion/<code>'), confirmation_code}`. The status page reads only that row.
  This handler enqueues `channels.person-deleted` (platform, person's platform id); inbox-instagram
  D9 and audience D12 handle it (parent Q34). Meta's callback is per app, so it serves WhatsApp too.
- **D9 — The switch.** `CHANNELS_CONNECT` gains `instagram`; `isOpen` takes a `ConnectableChannel`
  (marketplace or social). Off in production until approval (Q11); on in dev with app roles (Q12).
- **D10 — Outcomes.** `CONNECT_RESULT` gains `personal_account`. `CARD_STATE` is unchanged.
- **D11 — Connected is not "selling".** Connect and disconnect do not write `OrgChannel`: a social
  account is not a place a product is listed (ADR-0068 D3).

## Packages
None.

## UI approach
Cites ux.md; reuses channel-connectors' composites.
- **Per form factor:** the Instagram card is a `MarketplaceCard`-shaped card renamed `ConnectionCard`
  (both kinds), one column on phone, two at `md:`, three at `lg:`, as today.
- **Rendering:** the Channels page stays a server component reading `channels.dal.ts`; the card DTO
  gains `handle` and `accountType`. Client leaves unchanged: `MarketplaceCardActions` (renamed
  `ConnectionCardActions`), `DisconnectDialog`, `ConnectResultNote`.
- **Behaviour:** Connect is a link to the connect route; disconnect and Check now through
  `channelsApiClient` and `useMutation`, as today.
- **Surfaces:** copy in `channel-copy.ts` (`PLANNED_CHANNEL_COPY.instagram` removed); the
  professional-account steps are an `ExpandableLine` in the note. No new token.

## Gates touched
- `route-reachability` — the callback, deauthorize and data-deletion routes in `EXTERNALLY_CALLED` (Meta).
- `rate-limiting` registry — deauthorize and data-deletion classified (signed, Meta-only: exempt with reason).
- `request-body-parsing` — both callbacks parse a form body with Zod.
- `one-repository` — `DataDeletionRequest` written only by its repository in `channels`.
- `module-boundaries` — none new; `channels` already public.

## Data model [MIGRATION]
`ChannelConnection` gains `accountHandle` and `accountType` (nullable text). `refreshToken` stays
null for Instagram. New `DataDeletionRequest`: id, confirmation code (unique), channel, hashed
platform user id, received at, completed at. No cascade from anything.

## API / contract changes [CONTRACT]
`ChannelCardDTO` gains `handle`, `accountType`; `CONNECT_RESULT` gains `personal_account`;
`CHANNEL` gains `instagram`, `CHANNEL_KIND` gains `social`. CONTRACTS.md "Channel connections" moves
in the same change.

## Test plan
- Unit: Instagram's consent URL and scopes; exchange then long-lived exchange parsed; personal
  account refused; renewal due at 7 days, not at 6; code 190 sets NEEDS_RECONNECT; signed request
  verified, tampered and wrong-secret refused; every new outcome maps to ux.md copy.
- Integration: other shop's account refused; different account on reconnect refused; two concurrent
  renewals leave one token; deauthorize turns the card; data deletion nulls fields, writes the row,
  answers a code whose page shows it; Amazon and Flipkart connect unchanged after D2. `fetch` stubbed.
- Manual (A10, Q12): owner's professional account on dev at 360px, every reachable ux.md state.

## Delivery (units)
1. `ConnectionProvider` extracted; `CHANNEL.INSTAGRAM` and `social` kind; ADR-0068 — no behaviour change.
2. Instagram provider, connect and callback; migration for the two display fields — behaviour-changing.
3. Card, outcome notes, disconnect wording, Meta catalogue rename.
4. Renewal and check in `channels.maintain`, `channels.needs-reconnect`; dashboard banner counts Instagram.
5. Deauthorize and data-deletion callbacks, `DataDeletionRequest`, status page, `channels.person-deleted`.

## Open questions
None.
