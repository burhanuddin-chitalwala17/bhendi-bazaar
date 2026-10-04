# TRD — renditions

- **Status:** ✅ Implemented — PR-211 (2026-09-29)
- **Domain:** content, reading catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-25
- **References:** [spec.md](spec.md), [../trd.md](../trd.md) D1, D5, D6a, [ADR-0027](../../../adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md), [ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

A pure function in the content domain from `(asset, surface)` to a derived asset, using the sharp pipeline already in `server/catalog/image-upload.ts`, with surfaces declared as data beside the store's existing zoom declarations in `server/catalog/media.ts`. It writes through the asset repository's public surface and never touches catalog tables directly.

## Technical decisions

- **D1 — `MEDIA_SURFACES` is the one declaration.** Each entry names width, height, fit, format and quality. It sits beside `ZOOMABLE_IMAGE_SIZES` and `MAX_IMAGE_EDGE` so the existing unit test that holds the zoom rule ([ADR-0027](../../../adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md)) extends to every surface with one more assertion.
- **D2 — `content/renditions.service` maps `(asset, surface)` to a `DERIVED` asset whose `transform` is the surface key.** The pair is unique in the asset table, so a second request finds the first result (spec R2). The service reads and writes assets only through catalog's asset service ([ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md)).
- **D3 — Start from the crop, fall back to the original.** Given a crop asset ([../trd.md](../trd.md) D6a), the service checks whether the crop's frame contains the surface's aspect at the required size; if not, it renders from the crop's source with the crop's centre as the focal point (spec R4).
- **D4 — Inline now, on the worker later.** One rendition is a few hundred milliseconds of sharp, so it runs in the request that first needs it. When [image-enhancement](../../image-enhancement/) brings the worker ([ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)), bulk pre-rendering moves there; the function does not change.
- **D5 — Retirement cascades by query, not by trigger.** Retiring a source retires its renditions through the asset service in the same call; the sweep ([../trd.md](../trd.md) D8) removes their objects on the same schedule.

## Packages

None.

## UI approach

None. Renditions are requested by surfaces, not by people.

## Data model

None beyond [../trd.md](../trd.md) D1; a unique index on `(derivedFromId, transform)` for `DERIVED` rows. [MIGRATION] for the index only.

## API / contract changes

None.

## Test plan

Per [TESTING.md](../../../TESTING.md): unit — every surface clears the zoom rule (mutation-tested by declaring one that does not), the same pair yields one asset, the crop-or-original choice for a square crop and a portrait surface, format and size of the marketplace surface; integration — retiring a source retires its renditions.

## Delivery (PRs)

One PR, after media-library PR 4. Behaviour change: surfaces can ask for their image.

## Open questions

None.
