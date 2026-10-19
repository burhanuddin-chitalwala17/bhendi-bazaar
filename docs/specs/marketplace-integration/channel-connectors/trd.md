# TRD — channel-connectors

- **Status:** Draft
- **Domain:** channels (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-15
- **References:** [spec.md](spec.md), the 2026-10-15 connector spike ([INTEGRATIONS.md](../../../INTEGRATIONS.md#connecting-a-seller-what-the-two-apis-actually-do)), [channel-registry trd](../../channel-registry/trd.md), [ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [ADR-0036](../../../adr/0036-a-files-reasons-to-change-are-a-decision.md), [ADR-0037](../../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0041](../../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> **Revision pending (2026-10-20):** the spec was re-cut under ADR-0061. Listing import and matching
> (D9, D10, the linked-listings UI and delivery unit 5) moved to channel-import; the admin view moved
> to Later. This TRD is rewritten against ux.md once the owner signs it off.

## Approach
A new `channels` domain owns everything that talks to a marketplace on a shop's behalf: the
connection and its credentials, a provider per marketplace behind one small interface, and the
record of which listing there is which product here. `listing` keeps the vocabulary and readiness;
it does not learn about tokens. This spec builds the interface's first four verbs — consent URL,
code exchange, renewal, list listings — and the two later specs add their verbs to the same seam.
OAuth runs in two route handlers; renewal and listing import run on the worker.

## Prior art
- **Authorisation** follows each platform's documented authorization-code flow (RFC 6749 §4.1) with
  `state` bound to the user's session against CSRF (§10.12), as both docs prescribe.
- **Credential storage**: Amazon's data-protection guidance asks for AES-256 and describes envelope
  encryption under a KMS. Nango, which brokers OAuth for many SaaS apps, encrypts tokens with one
  app-level AES-256-GCM key and serialises refreshes per connection. We follow Nango, not the KMS:
  no cloud key service is in our stack (ADR-0037), and versioned keys give rotation (D3). The
  existing helper in `server/shipping/utils/encryption.ts` has no key version and a fixed-salt
  fallback; it is wrong for this, and D3 fixes it rather than copying it.
- **Linking existing listings by SKU before creating anything** is what Unicommerce, EasyEcom and
  Shopify Marketplace Connect do: auto-match on exact SKU, show unmatched, let the seller decide.

## Technical decisions
- **D1 — New domain `server/channels/`.** Public surface: `channel-connection.service`,
  `channel-listing.service` and their `.types`. Providers live in `providers/flipkart/` and
  `providers/amazon/`, each implementing one `MarketplaceProvider` interface with only the verbs
  this spec needs. Plain `fetch`; no SDK (the official SDKs are large and we call six endpoints).
- **D2 — One connection row per (org, channel), retired, not deleted:** disconnect nulls the
  credentials and keeps who connected when. States `CONNECTED`, `NEEDS_REAUTH`, `DISCONNECTED`.
- **D3 — Encryption moves to `server/shared/crypto` and gains a key version.** Ciphertext is
  prefixed `v<n>:`; keys come from `CREDENTIAL_KEYS` (version → 32-byte hex) and the current version
  from `CREDENTIAL_KEY_CURRENT`. Unprefixed values are decrypted by the old derivation so shipping's
  stored token keeps working. Rotation is a worker job re-encrypting every row under the current key.
  A missing or malformed key fails at first use, never silently falls back.
- **D4 — `state` is a signed, ten-minute token**, made like the rate quote
  (`server/shipping/rate-quote.service.ts`): HMAC with a purpose-bound key derived from
  `NEXTAUTH_SECRET`, carrying org, user, channel and a nonce. The callback requires a session whose
  user equals the token's and who is still a member of the org. A replayed code fails at the marketplace,
  which spends it once; no state table is needed (hazard 4).
- **D5 — Routes.** `GET /api/org/[orgId]/channels/[channel]/connect` (`withOrg`, any member) answers a
  302 to the consent page. `GET /api/channels/[channel]/callback` is the URL registered with both
  marketplaces; it resolves the org from `state` alone, exchanges the code in the request (Amazon's
  lives five minutes), and redirects to the settings page with an outcome. `DELETE
  /api/org/[orgId]/channels/[channel]/connection` disconnects. Amazon's consent URL carries
  `version=beta` while `AMAZON_SPAPI_DRAFT` is set; registered redirect hosts come from `appUrl()`.
- **D6 — Renewal is lazy and serialised.** Any call first takes the connection row `FOR UPDATE` in a
  transaction, renews if the access token has under five minutes left, and writes access token,
  refresh token and expiries in that one update (hazard 1). `invalid_grant` or a 401 on renewal sets
  `NEEDS_REAUTH` with the reason and is not retried.
- **D7 — A daily maintenance schedule** (`channels.maintain`, one of the two free slots) renews
  Flipkart connections within 30 days of the refresh token's end, so a quiet shop never lapses
  (hazard 3), and marks Amazon connections within 30 days of their yearly date for the warning (R5).
- **D8 — Identity.** Amazon's `selling_partner_id` is stored as `externalAccountId`, unique per
  channel among connected rows, so a second shop is refused in the callback (R3). Flipkart returns
  none, so its account is recognised by its listings: the first import that finds an FSN and SKU
  already linked to another shop's connection stops, marks this connection `NEEDS_REAUTH` with the
  reason, and deletes its credentials (hazard 2).
- **D9 — Listing import is a worker job** enqueued in the connect transaction and on "re-read".
  It pages Flipkart `POST /listings/v3/search` and Amazon `searchListingsItems` for marketplace
  `A21TJRUUN4KGV`, upserting one `ChannelListing` per (connection, SKU); it is idempotent, so
  at-least-once delivery is harmless. 429s back off through `server/shared/retry.ts`.
- **D10 — Matching.** A listing auto-matches the org's product whose SKU equals it after trimming and
  ignoring case, marked `SKU` and unconfirmed. No SKU, several candidates, or several listings
  for one product leave it under "needs a decision" (hazard 5). A confirmed or manual match is
  never overwritten by a re-read.
- **D11 — Connected is selling.** Connect and disconnect set listing's `OrgChannel` through
  `orgChannelService` in the same transaction, so the feeds and readiness keep reading one answer.
  Google and Meta "connect" by that write alone. `where-you-sell.tsx` and its card on the listing
  page are removed (R8). Each change is audited by `recordAdminActionIn`, credentials never in it.

## Packages
None.

## UI approach
- **A new Channels page** in the shop menu, `/org/[orgId]/channels`. **Phone first:** a card per channel — name, state chip,
  connected-by and date, the Amazon renewal date — with one primary action: Connect, Reconnect, or
  a Disconnect behind `FormDialog` confirmation. Buttons are never disabled; the Amazon cap (R12)
  answers on tap. `md:` and `lg:` place cards two and three across.
- **Linked listings** page per connection: three tabs, a row per listing with the product picker in
  a picker overlay (ADR-0040). Server-rendered list; the row's actions are the client leaf, through
  `channelsApiClient` and `useMutation`. Props are DTOs only.

## Gates touched
- `module-boundaries` — `channels` declared in `PUBLIC_SURFACE`; `shared/crypto` replaces the import
  of shipping's helper.
- `docs-integrity` — the new domain's own CLAUDE.md in `LIVING_DOCS`; the root CLAUDE.md domain table.
- `route-reachability` — the callback in `EXTERNALLY_CALLED` (the marketplaces' redirect).
- `portal-boundary` — the `/api/org/**` routes use `withOrg`.
- `one-repository` — `ChannelConnection` and `ChannelListing` each written by one repository.
- `file-cohesion` — the import service reaches catalog (product by SKU) and listing; within two.

## Data model [MIGRATION]
- `ChannelConnection`: org, channel, state, external account id, encrypted access and refresh
  tokens, their expiries, authorised-at, connected-by user, last renewal, last error and when.
  Unique (org, channel); unique (channel, external account id) where connected.
- `ChannelListing`: connection, channel SKU, external id (FSN or ASIN), external status, product
  (nullable), how matched, confirmed-at, last seen. Unique (connection, channel SKU).

## API / contract changes [CONTRACT]
`ChannelConnectionDTO` and `ChannelListingDTO`; the connect, callback, disconnect, re-read and
match routes. CONTRACTS.md gains a "Channel connections" section in the same change.

## Test plan
- Unit: state token tampered, expired, other user; versioned and legacy decryption; each provider's
  token and listings responses parsed; renewal keeps the new refresh token; `invalid_grant` sets
  `NEEDS_REAUTH`; matcher on case, spaces, no SKU, duplicates.
- Integration: forged state connects nothing; a second shop with the same Amazon seller refused;
  disconnect nulls credentials and turns the channel off; import twice yields one row per SKU;
  a confirmed match survives a re-read. Marketplace HTTP stubbed at `fetch`.
- Manual (A7): both connections on the owner's own accounts, before any other shop.

## Delivery (PRs)
1. `shared/crypto` with versions; shipping moved onto it — no behaviour change.
2. Schema, domain, connection repository and service, state token — no route yet.
3. Flipkart connect, callback, renewal, disconnect, settings card — behaviour-changing.
4. Amazon the same, plus the draft flag and the cap message — behaviour-changing.
5. Listing import, matching, linked-listings page — behaviour-changing.
6. Maintenance schedule, admin view, rotation job.

## Open questions
None. Closed 2026-10-15 by the owner: credentials in `FLIPKART_APP_ID`/`_SECRET`, `AMAZON_APP_ID`/`_SECRET`
(the Login with Amazon client) and `AMAZON_SOLUTION_ID` (the consent URL's app id); one shop per account
(R3, D8); any member connects, no roles being in use; the Amazon renewal warning is in the app only.
