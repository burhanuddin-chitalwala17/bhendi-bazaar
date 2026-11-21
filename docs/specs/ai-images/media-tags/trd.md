# TRD — ai-images/media-tags

- **Status:** Accepted
- **Domain:** catalog (media)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-21
- **References:** [spec.md](spec.md), [ux.md](ux.md), [../decisions.md](../decisions.md) (Q21, Q22, Q23, Q37), [media-library](../../media-library/), [ADR-0058](../../../adr/0058-media-is-one-aggregate-a-derivative-is-lineage-not-a-use-and-usage-is-derived.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Tags are a column on the one media aggregate, written only by its repository: `MediaAsset.tags`, a
Postgres array of a closed enum. The library's existing `where` builder gains one clause, the DTO
gains the list, one org route toggles a tag, and the Product tag is applied where a gallery write
already links refs to library images.

## Prior art
- **A closed, small tag set is an array column; an open, user-made one is a join table.** Postgres
  arrays with a GIN index are the documented shape for "has any of these few labels" (PostgreSQL
  docs, *Arrays* and *GIN indexes*; Prisma scalar lists support `has` on Postgres). A join table earns
  its keep when tags are rows people create, rename and count — none of which applies to a set the
  platform declares in code (Q21). We follow the field. This **departs from what was said in chat on
  2026-11-21** ("one small table linking an image to a tag"): the array is the established shape for
  a closed set and one fewer table and repository.
- **Our own precedent, ADR-0058, says usage is a query, never a counter.** "In use" stays derived;
  a *tag* is what the shop says an image is for, which is not derivable, so it is stored.

## Technical decisions
- **D1 — `MediaTag` enum (`PRODUCT`, `REFERENCE`) and `MediaAsset.tags MediaTag[]`, default empty,
  GIN-indexed.** The closed set is mirrored once in `server/catalog/media-library.types.ts` as
  `MEDIA_TAG` for the browser (the house pattern, `ENHANCEMENT_TOOL`). `SOCIAL` joins with the
  Instagram composer, not now (YAGNI).
- **D2 — Written only by `media-asset.repository.ts`** (Invariant 5): `addTag(ids, tag, orgId, db)`
  (one `updateMany` pushing the tag where absent, on that org's images only) and `setTag(orgId, id,
  tag, on)` for the shop's toggle on its own photographs that are not retired: a compare-and-set
  against the tags just read, so nothing concurrent is overwritten and `updatedAt` moves.
- **D3 — Product is applied where galleries link images.** `withAssetIds` in
  `server/catalog/product.repository.ts` already resolves every gallery write's refs to asset ids
  through the media repository (form create and update, copied photos); it calls `addTag` there.
  `importBulk` writes its rows directly and tags per shop; the backfill's late `linkMediaAsset` tags too. Removing an image from a gallery does not
  remove the tag: a tag is what the shop said, and the shop can switch it off (spec R6).
- **D4 — The migration backfills Product** for every shop image a `ProductMedia` row uses; images no
  product uses and platform images (`orgId` null) are untouched (Q22).
- **D5 — Filter.** `tag` (`PRODUCT` | `REFERENCE`, the enum's own values) in `mediaLibraryFilterSchema`; `libraryWhere` adds
  `tags: { has }`. The library page's `FILTER_KEYS` and `MediaLibraryFilters` gain it.
- **D6 — Toggle route.** `PUT /api/org/[orgId]/media/[assetId]/tags` with `{ tag, on }`, parsed by a
  schema, `withOrg`-guarded like its siblings, answering the asset's DTO; called from
  `orgMediaApiClient.ts`. Tagging a reference as it is uploaded or chosen is improve-with-ai's
  (R7's Reference half), built there on `addTag`.

## Packages
None.

## UI approach
Per [ux.md](ux.md) journeys 9–10. Phone first: the Tag select is first in the existing filter row;
the detail panel gains a "Tags" row of toggle chips (`Button` variant, `aria-pressed`) driven by
`useMutation`, shown as plain badges on a retired image (nothing disabled); the tile shows a
"Reference" `Badge`. Words in `media-library-copy.ts`.

## Gates touched
- `one-repository`: the only new writes are in `media-asset.repository.ts`.
- `route-reachability`: the new route's caller is `orgMediaApiClient.ts`.
- `hardcoded-copy`, `ui-primitives`, `double-submit`: copy module, `Button`, no new `disabled`.
- `feature-registry`: the route is `core: FREE` — tagging is part of the free library.

## Data model
[MIGRATION] `MediaTag` enum; `MediaAsset.tags` with a GIN index; the D4 backfill. Additive.

## API / contract changes
`MediaAssetDto` gains `tags`. Not in CONTRACTS.md (a catalog-internal DTO); no `[CONTRACT]`.

## Test plan
- `media-tags.test.ts` — the mirror, the filter's parse, the toggle scoped to the org, the DTO.
- `media-links.test.ts` — `withAssetIds` tags the photographs a gallery write links.

## Delivery (PRs)
One unit: schema and backfill, repository, filter, route, UI.

## Open questions
None.
