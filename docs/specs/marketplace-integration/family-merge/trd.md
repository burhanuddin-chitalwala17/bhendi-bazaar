# TRD — family-merge

- **Status:** Implemented
- **Domain:** channels, with catalog (products) and listing (families, mappings)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-29
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), [product-merge trd](../product-merge/trd.md), [marketplace-facts trd](../marketplace-facts/trd.md), [variants trd](../../listing-vocabulary/variants/trd.md), [ADR-0043](../../../adr/0043-a-variant-is-a-product-in-a-family.md), [ADR-0051](../../../adr/0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Screens, states and copy are ux.md's.

## Approach
A family is settled the way one listing is (product-merge), widened to a group: one page reads every
member live, one pure plan decides the family's axes, its shared facts and each member's values, and
one transaction makes the family and every member or nothing. Nothing new is invented for families:
the family table, its per-family axes and the fill levels exist (variants); the read, the fact plan
and the conditional writes exist (marketplace-facts). This feature joins them and adds the group's
entry points on the Listings page.

## Prior art
- **Amazon variation families and Google's `item_group_id`:** a parent that is never sold, children
  unique per combination of declared attributes (colour, size, material, pattern). We follow it: the
  family has no stock (ADR-0043 D4) and members are refused when two share a combination (Q8).
- **Shopify options:** variants are the combinations of the options on which they differ, up to
  three. We follow the "options are what differs" rule (Q16), within our type's questions and the
  type rule's limit of six.
- **Catalogue tools grouping SKUs into a style** (Unicommerce, EasyEcom) ask the seller to confirm a
  group. We follow it for Flipkart, which gives no parent (Q5); never automatic.

## Technical decisions
- **D1 — One pure planner, `family-plan.ts`** beside `fact-fill.ts`. In: each member's stored or live
  read, the mapping, the type, our lists, and any existing members' facts. Out: the axes (the type's
  axes plus every other asked fact or measurement on which the members' planned values differ, Q16);
  each member's axis values, or a question when one is unknown (Q18); the shared facts (every
  non-axis fact on which all members' planned answers agree, Q7); duplicates (two members with one
  combination, Q8). It reuses `planFill` per member, so matching is marketplace-facts D5 exactly.
- **D2 — The page reads live, paced.** `channelFamilyService.page` takes listing ids, checks they are
  this shop's, on one connection (Q23), not left off, at most 30 (Q19), and reads each with the
  provider's `listingAttributes` and `listingDetail` at the provider's pace; Amazon's parent is read
  for the family's name and description (Q2, Q10), falling back to the first member's. A failed read
  keeps that member on its stored read and says so. Reads are stored on the listing (marketplace-facts D6).
- **D3 — The save is one transaction.** Order: lock the listings (`lockUnsettled`, extended to accept
  rows already linked to the products named, product-merge D4); re-plan on the server from the
  stored reads (never from the browser, marketplace-facts Q35); refuse on duplicates, unanswered
  axes, a missing type (Q17) or a taken SKU; create or reuse the family (Q20); create each new
  member (`createForListingIn`, with `familyId`), join each existing product (a conditional
  `setFamilyIn` where `familyId` is null, or the family the owner chose to move it from, Q11); link
  each listing; write facts; enqueue each member's photo copy and fill job. A short count anywhere
  rolls everything back and names what changed meanwhile.
- **D4 — Facts land where they belong.** Shared facts go on the family once, marked from the
  marketplace (ADR-0051 origin and `source`); each member stores them with origin `family` so its
  record is complete on read (filled on save, never on read); axis values and differing facts go on
  the member, marked from the marketplace. A member that already exists keeps its own answers.
- **D5 — Main photos before the transaction.** Each new member needs its main photo (product-merge
  Q29); they are copied in parallel, four at a time, before the transaction opens. One that fails
  refuses the save, naming the member, and nothing is written. The other photos are queued per member.
- **D6 — Entry points on the Listings page.** `ChannelListingsPageDTO` gains one entry per group
  (Amazon `parentSku`): its state (none settled, some, all as separate products, a family, a family
  with some outside it) and its member ids, so each header's one action is known (ux.md). The Settle
  page of a group's member says it is one of a group (Q22). Flipkart suggestions group unsettled
  listings on one connection by title similarity (`nameSimilarity`) and a shared SKU stem; a
  dismissed suggestion is stored on its listings (Q21). Picking by hand needs no storage.
- **D7 — The family page route** is `/org/[orgId]/channels/family?listings=…` for every case: a group,
  a pick, a group with an existing family (the server finds and reuses it). One server component
  reads through `channelFamilyDAL`; the form is one client leaf.

## Packages
None.

## UI approach
Cites ux.md. Phone first: one column of member cards, each with its axis values, SKU, price and stock;
from `md:` two columns of cards, from `lg:` three. Two axes group the cards by the first, each group
collapsing (ux.md "Many members"). The form uses `useServerForm` with the family schema; answers to
member and shared questions are chips, more in `ResponsivePicker` (ADR-0040). The Listings page's group
header action and the Flipkart pick bar are client leaves through `channelsApiClient`. The pick bar
sits at `bottom-tabbar` on a phone. No new token, no new sheet.

## Gates touched
- `one-repository` — families through `productFamilyRepository` (gains `createIn(tx)`), products and
  their family link through catalog's repository (gains `setFamilyIn`), listings through theirs.
- `module-boundaries`, `file-cohesion` — `channel-family.service` reaches catalog and listing only.
- `route-reachability`, `portal-boundary` — the save and the dismiss routes through `withOrg`, called
  from `channelsApiClient`.
- `product-visibility` — any new product read is classified in the census.

## Data model [MIGRATION]
`ChannelListing.familyHintDismissedAt` (Q21). Nothing else: `ProductFamily.variantAxis`, `facts` and
`Product.familyId` exist. Nothing is dropped.

## API / contract changes [CONTRACT]
New `FamilyPageDTO` (family name and description, category choice, axes, shared facts and questions,
members with values, questions, SKU, price, stock, read state), `FamilySettleInput` (listing ids, family
id when adding, name, description, category, per member: SKU, price, stock, answers, include, move),
`ChannelListingsPageDTO.groups`. Routes: `POST /api/org/[orgId]/channels/family`, `POST
…/listings/dismiss-group`. CONTRACTS.md moves with them.

## Test plan
- Unit: the planner — colour only; colour and length (Q16); shared versus differing facts; a duplicate
  combination; an unknown value; an existing member's answers kept; no type. The Flipkart suggestion
  — title and SKU stem, a dismissed one hidden.
- Integration: a group saves as one family and four products or nothing (a failure on the last member
  rolls back the first); two saves of one group make one family; a member in another family is moved
  only when asked; a taken SKU and a duplicate are refused by name; adding to an existing family;
  facts on the family once and on members with origin `family`; the browser's values are ignored.
- Component: the family form sends answers, include and move; the 30 cap; a two-axis grouping.
- Manual: the owner's own Amazon groups at 360px, every ux.md state.

## Delivery (units)
1. The planner (D1) with its unit tests. No behaviour change.
2. The page read and DTO (D2, D7), and the page's ready, loading, unreadable and refused states.
3. The save (D3–D5), routes and the form; families made from Amazon groups and from settled products.
4. The Listings entry points (D6): group states, the first-group line, the Settle-page link, Add to
   family.
5. Flipkart: suggestions, Not one item [MIGRATION], picking by hand.

## Open questions
None.
