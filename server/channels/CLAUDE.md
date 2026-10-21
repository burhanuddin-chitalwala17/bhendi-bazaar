# CLAUDE.md — channels domain

- **Verified:** 2026-10-21
- **Covers:** `server/channels/**`

> **Read the project-wide rules first:** [`/CLAUDE.md`](../../CLAUDE.md). This file covers **channels** only. Requirements are in [docs/specs/marketplace-integration/](../../docs/specs/marketplace-integration/); every decision, with who made it, is in each spec's `decisions.md`.

## Purpose
Channels owns a shop's authorised connection to a marketplace: the consent round trip, the encrypted tokens, their renewal, and a daily health check. Later subfeatures of marketplace-integration (import, merge, listings, stock sync, publish) act on a marketplace through this domain and never hold a credential themselves.

## Boundaries

**Owns:** `server/channels/**`, the `ChannelConnection` table and the `ChannelListing` table (a read-only mirror of each marketplace listing, plus its link to a product).

**Does not own:** where a shop says it sells (`listing`'s `OrgChannel`, written through `orgChannelService.setIn` in the same transaction as a connect or disconnect), the channel vocabulary (`server/shared/channels.ts`), or the encryption itself (`server/shared/crypto.ts`).

## Rules

- **A token never leaves this domain.** The public surface is `channel-connection.service`, `channel-import.service` and their `.types`; they answer cards, listings and outcomes. A later subfeature adds a verb to `MarketplaceProvider` and calls it here, through `accessToken()`, rather than asking for a token.
- **Every marketplace goes behind `MarketplaceProvider`.** No marketplace-specific branching outside `providers/<name>/`. A fact about one marketplace's app (Amazon's unlisted cap and `version=beta`) lives in its provider, not in a flag.
- **Renewal is serialised by a row lock.** Anything that renews or re-seals tokens takes `lockSecrets` inside a transaction and writes both tokens and expiries in one update. Flipkart replaces its refresh token near expiry; a second, unlocked renewal would keep the old one and disconnect the shop silently.
- **Marketplace text never reaches a person or a log.** Failures become `MarketplaceAuthError` (the seller must reconnect) or `MarketplaceUnavailableError` (try later), and outcomes are `CONNECT_RESULT` / `CONNECTION_ERROR` codes the UI maps to ux.md's copy. Response bodies are never logged: a token can appear in them.
- **One switch.** `CHANNELS_CONNECT` (`channel-availability.ts`) lists the marketplaces open to connect, and is read nowhere else.
- **A read never deletes a listing and never undoes the owner.** Rows are keyed on (connection, SKU) so a retried read writes the same ones; only a finished read marks the unseen gone; a link is written only to a row with no product and no owner's unlink.
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
| `listing-match.ts` | Which listing links to which product by SKU; pure |
| `listing-read.job.ts` | The read job's spec, enqueued on connect and by Read again; its handler is in `channels.jobs.ts` |
| `providers/` | `MarketplaceProvider`, one folder per marketplace (`*.listings.ts` reads its listings), and `listing-read.ts`'s shared sink, retry and paise helpers |
