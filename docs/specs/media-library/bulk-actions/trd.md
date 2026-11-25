# TRD — bulk-actions

- **Status:** Accepted
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-25
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), ../viewer/trd.md (`94a656e9:docs/specs/media-library/viewer/trd.md`), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0028](../../../adr/0028-images-live-in-cloudflare-r2.md), [ADR-0032](../../../adr/0032-records-people-authored-are-retired-not-deleted.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0048](../../../adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

Selection is client state over the grid's loaded `assets`. Each action is one request carrying up to 100 ids (Q10), answered with an outcome that the UI turns into the ux copy.

- **Retire and tag** run the existing one-asset rules once per id inside the service. No new write path exists, so every rule that guards one asset guards many (R4).
- **Download** asks the server for presigned GETs for the selected files, along with their sizes. The server refuses above 500 MB (Q4). The browser then fetches each file and streams it into a zip with `fflate`, storing without compressing, because photos and videos are already compressed. It saves the zip as one blob.

## Prior art

Checked against the field (ADR-0046).

- **Google Drive and Dropbox** build multi-file zips on the server. That needs either a function that runs for minutes and moves the bytes, or a queued job and a "your download is ready" step. We have neither, and a seller's selection is tens of files.
- **Client-side zipping of a bounded selection** is the documented pattern for `fflate` and `client-zip`. We follow it, bounded by the owner's 500 MB, because a phone browser holds the result in memory.

## Technical decisions

- **D1 — Three new routes, all `withOrg`, all bodies parsed.** Each schema lives in `media-library.schema.ts`. `ids` is `z.array(z.string().min(1).max(64)).min(1).max(100)`, de-duplicated by the schema.
  - `POST /api/org/:orgId/media/retire`, body `{ ids }`, answers `{ retired, inUse, alreadyRetired, notFound }`, each a list of ids.
  - `POST /api/org/:orgId/media/tags`, body `{ ids, tag, on }`, answers `{ changed, notPhoto, retired, notFound }`.
  - `POST /api/org/:orgId/media/download-links`, body `{ ids }`, answers `{ files: [{ id, url, filename, bytes }], noFile: [{ id, reason: "link" | "deleted" }], totalBytes }`. Above the limit it answers 422 with `{ totalBytes, limitBytes }` in the envelope's details.
- **D2 — Retire many is the one-asset retire, looped.** `mediaAssetService.retireMany(orgId, ids)` calls the logic of `retire` per id and catches its `ConflictError` as `inUse` and its `NotFoundError` as `notFound`. An already-retired row is counted as `alreadyRetired`. Each retirement stays its own conditional `updateMany` (`retireUnused`), so a use added between the grid's read and the write still refuses that one asset ("turned out to be in use", ux). *Rejected:* one `updateMany` over all ids. It would skip the by-URL check (`referencedRefs`) and the rendition retirement that `retire` does per asset, and the outcome could not say which ones stayed. 100 conditional writes is well inside a request's budget.
- **D3 — Tag many.** Add is one statement: the existing `addTag` (`updateMany … NOT has tag`) is widened to exclude RETIRED, because the shop's toggle already refuses retired photos (`setTag`). Remove is the existing per-id compare-and-set `setTag(…, false)`, looped. The outcome's `notPhoto` and `retired` come from one read of the ids (`findManyForOrg`, new, select id, kind and state) before the write.
- **D4 — Download links.** `mediaAssetService.downloadLinks(orgId, ids)` reads the rows (`findManyForOrg`). It sums `bytes` over rows that have an `objectKey`. Over `ZIP_LIMIT_BYTES = 500 * 1024 * 1024` it refuses. Otherwise it signs each with `presignDownload` from viewer D1, using the same filename (viewer D3). The links are valid for 15 minutes, long enough for a slow phone to fetch 500 MB. A row with null `bytes` (legacy backfill) is counted as 0 and the client checks the real length as it streams. The server cap is the authority, and the client's check only stops runaway memory.
- **D5 — The browser reads the bytes, so the bucket's CORS must allow `GET`.** Today it allows `PUT` only (OPERATIONS.md §4). U2 adds `GET` with the same origins to that policy and updates OPERATIONS.md with the step and its reason. **This is an owner action in Cloudflare before U3 ships.** Until then the zip fails with "Couldn't fetch any of these files". *Rejected:* a same-origin proxy route, for the same reasons as viewer D1.
- **D6 — Zipping.** `fflate`'s streaming `Zip` with one `ZipPassThrough` (stored, level 0) per file. Each file's `fetch` body stream is fed chunk by chunk, and the output chunks collect into a `Blob`. Files go one at a time, so peak memory is the zip plus one chunk. Progress is per file finished. Cancel aborts the current fetch through an `AbortController` and drops the parts. A file whose fetch fails is skipped and reported (Q13). "Try those n again" calls `download-links` with only those ids. The zip is named per Q11 and saved through an object URL on an anchor.
- **Amended 2026-11-25 (U1 build):** `retireMany`, `setTagMany` and `downloadLinks` live on `mediaBulkService` (`server/catalog/media-bulk.service.ts`), not `mediaAssetService`, wherever D2–D4 name the latter. Bulk calls `mediaAssetService.retire`, so re-exporting it there would be an import cycle, and that file is at its size pin. Precedent: `product-bulk.service.ts`.
- **Amended 2026-11-25 (U2 build):** each file is read whole before it is added, so peak memory is the zip plus one file rather than one chunk (Q15): an entry cannot be withdrawn from a streaming zip, and a fetch that failed halfway would leave a truncated file. `ZIP_LIMIT_BYTES` moved to `media-library.types.ts` so `buildZip` holds real bytes to the server's number. The zip's filename (Q11) is `libraryZipName` in `useLibraryZip`, which answers an outcome and never toasts; U3 turns it into copy.
- **Amended 2026-11-25 (U3 build):** a selection can pass 100 once more pages are loaded, so `useLibraryZip` asks for `download-links` 100 ids at a time and holds the summed `totalBytes` to the limit itself, as retire and tag batch (Q10). The bar's outcome copy is mapped in `library-bulk.ts`, pure; `SelectionBar` gained `hint` (the mode with nothing picked), `busy` (zip progress and Cancel) and an action `wrap` (the Tag button as the picker's trigger). Surfaces per Q17.
- **D7 — Where the code goes (ADR-0048).**
  - The three requests go in `orgMediaApiClient`. The byte fetch of a presigned URL goes in `mediaFilesApiClient.ts` (new, `src/components/org/`), the one place a raw `fetch` of our bucket happens.
  - `useLibrarySelection` holds the selected ids and the mode.
  - `useLibraryZip` holds progress and cancel, and calls `buildZip` (new `build-zip.ts` in `src/lib/zip/`, pure apart from the stream it is given, unit-testable). The bar component renders.
- **D8 — Selection clears on a filter change and on leaving the mode (Q12).** It is keyed on the grid's `query`, which already remounts the grid. Items removed by a retire are dropped from the selection. The retire confirm's "{m} more are still in use" is computed from the loaded DTOs' `uses`. The server outcome is authoritative and its counts replace the estimate in the toast.

## Packages

`fflate` `0.8.3`, pinned exactly. It is about 8 kB gzipped for the parts imported, has no dependencies, is MIT-licensed, and offers streaming `Zip` and `ZipPassThrough`. It is loaded only by the selection bar's chunk (`next/dynamic` on first Download). *Rejected:* `jszip`, which is larger and buffers whole files. *Rejected:* `client-zip`, which is equally small and good, but answers as a `Response` stream that we would buffer anyway, without the per-file progress hook. Row added to `docs/DEPENDENCIES.md` in U2.

## UI approach

Screens, states and copy are as in [ux.md](ux.md).

- **Per form factor (ADR-0050).**
  - Phone (base): **Select** beside the item count. A tap ticks a tile (ring plus check). The bar floats above the bottom safe-area inset with three equal buttons, and the tile's ⤢ is hidden in the mode.
  - `md:` centres the bar at max 480px.
  - `lg:` shows a tick on tile hover that starts the mode (Q7).
- **Rendering.** Everything here is a client leaf under the existing `MediaLibraryGrid`. `page.tsx` is unchanged.
- **Behaviour.** Retire and tag use `useMutation` on `orgMediaApiClient`, followed by `router.refresh()` as the one-asset actions already do. Download is `useLibraryZip`.
- **Surfaces.**
  - Retire confirm is `FormDialog`, replacing nothing: the one-asset retire keeps its `confirm()`. The bulk one needs counts and two paragraphs.
  - Tag is `ResponsivePicker`: choosing values from a set, ADR-0040 decision 1.
  - The bar is a plain fixed element, not an overlay. No new token; the bar uses `bg-foreground text-background`.
- **Copy.** Every string goes in `media-library-copy.ts` under `MEDIA_BULK_COPY` (ADR-0067).

## Gates touched

- Three new `/api/org` routes → `route-reachability` (caller `orgMediaApiClient`), `portal-boundary`, `request-body-parsing` (Zod schemas). They are outside the rate-limit registry (`/api/org`).
- `one-repository`: `findManyForOrg` and the widened `addTag` stay in `media-asset.repository.ts`.
- `api-clients`: `mediaFilesApiClient.ts` holds the bucket fetch.
- `overlay-surfaces`: `FormDialog` and `ResponsivePicker` are both already allowed, so no new line.
- `deploy-safety` / `docs-integrity`: the DEPENDENCIES.md row for `fflate`.

## Data model

None.

## API / contract changes

`[CONTRACT]`, additive: the three routes in D1, recorded in `docs/contracts/catalog.md` in U1.

## Test plan

Per [TESTING.md](../../../TESTING.md).

- **Integration** (new `media-bulk.test.ts` in `tests/integration/`):
  - Retire 5 with 2 used → 3 retired, 2 `inUse`, renditions of the 3 retired (A4).
  - Another org's id → `notFound`, nothing changed (A6).
  - Tag add over a mix → photos only, retired excluded (A5).
  - Remove with a concurrent change → the compare-and-set holds.
  - `download-links` over 500 MB → 422 with totals; links signed for own rows only; a link → `noFile: link` (A3).
- **Unit.**
  - The schema refuses 101 ids and de-duplicates.
  - `buildZip` over fake streams: file order, names, a failed file skipped and reported, abort leaves no blob.
- **Component.** Selection mode ticks instead of opening the sheet, and clears on Done and on a query change (A1, A2).
- **Mutation-tested guard.** The 500 MB comparison and the `orgId` in every bulk `where`.
- **Acceptance.** A1–A6 on a phone by the owner, after the CORS step (D5).

## Delivery (PRs)

1. **U1 — Bulk routes** (`after viewer U1`, since it reuses `presignDownload`). Schemas, `retireMany`, `setTagMany`, `downloadLinks`, `findManyForOrg`, the API client methods, and the contract lines. No UI.
2. **U2 — Zip builder** (`after U1`). `fflate`, `buildZip`, `mediaFilesApiClient`, `useLibraryZip`, the DEPENDENCIES.md row, and the OPERATIONS.md CORS step. No UI.
3. **U3 — Selection mode** (`after U2` and `after viewer U3`, since both change `media-library-grid.tsx`). Select and Done, the bar, the retire dialog, the tag picker, download with progress and outcomes. Changes behaviour. **Ships after the owner has added `GET` to the bucket's CORS policy.**

## Open questions

None open. Q14 is decided: the owner adds `GET` to the bucket's CORS policy before U3 ships.
