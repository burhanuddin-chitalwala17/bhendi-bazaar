# Handoff — media-library/viewer U3 (the viewer)

- **Status:** Done — unit commit 94a656e9; spec Implemented (trd.md and ux.md deleted, links pinned to 94a656e9)
- **Last pushed sha:** (see `git log origin/claude/media-library-build -1`)
- **Goal:** TRD Delivery U3: extract `ZoomableImage` from `ImageLightbox` (D7); `LibraryViewer` + `useLibraryViewer` (D6, D8, D9, D10); the ⤢ tile control (Q7); "View full image" in the sheet; Download in the viewer. Closes A1–A4, A6 (viewer); Q1–Q4, Q7, Q9, Q11. Last unit: spec → Implemented after.

## Plan
1. Failing tests: `tests/unit/zoomable-image.test.tsx`, `tests/unit/library-viewer.test.tsx`.
2. `src/components/shared/zoomable-image.tsx`; `ImageLightbox` renders it.
3. `src/hooks/org/useLibraryViewer.ts`; `src/components/org/library-viewer.tsx` + lazy wrapper.
4. Split `media-library-tile.tsx` out of the grid (grid is 24.3 KB of the 25 KB limit); ⤢ on the tile; sheet button.
5. Copy, icon `fullscreen`, overlay-surfaces MAY_USE_DIALOG line, image-delivery zoom-cap list.
6. Gate, integration, mutations, /bb-review, commit, spec:status Implemented.

## Done
- `src/components/shared/zoomable-image.tsx` (D7): pinch, wheel, pan, minimap, unzoomed swipe; `ImageLightbox` renders it and is down to 124 lines. Threshold `SWIPE_PX` + `useHorizontalSwipe` in `src/hooks/core/useHorizontalSwipe.ts` (the viewer's video and YouTube slides swipe through it).
- `src/hooks/org/useLibraryViewer.ts` (D9): keys, next/previous/go, next page two before the end, "That's the last one", the failed-picture set.
- `src/components/org/library-viewer.tsx` (D6, D8, D10) + `LazyLibraryViewer.tsx`; slides by kind, only the current one mounts a player.
- `media-library-tile.tsx` split out of the grid (grid 24.3 → 22.3 KB); ⤢ control top-left, state badge to `top-11` (Q7).
- Grid: `viewerIndex`, "View full image" in the sheet row before Download, close scrolls the tile into view (Q11).
- Copy deck finished in `MEDIA_VIEWER_COPY`; icon `fullscreen` = ArrowsOut.
- Gates: `overlay-surfaces` MAY_USE_DIALOG + `image-delivery` zoom-cap list now name the new files.
- Tests: `zoomable-image` (6), `library-viewer` (14), `media-library-tile` (5). Gate green; integration 753 passed / 7 skipped.
- Mutations: 13, all caught, recorded in the body of the `media-library: the Library's full-screen viewer …` commit.
- /bb-review (fresh context): 6 blockers, 17 nits. Fixed: strip scroll at sm+ and strip follows the slide; Loading placeholder; Q1–Q4, Q7, Q9, Q11 → implemented (unit 3); drag-then-pinch no longer swipes; badge below ⤢ (top-13); 20px glyph (ux amended); stable onMore; dead-overlay close; findIndex guard; atEnd dropped; trd D6/D8 corrected; copy-deck rows for slide alt and strip aria; Verified dates. Not fixed, with reasons: squash the wip commits (needs a force-push, denied); minimap top-3 (would sit under the lightbox's absolute ✕); keep image-lightbox in the zoom-cap list (it no longer imports the cap, so the test would fail); quality={88} and the lightbox's own strip predate U3.

## For bulk-actions U1
- A tile is now `MediaLibraryTile` in `src/components/org/media-library-tile.tsx` (`asset`, `onOpen`, `onFullScreen`). Selection mode belongs there: in the mode, `onOpen` ticks instead of opening the sheet. Corners: ⤢ top-left (44px), state badge `top-13` left, use count top-right, REFERENCE bottom-left, duration bottom-right. A tick needs its own place, or should hide ⤢ while selecting (log a Q).
- `MEDIA_VIEWER_COPY` now holds the full viewer deck; bulk copy should be its own `MEDIA_BULK_COPY` in `media-library-copy.ts` (ADR-0067).
- The grid keeps `viewerIndex` + `tilesRef`; `loadMoreForViewer` is a stable `useCallback(loadMore)`. "Select all {loaded}" can read `assets.length` from `useMediaLibraryPages`.
- Single download is `<MediaDownloadButton orgId asset />` + `useMediaDownload` (HEAD then navigate). Many-at-once downloads need their own route; the single route is `GET|HEAD /api/org/[orgId]/media/[assetId]/download`.
- bulk-actions trd.md/ux.md links into viewer trd/ux are pinned to `94a656e9:` paths now.
- Gate: `env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate` (open-shop-page fails otherwise, pre-existing). `npm run docs:index` after adding test files.
- Open nit kept from U2: any non-404/410 download failure shows the connection toast.

## Resume
```
npm ci; git fetch --unshallow   # if shallow
env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate
service postgresql start; DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bhendi_bazaar_ci npm run test:integration
/bb-build media-library/viewer unit 3
```
