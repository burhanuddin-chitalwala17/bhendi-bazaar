# TRD — readiness-fix

- **Status:** Implemented
- **Domain:** listing (readiness, the answer command), with catalog (the write) and channels (a marketplace's word)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-03
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), [channel-registry trd](../trd.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Readiness already computes, per product and channel, the problems that keep it off. The card's
summary now keeps what it used to throw away: each compulsory fact missing, with its count, and the
products with no category there. The fix page asks readiness which products miss one fact, and an
answer is written through catalog's existing conditional fact write, one product at a time.

## Prior art
None — no new model. Akeneo's completeness lists missing attributes per channel and links each to
its field; we follow it, adding the one thing a phone needs: answering the same field across products
on one screen.

## Technical decisions
- **D1 — Gaps come from the verdicts already computed.** `summaryForOrg` counts `missingFact` per fact
  and `noCategory` per channel while it tallies, so the card costs no second pass; `fixable` is a
  choice fact (Q8). `missingFact(org, channel, fact)` filters the same verdicts for the page.
- **D2 — The write is conditional and closed.** An answer must be one of the fact's offered values
  for the shop, or it is refused; it is written by `setMarketplaceAnswer` with `onlyIfEmpty`, which
  locks the row, so an answer typed meanwhile is never replaced and is reported as skipped (Q5).
  Undo clears only while the stored answer is still the one given. The origin is the shop's (`product`).
- **D3 — A marketplace's word is read from stored reads only** (`channelFactsService.saidFor`): the
  mapped attribute's first value, shown and never written (Q6, parent Q42). No marketplace call.

## Packages
None.

## UI approach
Cites ux.md. The card stays a server component, with `AskAdminPicker` as its one client leaf. The fix
page is a server page reading `readinessFixDAL`; one client leaf holds rows, ticks and Done through
`useReadinessFix` and `readinessFixApiClient`. Phone: one column, fixed bulk bar above the tab bar;
`md:` two columns; `lg:` larger photos. Primitives only.

## Gates touched
- `file-cohesion` — `readiness-fix.dal.ts` reads catalog, channels and listing; recorded with its reason.
- `route-reachability`, `portal-boundary` — `PUT /api/org/[orgId]/products/facts` through `withOrg`.

## Data model
None.

## API / contract changes [CONTRACT]
`ChannelSummaryRow` gains `noCategory` and `gaps`; `FixPageDTO`, `FixAnswerResultDTO`; the route above.

## Test plan
Integration `readiness-fix.test.ts`: the card names the gap and the page lists the products; a bulk
answer sets only empty ones; an answer not offered is refused; undo only while unchanged.

## Delivery (units)
1. Gaps on the card, the fix page, the answer and undo (this change).

## Open questions
None.
