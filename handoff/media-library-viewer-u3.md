# Handoff — media-library/viewer U3 (the viewer)

- **Status:** In progress
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
- (nothing yet)

## Resume
```
npm ci; git fetch --unshallow   # if shallow
env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate
service postgresql start; DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bhendi_bazaar_ci npm run test:integration
/bb-build media-library/viewer unit 3
```
