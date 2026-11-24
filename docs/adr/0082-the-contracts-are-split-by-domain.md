# ADR-0082: The contracts are split by domain

- **Date:** 2026-11-24
- **Status:** Accepted

## Context

`docs/CONTRACTS.md` had grown to 104 KB, about 26k tokens, and every change crossing a domain boundary is checked
against it. A session changing one cart field read the channels, storefront and AI-image shapes with it. More than
fifty files link to `CONTRACTS.md`, ADRs among them, and ADRs are immutable.

## Decision

1. `docs/CONTRACTS.md` keeps what every domain shares — purpose, rules, the error envelope, pagination — and an index
   of the per-domain files. Every existing link to it stays valid.
2. Each domain's shapes live in `docs/contracts/<domain>.md` (catalog's storefront shapes in `storefront.md`), each a
   living doc with `Verified:` and `Covers:` its domain's `*.types.ts`.
3. A DTO change updates its domain's file. The Stop hook accepts a change to either place; the commit-msg check asks
   for `[CONTRACT]` when a wire type and a contracts doc change together, not for a doc edit alone.

## Alternatives

- **Leave it whole and read it by section.** Rejected: nothing makes a session read one section, and a heading
  search still loads the file to find it.
- **Move every section and repoint every link.** Rejected: fifty edits, ADRs included, for a link the index already
  satisfies.

## Consequences

- ✅ A contract check reads the 7 KB rules file and one domain file — 1–30 KB instead of 104 KB.
- ✅ No existing link breaks.
- ⚠️ A shape spanning two domains needs a home chosen; it goes in the domain that owns its declaration.
