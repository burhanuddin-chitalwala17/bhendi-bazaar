# Handoff — media-library/viewer U2 (download in the side sheet)

- **Status:** Done — final commit on `claude/media-library-build` is the `catalog: Download in the library side sheet …` commit after d7bb0e7d.
- **Goal:** TRD Delivery U2: the sheet's Download anchor plus the HEAD check (D4, D5), the YouTube note (Q8), the ux toasts (Q10), copy in `media-library-copy.ts`.

## Done
- `orgMediaApiClient.downloadHref(orgId, assetId)`; `canDownload` uses it.
- `src/components/org/useMediaDownload.ts`: HEAD via `useMutation` (no toast), a ref holds a second tap, navigate on 200 through `src/lib/browser-navigation.ts` (a seam because jsdom's `location` can't be spied). 410 → file gone, 404 → not in your library, anything else → "Couldn't download" + Try again. VIDEO_EMBED → toast with "Open on YouTube" (new tab), never reaches the route.
- `src/components/org/media-download-button.tsx`: `Button asChild size="lg"` anchor (Spinner + aria-busy while checking, since `pending` is for buttons only); YouTube → a plain Button.
- Side sheet: Download sits under the preview in a `flex-col sm:flex-row sm:flex-wrap` row. It is offered on retired items too (Q10).
- `MEDIA_VIEWER_COPY` started in `media-library-copy.ts` (download strings only).
- Tests: `tests/unit/media-download-button.test.tsx` (6). Gate green; integration 753 passed / 7 skipped. Six guard mutations recorded in the final commit body.
- Q8, Q10 → implemented (unit 2). src/components/CLAUDE.md Verified bumped after a re-read.
- /bb-review (fresh context): no blockers. Fixed: the 40px target, dropping the untested 422 branch, a test label, flex-wrap, the decisions Verified date, and the commit record.

## For U3 (the viewer)
- Reuse `<MediaDownloadButton orgId asset />` in the viewer; it takes `Pick<MediaAssetDto,"id"|"kind"|"ref">`.
- Add "View full image" into the same sheet row (`media-library-grid.tsx`, just under the preview), before Download.
- Add the rest of the viewer copy deck to `MEDIA_VIEWER_COPY`.
- Review nit left open: any non-404/410 failure (401/403/500) shows the connection toast, as ux.md defines only those rows. Log a Q if it should differ.
- The grid file is at about 531 lines. Consider the TRD's planned `media-library-tile.tsx` split.

## Resume
```
npm ci
git fetch --unshallow   # if shallow
env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate   # open-shop-page fails otherwise (pre-existing)
service postgresql start; DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bhendi_bazaar_ci npm run test:integration
/bb-build media-library/viewer unit 3
```
