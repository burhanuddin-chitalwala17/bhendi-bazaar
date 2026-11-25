# Handoff — media-library/bulk-actions U3 (selection mode)

- **Status:** Done — unit committed as `org: Library selection mode with bulk download, tag and retire`
- **Last pushed sha:** (see `git log origin/claude/media-library-build -1`)
- **Goal:** TRD Delivery U3: Select / Done, ticks on tiles, the selection bar (Download · Tag · Retire), the retire confirm, the tag picker, download with progress and outcomes, wired to U1's `orgMediaApiClient` bulk methods and U2's `useLibraryZip(orgId, orgCode)`. Changes behaviour. Closes A1, A2, A3 (bar), A4/A5 (UI half); Q1, Q2, Q6, Q7, Q12, Q13, Q14, Q16 (+ Q17–Q19 made here).

## Done
- `MEDIA_BULK_COPY` in `media-library-copy.ts` — ux.md copy deck incl. the Q16 lines.
- `useLibrarySelection` (mode + ticked ids); cleared by the grid's `key={query}` remount (Q12) and Done.
- `library-bulk.ts` (pure): `zipNotice`, `planRetire`/`retireNotice`, `planTag`/`tagNotice`, `sendInBatches` (100 a request, Q10, stops at first failure and returns what landed), `mergeOutcomes`.
- `SelectionBar` (shared) grew `hint` (bar stays at 0 picked), `busy` (progress bar + Cancel; actions wait) and action `wrap` (Tag button as the picker's trigger).
- `MediaLibraryTile`: `selection` (tap toggles, `aria-pressed`, ring + tick top-left, ⤢ hidden) and `onSelect` (lg hover tick, top-right, Q18).
- `MediaLibrarySelectionBar`: Download via `useLibraryZip` with toast per outcome and "Try those n again" (Q13); Retire via `FormDialog` (counts from loaded `uses`, server outcome replaces it, error under the button); Tag via `ResponsivePicker` with Add / Remove per tag (Q6); `router.refresh()` after each write.
- Grid: Select / Select all {n} / Clear / Done beside the item count; `picked` = loaded assets that are ticked, so retired ones drop out; `pb-24` while the bar floats.
- `useLibraryZip` asks for `download-links` 100 ids at a time and holds the summed bytes to the limit (selection can pass 100 after load-more).
- `MEDIA_BULK_MAX_IDS` exported from `media-library.schema.ts` (same shape; no contract change).
- Docs: decisions Q1, Q2, Q6, Q7, Q12, Q13, Q14, Q16 → implemented (unit 3); Q17 (surfaces), Q18 (hover tick), Q19 (partial-batch line) added; ux.md rows amended citing them; TRD U3 amendment; BACKLOG row "Built, awaiting owner review"; ARCHITECTURE counts.
- Tests: `tests/unit/library-bulk.test.ts`, `tests/unit/media-library-selection.test.tsx`, `use-library-zip.test.ts` (batching), `page-grammar.test.tsx` (hint, busy).
- Mutations (all red, restored): `uses === 0` → `>= 0` in `planRetire`; retired photos let into `planTag`; summed-bytes limit check → `Infinity`; tile `onClick` always opens; partial-batch error toast dropped.
- Gate green. Integration: 760 passed / 7 skipped / 1 failed — `jobs-enqueue` "no drift", because the shared `bhendi_bazaar_ci` holds another branch's tables (ConnectionLane, MetaEvent, OrgDataKey…); U3 has no prisma change.

## Review (/bb-review, fresh subagent) — nothing blocking; handled
1. Retire dialog closable mid-request → a failure went unsaid. Held open while the request runs.
2. Q19 is copy → marked "Claude · proposed — owner to confirm"; on the phone-walk list.
3. "Slow" row: bar buttons spun at once → `useDelayedFlag` (new, `src/hooks/core/`), spinner after 3 s; the dialog's and picker's buttons spin at once (their Loading rows).
4. Add then Remove in the tag picker could race → one tag change at a time (ref guard); test + mutation.
5. "500 MB" typed into the mid-download line → `zipTooBigMidway(limit)` from `ZIP_LIMIT_BYTES`.
6. A later batch's 422 quoted one batch's size → `totalBytes: null` (mid-download line); test + mutation.
7. Toast retry after the bar unmounted started an invisible zip → retries run only while the bar is mounted.
8. Bar width at md → `md:max-w-md`. Phone "three equal buttons" **not** done: `SelectionBar` is shared with the products console; left for the phone walk.
9. Unused `MEDIA_BULK_COPY.count` → removed.
10. Clear (X) shown at 0 selected → only with something picked.
Added mutations: tag guard removed; delay → 0; later-batch 422 rule → `false` (all red, restored).

## For the owner (phone walk)
- A1–A5 per spec at ~360px, after CORS `GET` (confirmed 2026-11-25).
- Q17 surfaces (retire = bottom sheet on phone), Q18 hover tick top-right at lg, Q19 partial-batch line.
- Bar buttons are natural width, not three equal (ux row).
- Prototype link in ux.md could not be opened from this session (artifact not found / not shared).

## Resume (macOS)
```
source ~/.nvm/nvm.sh && nvm use 22
export DATABASE_URL=postgresql://$(whoami)@localhost:5432/bhendi_bazaar_ci
env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate
npm run test:integration
```
