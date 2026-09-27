# TRD — media-library

- **Status:** 🔨 In progress — PR-152, PR-161, PR-163, PR-177 (4 of 6, crop pending)
- **Domain:** catalog (assets, slots), content (renditions, capture checks)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-27
- **References:** [spec.md](spec.md), [image-delivery trd](../image-delivery/trd.md), [bulk-catalog-upload trd](../bulk-catalog-upload/trd.md) D10, [ADR-0003](../../adr/0003-one-repository-per-aggregate.md), [ADR-0014](../../adr/0014-deploys-run-their-own-migrations.md), [ADR-0027](../../adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md), [ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

One new aggregate, `MediaAsset`, becomes the record behind every image URL the schema holds today: `ProductMedia.ref`, category and org heroes, logos, banners. The URL columns stay for one release and gain a nullable asset reference; a backfill fills it; the reference then becomes required and the URL is read from the asset. Renditions are a pure function in `content` from an asset and a declared surface to a new derived asset, using the sharp pipeline already in `server/catalog/image-upload.ts`. Capture checks run on the browser canvas the gallery uploader already draws on to downscale (bulk-catalog-upload D10).

## Technical decisions

- **D1 — `MediaAsset` is the one aggregate for media, with one repository: stored images and embedded video references.** A gallery write links each row to its asset: a photograph by URL, a video by the org's own reference, created on the spot when the library has not seen the video yet. Columns: `kind` (`IMAGE` or `VIDEO_EMBED`), object key or external video id, width, height, bytes (null for an embed), mime type, owning org (nullable for platform-owned), uploader, `source` (`UPLOAD`, `DERIVED` or `EMBED`), `derivedFromId`, `transform` (JSON describing the derivation), `state` (`PENDING`, `READY`, `RETIRED`), `retiredAt`. An embed's poster is derived from its id as the gallery already does ([product-video trd](../product-video/trd.md)). Every write to an image column elsewhere goes through this repository's id, never a URL ([ADR-0003](../../adr/0003-one-repository-per-aggregate.md)).
- **D2 — Direct browser uploads register before they upload.** `presignUpload` in `server/catalog/object-store.ts` already signs path and content type; the presign call now also creates the asset row as `PENDING` with that key. After the PUT the browser calls confirm with the dimensions it read on its canvas; the server verifies bytes and content type with a HEAD against the store, records them, and marks the row `READY`. Rows left `PENDING` past an hour are swept. The server-side path in `image-upload.ts` records dimensions from sharp directly.
- **D3 — The backfill is a one-off script, idempotent, run once per database.** For each distinct image URL it downloads the object, reads dimensions with sharp, inserts the asset and sets the reference; for each YouTube gallery item it inserts an embed asset. Re-running finds the reference set and skips. Not a migration because it needs the object store; not the seed because it is production data. Recorded in the CHANGELOG when run.
- **D4 — Slots are a per-category shot list, and a product's item names its slot.** A generic list — front, back, detail, label, scale — is the declared default; `Category` gains nullable `shotList` (JSON: ordered slot keys with a label, a framing hint and a `role` of `product`, `label` or `lifestyle`), inherited down the tree from the nearest ancestor that defines one. `ProductMedia` gains nullable `slot`; `position` still orders the gallery and `isThumbnail` still marks the cover ([product-video trd](../product-video/trd.md)). A slot key not in the category's list is refused at the boundary.
- **D5 — Renditions are a subfeature.** Surfaces, the `(asset, surface)` function and its crop-or-original rule live in [renditions](renditions/), which reads and writes assets only through this feature's asset service.
- **D6 — Checks run on the chosen file, on the canvas, know nothing of its source, and are chosen by the slot's role.** Mean luminance for darkness, Laplacian variance for blur, and pixel dimensions against the smallest marketplace minimum, computed on a fixed-size downscale of the frame the uploader already draws (bulk-catalog-upload D10). Product and label slots get all three; a lifestyle slot gets size only; renditions never run them. Thresholds are declared once, start at the conventional values for those measures, and are calibrated on the seller's first real photos — no marketplace publishes a number, only "in focus and well-lit". Advisory copy, not a refusal (spec R8). Guidance is shown on the empty slot as text plus an example silhouette per slot role; a web camera hands back a file, so there is no viewfinder to overlay, and an in-browser one was rejected for forfeiting the phone's own camera processing.
- **D6a — Rotate and crop at upload produce a derived asset, never a new original.** The browser uploads the untouched file as the source and the cropped frame as a second object; the crop's asset row is `DERIVED` from the source with the rotation and rectangle as its `transform`. The slot references the crop. [renditions](renditions/) starts from the crop and falls back to the source when a surface needs pixels the crop discarded. No colour operations are offered (spec R8a).
- **D7 — Usage is a query, not a counter, and so are the library's filters.** Product, slot, used or unused, source and date are predicates on the asset table and its referencing columns at read time. "Where is this used" is a union over the referencing columns at read time. A counter would be a second source of truth for a fact that is cheap to derive.
- **D8 — Retirement, grace, sweep.** Retire sets `RETIRED` and refuses while any reference exists; a sweep deletes the objects of assets retired over thirty days through `deleteObject`. A script until the worker exists, then a schedule on it.
- **D10 — The admin surface is the same library, read-only, across all organisations.** Same listing query with an org filter, reached from the admin route group; the only write is retire-with-reason through the asset repository, with an audit entry ([ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md)). Platform-owned assets have a null org. Provenance is `source` and `transform`, so generated images are filterable.
- **D9 — The plain-background estimate is computed at confirm time**, from the border pixels of the stored image, and stored on the asset. It is an estimate for readiness to consume ([listing-schema](../listing-schema/)); nothing here acts on it.
- **D11 — Deduplication is by content hash, within an org.** The browser hashes the downscaled file (SHA-256, WebCrypto) and sends the digest with the presign request; the server answers with the org's existing ready asset for that digest instead of a signed URL, and the client adds its URL without uploading. `MediaAsset.contentHash` is indexed with `orgId`; the server upload path records it from the bytes, and the backfill hashes older rows. Scoped to the org because ownership — who uploaded, who may retire — is the library's unit, and a shared object would make retirement a reference count across owners (spec R13). Cross-org sharing was rejected for that and for letting one org learn another holds the same file.

## Packages

`react-day-picker` for the calendar behind the date-range field — range selection, keyboard and screen-reader behaviour are what go wrong when a calendar is hand-rolled. Styled through our tokens, its stylesheet unused. [DEPENDENCIES.md](../../DEPENDENCIES.md). sharp is present; canvas work uses the browser.

## UI approach

Phone first. The library is a 3-up grid (`PRODUCT_GRID_CLASSES`, [ADR-0016](../../adr/0016-mobile-app-shell.md)) of the org's assets with a usage count badge, paged as you scroll — the first page rendered on the server, more on an observer with a button as the control — with an upload action beside the title. Filters live in the URL and apply as each is picked, by client navigation, so only the grid re-renders — a plain form did the same with a full page load, which read as a flicker. The date filter is one range field: a button naming the range opens a sheet with a two-month calendar in range mode and the presets people reach for, and the range travels as two day keys. Tapping a tile opens a sheet with details, a one-line summary of uses that expands to the list, and a retire action that says why it is refused rather than greying out; a video tile shows its poster and the sheet plays it with the product page's tap-to-play embed. The product editor's gallery is a vertical list of the category's named slots: an empty slot shows its label, its framing hint and an example silhouette for its role, with two tap targets — a plain file input that opens the phone's camera or gallery, and the library picker — and a filled slot shows the photograph with cover, move-to-extra and remove; extras and video sit beneath the slots in their own order, and a photograph that fails a capture check carries an advisory banner in its row with Remove and Keep anyway, which never blocks saving (PR 4; rotate-and-crop follows as its own unit). Desktop adds a wider grid and a side panel for details. Every control through the primitives ([ADR-0031](../../adr/0031-one-components-home-organised-by-domain.md)).

## Data model

[MIGRATION] New `MediaAsset`; nullable `assetId` on `ProductMedia`, `Category`, `OrgProfile` (hero, logo), `OrgBanner`, `Banner`; `Category.shotList` JSON; `ProductMedia.slot`. A second migration, after the backfill, makes `assetId` required and drops the single-image URL columns. `ProductMedia.ref` is untouched: it keeps the image URL or the bare video id exactly as today, and reads prefer the asset when one is set.

## API / contract changes

[CONTRACT] `ProductMediaDto` gains `assetId`, `slot`, `width`, `height`; `MediaAssetDto` is added. Additive only for buyer-facing payloads (spec A6). [CONTRACTS.md](../../CONTRACTS.md) moves in lockstep.

## Test plan

Per [TESTING.md](../../TESTING.md): unit — surface declarations are multiples that clear the zoom rule as [ADR-0027](../../adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md) requires, slot validation against the category list, retirement refused while referenced, the DTO additive check; integration — backfill idempotency, pending sweep, rendition returns the same asset for the same pair; guard — a test that no module outside the asset repository writes an image column (mutation-tested).

## Delivery (PRs)

1. `MediaAsset` table, repository, presign-and-confirm flow, backfill script. No visible change; A1 proves it.
2. Slots and shot lists for the seller's categories; gallery editor by slot. Behaviour change.
3. Library screen and picker, retirement and sweep.
4. Pre-upload checks, slot guidance, and rotate-and-crop as a derived asset.
5. The platform owner's read-only view and retire-with-reason.
6. [renditions](renditions/), as its own PR.

## Open questions

None. Closed 2026-09-25 by the owner: every category starts on the generic shot list and tailored lists follow the marketplace templates (D4); thresholds start at conventional values and are calibrated on real photos, scoped by slot role (D6); video enters the library as an embed asset while `ProductMedia.ref` stays as it is (D1, data model).

