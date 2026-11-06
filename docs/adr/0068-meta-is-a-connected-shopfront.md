# ADR-0068: A shop's social accounts are connected channels of their own kind

- **Date:** 2026-11-06
- **Status:** Accepted

## Context

[ADR-0041](0041-a-channel-is-classed-by-where-the-sale-completes.md) classed channels by where the
sale completes, and gave a shopfront "a feed and nothing else — no credentials". That held while
Meta was only a catalogue feed. Social selling ([social-selling](../specs/social-selling/spec.md))
now acts for a shop on its own Instagram and WhatsApp: publishing posts, answering comments and
DMs, keeping a WhatsApp catalogue and sending messages. All of it needs the shop's grant, a token
and webhooks, yet the sale still completes on Bhendi Bazaar, so it is not a marketplace either.

## Decision

1. **A fifth kind, `social`.** A social channel is a shop's own account on a platform where it
   publishes and converses. It holds a per-shop connection (consent, encrypted token, health) and
   receives events; it has no order reader and no stock reconciliation, because the sale completes
   here, as ADR-0041 decision 2 requires of a shopfront.
2. **Instagram and WhatsApp are each their own social channel**, one connection each
   (social-selling Q1). `meta` stays a shopfront: the catalogue feed, needing no account.
3. **A social channel is not where a product is listed.** It is not in readiness, mappings or
   `OrgChannel`; connecting it does not change where a shop sells. A WhatsApp catalogue is made
   from the shop's live products (social-selling Q47), not from per-channel listings.
4. **Credentials for a social channel follow the marketplaces' rules**: they never leave
   `channels`; tools reach a platform through ports `channels` implements (social-selling Q7).
5. ADR-0041 decision 2's "no credentials" is narrowed: it still holds for every shopfront; a
   platform that also needs the shop's grant gets a social channel beside its feed.

## Alternatives considered

- **Make Meta a marketplace.** Rejected: it would oblige an order reader and stock reconciliation
  (ADR-0041 decision 3) for channels where nothing is sold.
- **Give the shopfront kind optional credentials.** The conventional "optional capability" answer,
  rejected in ADR-0041 for the same reason: every feed path gains a null check for a token most
  shopfronts will never have.
- **One `meta` connection covering Instagram and WhatsApp.** Rejected by the owner (social-selling
  Q1): two logins, two tokens, and a shop may want only one.

## Consequences

- ✅ Instagram, WhatsApp and later Threads or a Facebook Page fit one shape: connect, check, act through a port.
- ✅ Shopfront feeds stay credential-free and approval-free.
- ⚠️ Five kinds to hold in mind; a reviewer must know a social channel has no listing.
- ⚠️ "Meta" now names two things on the Channels page; the feed card is retitled "Meta catalogue"
  (connect-instagram Q13) to keep them apart.
