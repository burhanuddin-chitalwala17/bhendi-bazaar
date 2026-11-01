# CLAUDE.md — channels domain

- **Verified:** 2026-11-01
- **Covers:** `server/channels/**`

> **Read the project-wide rules first:** [`/CLAUDE.md`](../../CLAUDE.md). This file covers **channels** only. Requirements are in [docs/specs/marketplace-integration/](../../docs/specs/marketplace-integration/); every decision, with who made it, is in each spec's `decisions.md`.

## Purpose
Channels owns a shop's authorised connection to a marketplace: the consent round trip, the encrypted tokens, their renewal, and a daily health check. Later subfeatures of marketplace-integration (import, merge, listings, stock sync, publish) act on a marketplace through this domain and never hold a credential themselves.

## Boundaries

**Owns:** `server/channels/**`, the `ChannelConnection` and `ChannelListing` tables (a read-only mirror of each marketplace listing, plus its link to a product), and stock sync's `ChannelLocation`, `MarketplaceOrder` and `StockCorrection`.

**Does not own:** where a shop says it sells (`listing`'s `OrgChannel`, written through `orgChannelService.setIn` in the same transaction as a connect or disconnect), the channel vocabulary (`server/shared/channels.ts`), or the encryption itself (`server/shared/crypto.ts`).

## Rules

- **A token never leaves this domain.** The public surface is `channel-connection.service`, `channel-import.service`, `channel-settle.service`, `channel-facts.service`, `channel-family.service`, `channel-location.service`, `channel-stock.service`, `channel-orders.service` and their `.types`; they answer cards, listings, settling and outcomes. A later subfeature adds a verb to `MarketplaceProvider` and calls it here, through `accessToken()`, rather than asking for a token.
- **Every marketplace goes behind `MarketplaceProvider`.** No marketplace-specific branching outside `providers/<name>/`. A fact about one marketplace's app (Amazon's unlisted cap and `version=beta`) lives in its provider, not in a flag.
- **Renewal is serialised by a row lock.** Anything that renews or re-seals tokens takes `lockSecrets` inside a transaction and writes both tokens and expiries in one update. Flipkart replaces its refresh token near expiry; a second, unlocked renewal would keep the old one and disconnect the shop silently.
- **Marketplace text never reaches a person or a log.** Failures become `MarketplaceAuthError` (the seller must reconnect) or `MarketplaceUnavailableError` (try later), and outcomes are `CONNECT_RESULT` / `CONNECTION_ERROR` codes the UI maps to ux.md's copy. Response bodies are never logged: a token can appear in them.
- **One switch.** `CHANNELS_CONNECT` (`channel-availability.ts`) lists the marketplaces open to connect, and is read nowhere else.
- **A settle links every listing or none.** The link is conditional inside the transaction that makes or updates the product; a short count rolls it back. Photo addresses are re-read from the marketplace on the server, never taken from a request.
- **A read never deletes a listing and never undoes the owner.** Rows are keyed on (connection, SKU) so a retried read writes the same ones; only a finished read marks the unseen gone; a link is written only to a row with no product and no owner's unlink.
- **A fill never overwrites.** Filling from a listing writes through catalog's and listing's conditional commands, which lock the row and write only what is still empty; the card is computed from the stored read, never stored as questions (marketplace-facts D6, D7).
- **Stock sync sends what is true when it runs.** A push reads the product's counts under `pg_advisory_xact_lock` and skips counts already sent; never send a delta. An order line is claimed once (unique on connection, order, line) and a restock is claimed by a conditional update. Nothing runs on a short schedule: work that repeats re-enqueues itself only while there is something to do.
- **Never call a live marketplace from a test.** Stub `fetch`.

## Structure

| Path | Holds |
|---|---|
| `channel-connection.service.ts` | The public surface: overview cards, connect, disconnect, check, the daily `maintain` pass |
| `channel-connection.types.ts` | Closed sets and DTOs |
| `channel-connection.repository.ts` | The one writer of `ChannelConnection` |
| `connect-state.ts` | The signed OAuth `state` |
| `channel-availability.ts` | The one switch |
| `channel-import.service.ts` | The listing read the worker runs, Unlink, Link back, the Listings page and a product's links (channel-import) |
| `channel-listing.repository.ts` | The one writer of `ChannelListing` |
| `listing-match.ts` | Which listing links to which product by SKU, how similar two names are, and which unsettled listings look like one item; pure |
| `channel-settle.service.ts` | Settling a listing: the Settle page's live read, adding or matching in one transaction, the photo copy (product-merge) |
| `channel-facts.service.ts`, `channel-facts.types.ts` | Filling a product from its linked listings: the job's read and fill, the product page's cards and their commands, the Settle page's type question (marketplace-facts) |
| `channel-family.service.ts`, `channel-family.types.ts` | One family from several listings: the family page's live read and plan, and the save that makes the family and every member or nothing (family-merge) |
| `family-plan.ts` | A family's axes, each member's values, what all share, and what stops a save; pure |
| `channel-location.service.ts`, `channel-location.repository.ts` | A marketplace's pickup locations, read on connect and Read again, and the shop's match for each (inventory-sync D1) |
| `channel-stock.service.ts`, `channel-stock.types.ts`, `stock-plan.ts` | Sending our counts per matched location under a lock per product, the switch and its preview, the daily check; `stock-plan.ts` is pure |
| `channel-orders.service.ts`, `marketplace-order.repository.ts` | The ten-minute order check, batched across shops (inventory-sync Q26): each line once, stock taken or the line flagged oversold, a cancellation restocked once; the Marketplace orders tab |
| `stock-checks.job.ts` | The order check's and daily check's job specs: the order check enqueues its next run only while a connection has sync on (inventory-sync Q23) |
| `stock-correction.repository.ts` | The one writer of `StockCorrection`, the daily check's record |
| `fact-fill.ts` | Which type a listing is and which facts it fills or asks; pure, the same for every marketplace |
| `listing-facts.job.ts` | The fill job's spec, enqueued by a settle; its handler is in `channels.jobs.ts` |
| `listing-photos.ts`, `listing-photos.job.ts` | Which photo addresses a copy may fetch; the copy job's spec |
| `listing-read.job.ts` | The read job's spec, enqueued on connect and by Read again; its handler is in `channels.jobs.ts` |
| `providers/` | `MarketplaceProvider`, one folder per marketplace (`*.listings.ts` reads its listings, `*.stock.ts` its locations, counts and orders; `stock.ts` the shared shapes), and `listing-read.ts`'s shared sink, retry and paise helpers |
