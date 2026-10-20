# TRD — channel-connectors

- **Status:** Draft — awaiting the owner's reading
- **Domain:** channels (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-20
- **References:** [spec.md](spec.md), [ux.md](ux.md) (signed off 2026-10-20), [decisions.md](decisions.md), parent [decisions](../decisions.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#connecting-a-seller-what-the-two-apis-actually-do), [ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [ADR-0037](../../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0048](../../../adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's; this says how they are built.

## Approach
A new `channels` domain owns the connection between a shop and a marketplace: the consent round
trip, the encrypted tokens, their renewal and a daily health check. Each marketplace is a provider
behind one small interface whose verbs are only what this subfeature needs: consent URL, code
exchange, renew, identify, check. Later subfeatures add verbs to the same interface and ask the
domain for a valid token; they never see a credential. OAuth runs in two route handlers; renewal
and health checks run on the worker. Nothing here changes anything on a marketplace (Q13).

## Prior art
- **Authorisation** is each platform's documented authorization-code flow (RFC 6749 §4.1), with
  `state` bound to the user's session against forged returns (§10.12), as both docs prescribe.
- **Credential storage**: Amazon's data-protection guidance asks for AES-256; Nango, which brokers
  OAuth for many apps, encrypts tokens with app-level AES-256-GCM and serialises refreshes per
  connection. We follow Nango rather than a cloud key service, which our stack does not have
  (ADR-0037). `server/shipping/utils/encryption.ts` has no key version and a fixed-salt fallback;
  D3 replaces it rather than copying it, and moves shipping onto the replacement.

## Technical decisions
- **D1 — Domain `server/channels/`.** Public surface: `channel-connection.service` and its `.types`.
  Providers in `providers/amazon/` and `providers/flipkart/` implement `MarketplaceProvider`. Plain
  `fetch` with a 10-second timeout; no SDK, for five endpoints. Marketplace response bodies are
  never logged, since a token can appear in them.
- **D2 — One `ChannelConnection` row per (shop, channel)**, stored states `CONNECTED`,
  `NEEDS_RECONNECT`, `DISCONNECTED`. "Renewal due", "unavailable" and "full" are derived on read,
  never stored. Disconnect nulls the tokens and keeps who connected and when (Q4).
- **D3 — `server/shared/crypto`, versioned.** `CREDENTIAL_KEYS` holds `version:64-hex` pairs; the
  highest version encrypts, any listed version decrypts; ciphertext is prefixed `v<n>:`. An
  unprefixed value decrypts by the old shipping derivation, so its stored token keeps working. A
  missing or malformed key throws at first use. Rows under an older version are re-encrypted by
  the daily job (D7), so replacing a key needs nobody to reconnect (R4).
- **D4 — `state` is a signed ten-minute token**, made like the rate quote
  (`server/shipping/rate-quote.service.ts`): HMAC under a key derived from `NEXTAUTH_SECRET` for
  this purpose, carrying shop, user, channel, purpose (connect or reconnect) and a nonce. The
  callback requires the same signed-in user, still a member of the shop. A replayed code fails at
  the marketplace, which spends it once; no state table (R2).
- **D5 — Routes.** `GET /api/org/[orgId]/channels/[channel]/connect` (`withOrg`) answers 302 to the
  consent page, or straight back with an outcome when the channel is unavailable or full.
  `GET /api/channels/[channel]/callback` is the registered redirect: it exchanges the code inside
  the request (Amazon's lives five minutes) and answers 302 to `/org/[orgId]/channels?result=<code>`.
  `DELETE /api/org/[orgId]/channels/[channel]/connection` disconnects; `POST …/connection/check` is
  "Check now". Google and Meta keep the existing `PUT /api/org/[orgId]/channels`.
- **D6 — Outcomes are a closed set** (`CONNECT_RESULT`, compared by constant): connected, cancelled,
  expired, other-session, other-shop, different-account, unreachable, full, unavailable. The page
  maps each to ux.md's copy; no marketplace error text reaches the screen.
- **D7 — A daily schedule, `channels.maintain`** (the third of four slots), per connection: a health
  check (Amazon `getMarketplaceParticipations`, Flipkart's token-expiry endpoint) that sets "last
  checked"; Flipkart renewal when its refresh token has under 30 days left; re-encryption under the
  current key. Suspended shops are skipped (Q11).
- **D8 — Renewal is lazy and serialised.** A caller takes the row `FOR UPDATE` in a transaction,
  renews when the access token has under five minutes left, and writes both tokens and expiries in
  that one update. `invalid_grant` or a 401 on renewal sets `NEEDS_RECONNECT` with a reason code and
  is not retried.
- **D9 — Identity.** Amazon's `selling_partner_id` is stored, unique per channel among connected
  rows: another shop's is refused (R3); on a reconnect, a different one is refused (Q8). Flipkart
  returns none; its check is channel-import's (Q2).
- **D10 — One switch, outside the architecture.** `CHANNELS_CONNECT` lists the marketplaces open to
  connect; one not listed, or without credentials, is unavailable (Q10), read in one place. Amazon's app being
  unlisted is a fact in its provider, not a switch: it adds `version=beta` and the 25-shop cap
  (R10), and changes once, when Amazon lists the app (Q16).
- **D11 — Connected is selling.** Connect and disconnect write listing's `OrgChannel` through
  `orgChannelService` in the same transaction, audited by `recordAdminActionIn` with no credential
  in it. `where-you-sell.tsx` and its section on What you sell are removed (R8).

## Packages
None.

## UI approach
Every layer from src/components/CLAUDE.md, top to bottom:
- **Page:** a new `channels` page under the org portal's routes, a server component reading one DAL call,
  `channels.dal.ts`, which returns `ChannelsOverviewDTO`: one card DTO per channel, derived state
  included. The dashboard page reads `attention` from the same DAL for its banner.
- **Composites,** in `src/components/channel/`: `ChannelCardList` (one column, `md:` two, `lg:` three),
  `MarketplaceCard`, `FeedCard`, `StoreCard` and `ChannelAttentionBanner` render on the server.
  Client leaves only where there is behaviour: `MarketplaceCardActions`, `DisconnectDialog` on the
  shared `FormDialog` (bottom sheet on phone, dialog from `md:`), `FeedToggle`, and `ConnectResultNote`,
  which shows the outcome once and clears `?result=`.
- **Wrappers and primitives:** state chips on `StatusBadge`, buttons and links on `ui/button`,
  skeletons on `LoadingSkeleton`. Connect is a link to the connect route, not a request.
- **Behaviour:** `channelsApiClient` gains `disconnect` and `checkNow`, called through `useMutation`.
  ux.md's strings live in one `channel-copy.ts` beside the composites.
- **Chrome:** "Channels" in `OrgSidebar`, directly under Products (Q5). No new design token.

## Gates touched
- `module-boundaries` — `channels` in `PUBLIC_SURFACE`; shipping imports `shared/crypto`.
- `docs-integrity` — the new domain's CLAUDE.md in `LIVING_DOCS`; the root CLAUDE.md domain table.
- `route-reachability` — the callback in `EXTERNALLY_CALLED`, called by the marketplaces' redirect.
- `portal-boundary` — the three `/api/org/**` routes use `withOrg`.
- `one-repository` — `ChannelConnection` written only by its repository.
- `file-cohesion` — the service reaches listing only; `api-clients`, `ui-primitives`, `overlay-surfaces`, `rendering-strategy`, `design-tokens` met as written.

## Data model [MIGRATION]
`ChannelConnection`: shop, channel, state, external account id, encrypted access and refresh
tokens, their expiries, authorised-at, connected-by and disconnected-by users with times, last
checked, last error code and when. Unique (shop, channel); unique (channel, external account id)
among connected rows. Never cascades from a shop (ADR-0020).

## API / contract changes [CONTRACT]
`ChannelCardDTO`, `ChannelsOverviewDTO`, `CONNECT_RESULT`; the connect, callback, disconnect and check
routes. CONTRACTS.md gains a "Channel connections" section in the same change.

## Test plan
- Unit: state token tampered, expired, other user, other purpose; versioned, legacy and missing-key
  decryption; each provider's token, identity and check responses parsed; renewal keeps the new
  refresh token; `invalid_grant` sets `NEEDS_RECONNECT`; derived states (renewal due, unavailable,
  full) at their boundaries; every `CONNECT_RESULT` maps to ux.md's copy.
- Integration: forged state connects nothing; another shop's Amazon account refused; a different
  account on reconnect refused; disconnect nulls tokens and turns the channel off; two concurrent
  renewals leave one valid refresh token; the daily job skips suspended shops. HTTP stubbed at `fetch`.
- Manual (A8, Q15): Amazon on dev.bhendi-bazaar.com and Flipkart on production, on the owner's
  shop, at 360px, walking every reachable state in ux.md.

## Delivery (units)
1. `shared/crypto` with versions; shipping moved onto it — no behaviour change.
2. Schema and migration; the domain's repository, service, state token, switches — no route.
3. Amazon provider; connect, callback, disconnect, check routes — behaviour-changing.
4. Flipkart provider on the same routes — behaviour-changing.
5. Channels page, sidebar item, feed cards, outcome notes, disconnect dialog; Where you sell removed.
6. Daily `channels.maintain` and the dashboard banner.

## Open questions
None. `CREDENTIAL_KEYS` is set in `.env`; the owner pastes `AMAZON_SOLUTION_ID`.
