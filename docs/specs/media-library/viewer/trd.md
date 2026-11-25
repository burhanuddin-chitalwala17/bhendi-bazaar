# TRD — viewer

- **Status:** Accepted
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-24
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), [ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0027](../../../adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md), [ADR-0028](../../../adr/0028-images-live-in-cloudflare-r2.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0048](../../../adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

Two pieces. **Download** is a portal route that checks the asset is this org's and still has a file, then redirects to a short-lived presigned R2 GET that carries `response-content-disposition: attachment`. The browser navigates to it, and R2 serves the bytes under our filename. No bytes pass through a function, and no CORS is involved, because a navigation is not a CORS request. **The viewer** is a client overlay that the grid opens over the list it already holds. Its slides are the grid's `assets` from `useMediaLibraryPages`, so the order, the filters and load-more are the grid's own (Q4). Its photo slide reuses the product lightbox's zoom and pan, which is extracted rather than copied.

There is no spike: there is no new persistence, no new package and no third-party behaviour beyond S3's documented presign overrides, which `aws4fetch` already signs for uploads (`presignUpload` in `server/catalog/object-store.ts`).

## Prior art

None — no new model. A presigned GET with a response-header override is the S3 API's documented way to serve a private-or-public object under a chosen download name. R2 implements `response-content-disposition` on presigned GETs. We follow it.

## Technical decisions

- **D1 — Download is a 302 to a presigned GET, not a proxy.** `GET /api/org/:orgId/media/:assetId/download` → `mediaAssetService.downloadLink(orgId, id)` → `presignDownload(objectKey, filename)` (new, beside `presignUpload` in `object-store.ts`, TTL 300 s). *Rejected:* streaming the object through the route. A hosted video can be 200 MB (`VIDEO_LIMITS`), which costs function time and transfer and meets the response limit. *Rejected:* `<a download href={ref}>`. Browsers ignore `download` on a cross-origin URL and would open the photo instead.
- **D2 — What the route refuses.** Another org's asset, or none: 404 (`NotFoundError`, as `assetDetail` does). `VIDEO_EMBED`: 422 with the YouTube copy. The UI never sends one, because it shows the note instead (Q8). `objectKey` null, either swept after the thirty-day grace (`clearObject`) or never stored: 410 with "This file was deleted thirty days after it was retired." (Q10). A `PENDING` upload: 404.
- **D3 — The filename** is `<org.code>-<asset.id>.<ext>` (Q5). `ext` comes from `mimeType` through a closed map (jpeg and jpg→jpg, png, webp, gif, mp4, mov, webm — every type `ALLOWED_IMAGE_TYPES` and `VIDEO_CONTENT_TYPES` store; gif and jpg added in U1), with `bin` as the fallback. The org code is ASCII by construction, so the disposition header needs no RFC 5987 encoding. A test pins that anyway.
- **D4 — The download control is an anchor, not a fetch.** The sheet's and the viewer's Download is a `<a href="/api/org/…/download">`, styled through `Button asChild`. Navigation starts the download, and the browser's own download UI is the progress. `api-clients` allows this, because no `fetch` is made in a component. The YouTube case renders a button that opens the note (ux J3) and never reaches the route.
- **D5 — A failed download is detected without a fetch.** A navigation that answers 4xx shows the browser's error page, not ours. So the anchor first asks the route with `HEAD` through `orgMediaApiClient.canDownload` (new): 200, 404 or 410, parsed into the envelope. Only on 200 is the navigation started. On a 410 or 404, the toast from ux.md is shown. On a network failure, "Couldn't download" with "Try again". This is one extra round trip, and it buys the copy the UX signed off.
- **D6 — The viewer is a `TaskDialog`-free overlay on the `Dialog` primitive.** It is full-bleed, as `ImageLightbox` is. `overlay-surfaces` already admits `Dialog` for a lightbox, so no `MAY_USE_SHEET` line is needed (ADR-0040).
- **D7 — The zoom stage is extracted, not duplicated.** `ImageLightbox`'s pinch, wheel, pan and minimap logic (`src/components/shared/image-lightbox.tsx`) moves into `ZoomableImage` (new `zoomable-image.tsx` in `src/components/shared/`). `ImageLightbox` and the new `LibraryViewer` both render it. Behaviour of the product lightbox is unchanged, and its existing tests are the proof. `ZOOMABLE_IMAGE_SIZES` and `MAX_ZOOM_SCALE` stay the declared ceiling (ADR-0027). The library's originals clear it, since the stored originals are what ADR-0027 measured.
- **D8 — Slides render by kind.** IMAGE → `ZoomableImage`. VIDEO, READY with renditions → the existing `VideoPlayer`, paused when it stops being the current slide. VIDEO, PROCESSING or FAILED → the poster or film mark plus the ux note. VIDEO_EMBED → the existing `YouTubeEmbed`, mounted only while current, so an iframe never loads for a slide not in view. Neighbours render a poster or thumbnail only.
- **D9 — State lives with the grid.** `MediaLibraryGrid` keeps `viewerIndex: number | null`. The viewer receives `assets`, `index`, `onIndexChange`, `onMore`, `done` and `loading` from the hook the grid already calls. When `index` reaches `assets.length - 2` and `!done`, it calls `loadMore()`. On close, the grid scrolls the tile at `index` into view (Q11). "That's the last one" is a toast when › is tapped on the last slide and `done` is true.
- **D10 — Thumbnails go through the optimizer.** The strip and the neighbours use `NextImage` with a declared small `sizes` (ADR-0026). Only the current photo slide asks for the zoom size.

## Packages

None.

## UI approach

Screens, states and copy are as in [ux.md](ux.md).

- **Per form factor (ADR-0050).** Phone (base): swipe only, 28px neighbour peeks, no arrows, a thumbnail strip above Download, and ✕ and ⓘ in the top bar inside the safe-area inset. `md:` adds the ‹ › arrows. `lg:` widens the neighbours, adds ← →/Esc and the hint line, and the wheel zooms.
- **Rendering.** `page.tsx` is unchanged and stays a server component. `LibraryViewer` (new `library-viewer.tsx` in `src/components/org/`) is `"use client"` as a leaf, lazy-loaded through `next/dynamic` the way `LazyImageLightbox` is, so the grid's first paint carries none of it.
- **Behaviour.** `useLibraryViewer` (new `useLibraryViewer.ts` in `src/hooks/org/`) holds index and keyboard state only. The download check is `orgMediaApiClient.canDownload` via `useMutation`. Nothing here writes.
- **Surfaces.** The `Dialog` primitive; `Button`, `Icon` (new registry names: `fullscreen`, `download`); the tile control is a `Button size="icon"` with a 44px hit area. No new token: the viewer's ground is the existing `bg-scrim` at a stronger alpha step, and the on-dark text is `text-hero-foreground`.
- **Copy.** Every string goes in `media-library-copy.ts` under `MEDIA_VIEWER_COPY` (ADR-0067).

## Gates touched

- New route `GET` (+`HEAD`) `/api/org/[orgId]/media/[assetId]/download` → `route-reachability` (caller: `orgMediaApiClient`, and the anchor's href built by `ROUTES`-style helper in the client), `portal-boundary` (`withOrg`). It is under `/api/org`, so it is outside the rate-limit registry.
- `api-clients`: the HEAD lives in `orgMediaApiClient.ts`.
- `image-delivery`: thumbnails and neighbours through `NextImage` with `sizes`.
- `ui-primitives`, `labelled-controls`: icon buttons carry `aria-label` from copy.
- `file-cohesion`: the grid file grows. If it crosses the cohesion limit, the tile moves to `media-library-tile.tsx` in U3.

## Data model

None.

## API / contract changes

`[CONTRACT]`, additive: `GET|HEAD /api/org/:orgId/media/:assetId/download`. HEAD answers 200, 404, 410 or 422 with the error envelope. GET answers 302 to a presigned URL that is valid for 300 s. Recorded in `docs/contracts/catalog.md` in U1.

## Test plan

Per [TESTING.md](../../../TESTING.md).

- **Unit.** `presignDownload` signs `response-content-disposition` and the expiry (A5). The filename map covers every stored mime type plus the fallback (D3).
- **Integration** (new `media-download.test.ts` in `tests/integration/`). Own asset → 302 to the bucket host. Another org's → 404 (A7). Swept retired → 410. `VIDEO_EMBED` → 422. HEAD mirrors GET's status.
- **Component** (vitest + Testing Library). Viewer index moves on arrow keys and calls `onMore` near the end (A3). The YouTube slide's Download shows the note, not a link (A6). A slide stopping being current pauses its video (A4).
- **Unchanged.** The existing `ImageLightbox` tests pass after the extraction (D7).
- **Acceptance.** A1–A7 walked on a phone by the owner.

## Delivery (PRs)

1. **U1 — Download route** (`independent`). `presignDownload`, `downloadLink`, the GET/HEAD route, `canDownload` in the API client, and the contract line. No UI. Behaviour: a new route only.
2. **U2 — Download in the side sheet** (`after U1`). The anchor plus the HEAD check, the YouTube note, the toasts. Changes behaviour.
3. **U3 — The viewer** (`after U2`). Extract `ZoomableImage`, add `LibraryViewer` and its hook, the ⤢ tile control, "View full image" in the sheet, and Download in the viewer. Changes behaviour.

## Open questions

None open.
