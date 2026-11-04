# TRD — channel-listings

- **Status:** Implemented
- **Domain:** channels, with catalog (the product's new fields)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-02
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), [marketplace-publish trd](../marketplace-publish/trd.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md) "Editing and creating a listing", [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0043](../../../adr/0043-a-family-groups-products-and-each-member-sells-on-its-own.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
`ChannelListing` stays what it is: the mirror of what a marketplace has. A new `PlatformListing` is
ours: one per product per connection, holding only the fields the shop changed for that marketplace
and a snapshot of what was last sent. What a marketplace gets is computed, never stored: the product,
with the listing's own values laid over it. "Changes waiting" is that computed listing against the
snapshot, over the fields the marketplace lets us write.

## Prior art
- **PIMs and channel managers** (Akeneo channel-scoped values, Linnworks' SKU > template > channel
  listing order, StoreAutomator's channel products) keep a master and per-channel values that win
  when present. We follow it, with one difference the research found missing everywhere: each field
  says which it is (Q8).
- **Localisation fallbacks** (Contentful, Storyblok): an absent value inherits; the inherited value
  is shown beside an override. We follow it.
- **Keeping mirror and intent apart** is the reconciliation pattern Kubernetes and Terraform use:
  observed state, desired state, and the last applied state, diffed. The mirror is observed,
  `PlatformListing` desired, its snapshot last applied. Merging them into one row, as channel-import's
  `pricePaise` does today, is why Q19's per-platform price could never be built; that column stays the
  mirror and is not repurposed.

## Technical decisions
- **D1 — `PlatformListing` is its own aggregate** in channels with one repository: (connection,
  product) unique, the mirror's id when one exists, `overrides` (only the keys changed), `sent`
  (the fields as last sent), a `version` for compare-and-set saves, and marketplace-publish's state.
  A row exists for a draft with no mirror yet, which a listing read must never mark gone.
- **D2 — Six fields, one closed set** (`LISTING_FIELD`: title, price, photos, features, description,
  listed), parsed by one Zod schema shared by the route and the form. Strict fields are not in the
  set, so a request cannot carry one (parent Q28). Price is paise (Invariant 3).
- **D3 — A row is made with what is live** (Q2). The first time a linked listing is opened, or the
  daily maintain pass or a finished read finds a linked listing with no row, the row is made in one
  statement that does nothing if it exists: each field the mirror knows and that differs from the
  product becomes an override with the mirror's value, and `sent` is the computed listing. So the
  first look has nothing waiting, and a later product change shows as waiting (R10).
- **D4 — Saves compare and set** on `version`; a stale save is refused with the conflict copy, and
  the mirror's read never touches `PlatformListing`, so reads and edits cannot overwrite each other.
- **D5 — What differs is always visible.** The screen's DTO carries, per field: the computed value,
  whether it is an override, the product's value, the marketplace's (from the mirror and its stored
  attributes) and whether the marketplace takes it. An override is never hidden.
- **D6 — Each marketplace declares what it takes** in its provider: writable fields, length limits,
  whole rupees, photo rules, whether it can create. The UI renders from that; no branching on a
  marketplace's name outside `providers/` (channels rule).
- **D7 — The product gains `keyFeatures` (up to five) and `barcode`**, and the form asks MRP, which
  until now only a marketplace fill could set; create and update whitelist all three (Invariant 4).
  The master's selling price is `Product.price`; a shop sale price is a store promotion and is not sent.
- **D8 — Photos are the product's photo addresses** in the shop's order; the screen shows the
  product's photos to choose from. A deleted photo drops out of every override when the listing is
  computed. Addresses, not media ids: a product save renews its media rows, so an id-kept listing
  read as changed after every save (fixed 2026-11-03; stored ids are read as addresses).

## Packages
None.

## UI approach
Cites ux.md. The listing screen is a server page reading `channelListingsDAL`; one client leaf holds
the form (`useServerForm` on D2's schema) and its actions through `channelsApiClient`. Phone: one
column, a fixed Save bar; `md:` the locked group moves to a side column; `lg:` the product's value
sits beside each field. Locked fields open a `ResponsivePicker`-style sheet per ADR-0040. The On
marketplaces block gains its chip and link. Tokens only; no new token.

## Gates touched
- `one-repository` — `PlatformListing` has one repository; product fields go through catalog's.
- `module-boundaries` — channels reaches catalog's product read only through its service.
- `route-reachability`, `portal-boundary` — the listing page and its routes, through `withOrg`.
- `product-visibility` — the master read (archived included) is classified.

## Data model [MIGRATION]
`PlatformListing` as D1; `Product.keyFeatures String[]`, `Product.barcode String?`. Nothing dropped.

## API / contract changes [CONTRACT]
The listing screen DTO and the save body. `GET` through the DAL; `PUT /api/org/[orgId]/products/[id]/listings/[channel]`.

## Test plan
- Unit: computing a listing and its waiting changes (inherit, override, removed photo, not writable).
- Integration: the first open seeds what is live and shows nothing waiting (A4); a product change shows
  waiting (A6); a stale save is refused; a strict field in the body is rejected; "Use product's".
- Manual at 360px: every ux.md state.

## Delivery (units)
1. Data model, the product's three fields on the form.
2. Computing and seeding (D3, D5, D6), the save and its route.
3. The listing screen and the On marketplaces block.

## Open questions
None.
