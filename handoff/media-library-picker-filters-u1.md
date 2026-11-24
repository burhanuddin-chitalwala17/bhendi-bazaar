# Handoff — media-library/picker-filters U1

- **Status:** Done — committed locally, **not yet pushed** (see "Blocked")
- **Branch:** `claude/media-picker-filters`, base `25fea199`
- **Commits:** `ab7229d5` (the unit), `b2e1e700` (spec Implemented, trd/ux retired), plus this file
- **Last pushed sha:** none — the branch does not exist on origin yet

## Goal
The library picker filters by tag, usage, source and date, as the Library page does (spec R1–R6, TRD D1–D7).

## Done
- `src/components/org/media-filter-fields.tsx` — shared controlled fields (D1); the Library page's `media-library-filters.tsx` wraps it, URL behaviour unchanged and now re-seeded when the URL moves.
- `src/components/org/media-library-copy.ts` — `MEDIA_KIND_OPTIONS`, `MEDIA_SOURCE_OPTIONS` with a `satisfies` mirror (D2); `LIBRARY_FILTER_COPY` removed from `org-pages-copy.ts`.
- `src/hooks/product/usePickerFilters.ts` (D3); `src/lib/media/picker-query.ts` + `filter-value.ts` (D4, D5, Q7).
- `src/components/product/media-library-picker.tsx` — Filters · n button (phone), inline from `md`, filtered-empty with Clear filters, no button on an empty library (D6); all three callers inherit it (D7).
- Tests: `tests/unit/picker-query.test.ts`, `tests/unit/media-library-picker.test.tsx`, extended `tests/unit/media-library-filters.test.tsx`. Four mutations recorded in `ab7229d5`'s body.
- `npm run gate`: PASS (run with `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` unset).
- `/bb-review` in a fresh context: no blockers; should-fix 1–2 and nits 3, 4, 6 fixed; nit 5 recorded in ux.md (now retired, pinned at `ab7229d5`).
- `decisions.md`: Q1–Q3, Q5–Q7 `implemented (unit 1)`; Q7 added in review. Spec Implemented; BACKLOG row updated.

## Blocked
`git push -u origin claude/media-picker-filters` was refused by the session's permission classifier. The owner pushes, or allows the push.

## Surprises
- `tests/unit/open-shop-page.test.tsx` fails whenever `NEXT_PUBLIC_APP_URL` is the real origin. This happens on the base commit too, so it is not from this unit.
- `tests/unit/org-schema.test.ts` flaked once on a random code collision.
- No local Postgres, so the integration suite was not run. The unit touches nothing in `server/`.
- After merging with the viewer and bulk-actions branch, rerun `npm run docs:index`, because `docs/ARCHITECTURE.md` counts and `docs/specs/README.md` will conflict.

## Next steps
1. Push `claude/media-picker-filters`.
2. The owner walks the phone acceptance below on the preview.
3. Merge alongside the viewer and bulk units, then run `npm run docs:index`.

## Resume
`npm ci` · `git fetch --unshallow` · `git checkout claude/media-picker-filters` · `env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate` · `/bb-build media-library/picker-filters unit 1` (the build is complete, so this only re-checks it).

## Phone acceptance (~360px)
1. Product form → Photos → From your library → Filters → Tag "Product", Usage "Not used": only unused product photos show, and the button reads "Filters · 2" (A1).
2. The Videos tab has no Tag field, and the YouTube tab has no "Came from" field (A2, Q7).
3. The page's address never changes while filtering (A3).
4. Tick two photos, then change Usage: both stay ticked (A4).
5. Tag "Reference", "Came from" "Cropped or made", When "Last week": "Nothing matches these filters.", and Clear filters brings back the full grid (A5).
6. The video poster picker (Library → a video → Change poster) and the styled-shot reference picker both show Filters (A6).
7. From tablet width, the fields sit inline beside the tabs with no button. With an empty library, there is no Filters button.
