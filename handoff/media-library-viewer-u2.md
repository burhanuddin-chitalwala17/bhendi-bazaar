# Handoff — media-library/viewer U2 (download in the side sheet)

- **Status:** In progress
- **Last pushed sha:** (see `git log -1 origin/claude/media-library-build`)
- **Goal:** TRD Delivery U2: the sheet's Download anchor plus the HEAD check (D4, D5), the YouTube note (Q8), the ux toasts (Q10), copy in `media-library-copy.ts`.

## Plan
- `orgMediaApiClient.downloadHref(orgId, assetId)`.
- `src/components/org/useMediaDownload.ts` — HEAD check via `useMutation`, navigate on 200, toast by status (404 not mine, 410 gone, 422/VIDEO_EMBED YouTube note with "Open on YouTube", else "Couldn't download" + Try again).
- `src/components/org/media-download-button.tsx` — anchor through `Button asChild`; YouTube → a button opening the note. Reused by the viewer in U3.
- Wired into the side sheet of `media-library-grid.tsx` (also for retired items: Q10).
- Tests: `tests/unit/media-download-button.test.tsx` (spec A5, A6; ux toasts).

## Done
- Built as planned (d7bb0e7d). Gate green; integration 753 passed / 7 skipped; six guard mutations caught.
- Q8, Q10 → implemented (unit 2). src/components/CLAUDE.md Verified bumped after re-read; docs:index counts.

## In progress
- /bb-review in a fresh subagent (range 4676e52..HEAD). Then fix findings, squash-free final commit `catalog: …` naming suites + mutations.

## Resume
```
npm ci
git fetch --unshallow   # if shallow
env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate
/bb-build media-library/viewer unit 2
```
