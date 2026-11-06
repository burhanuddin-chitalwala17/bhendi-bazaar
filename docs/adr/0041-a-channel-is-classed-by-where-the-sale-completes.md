# ADR-0041: A channel is classed by where the sale completes

- **Date:** 2026-09-29
- **Status:** Accepted (D2 amended by [ADR-0068](0068-meta-is-a-connected-shopfront.md))

## Context

Phase 11 sells one product in many places: our own storefront, Google Shopping, Meta, Amazon,
Flipkart, Meesho, and later Myntra, Ajio and Nykaa. The obvious shape is one `Channel`
abstraction with an adapter each, and `CHANNEL` in [`server/shared/channels.ts`](../../server/shared/channels.ts)
already reads that way.

Researching them (2026-09-29, recorded in [INTEGRATIONS.md](../INTEGRATIONS.md)) showed they are
not one kind of thing. Google and Meta never hold an order: both fetch a feed file we host, a
buyer clicks through, and the sale completes on Bhendi Bazaar. Meta's onsite checkout is
US/CA/MX only, so in India it is a catalogue sink and nothing comes back. Amazon and Flipkart are
the opposite — the listing lives there, the money is taken there, and their stock and ours are
two numbers about one physical garment.

A single abstraction would give the first group an adapter, per-seller credentials, an order
reader and a stock reconciler it has no use for, and would make the second group's hardest
problem — two numbers disagreeing — look like a configuration flag.

## Decision

1. **A channel declares its kind, and the kind decides what machinery it gets.** Three kinds:
   **storefront** (us), **shopfront** (published to, sale completes here), **marketplace**
   (listing and sale both live there).
2. **A shopfront channel gets a feed and nothing else.** No credentials, no order reader, no
   stock reconciliation, because no stock ever diverges: the buyer lands on our checkout and
   [Invariant 6](../../CLAUDE.md) already holds. One artefact serves Google and Meta together,
   because Meta accepts feeds in Google's own RSS namespace.
3. **A marketplace channel gets the full set** — per-seller authorisation, listing push, order
   ingestion, stock reconciliation — and nothing may assume it is optional for that kind.
4. **The kind is a property of the channel, not of the seller or the product.** A seller cannot
   turn Amazon into a shopfront by not connecting it; an unconnected marketplace is a
   marketplace that is off.
5. **Network participation is a fourth kind, declared and unimplemented.** ONDC is not published
   to: one joins the network as a seller participant speaking Beckn, or lists through one that
   has. Naming it keeps it from being forced into the marketplace shape when it arrives.

## Alternatives considered

- **One uniform `Channel` with optional capabilities.** The conventional answer, and what the
  backlog row implied. Rejected because "optional" is where the cost hides: every order reader,
  token refresh and reconciliation path acquires a null check for channels that will never have
  one, and the compiler stops being able to tell you which combinations are real. The kinds are
  genuinely different shapes, not one shape with holes in it.
- **Only model marketplaces, and treat Google and Meta as an export feature.** Tempting, since
  they need so little. Rejected because a seller does not experience them as a different
  feature: they pick where to sell from one list, and readiness, mapping and per-channel prices
  apply to all of them. Splitting the vocabulary would mean two answers to "where is this
  listed?".
- **Class by whether the channel has an API.** Rejected as the wrong axis. Meesho has no public
  API and is unambiguously a marketplace; Google has a thorough one and never holds an order.
  What the integration costs is a fact about this year, and what it *means* is not.
- **Wait and see which kinds emerge.** Rejected because the first two phases would then be built
  against a uniform abstraction and retro-fitted, which is the more expensive order.

## Consequences

- ✅ The cheap half ships first and needs approval from nobody, so a seller sees their goods
  published before any partner conversation concludes.
- ✅ A marketplace adapter cannot silently skip order ingestion, because its kind requires it.
- ✅ The oversell problem is confined to one kind, where it can be reasoned about, rather than
  being a property of "channels" in general.
- ⚠️ Three shapes to hold in mind instead of one, and a reviewer must know which kind they are
  looking at before judging whether something is missing.
- ⚠️ A channel that changes kind — if Meta ever opens onsite checkout in India — is a migration,
  not a setting. That is the honest cost of encoding the distinction, and the alternative is
  encoding nothing.
