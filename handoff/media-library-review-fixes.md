# Handoff — media-library bulk actions, review fixes

- **Status:** In progress
- **Branch:** `claude/media-library-build` (started at 1a015fe3)
- **Goal:** the seven owner-approved findings from the integrated review, 2026-11-25.

## Done
1. Bulk timeouts: `retireMany`, `setTagMany`, `downloadLinks` wait `TRANSFER_TIMEOUT_MS`. A Retire or Tag that timed out says the shared `TIMEOUT_UNSURE_MESSAGE` (no Try again), closes its dialog or picker and refreshes; after a partial batch the same line replaces "Couldn't reach the server." ux.md rows amended (no new words).
2. `SelectionBar` panel width is a cva axis `width: fit | narrow`, default `fit`; only the Library passes `narrow` (`md:max-w-md`). page-grammar test proves the default carries no cap.
3. Zip links per batch (Q20): the first call over the whole selection stays the 500 MB check and serves the first 10 files; each later 10 asks `download-links` again, and a link 10 min old is asked again. A batch that can't be asked fails its files (Try those n again). Route unchanged. TRD amendment dated.
4. Q19 → Owner, 2026-11-25.
5. Bulk add tag goes through `setTag(…, true)` per photo, as remove; a photo retired mid-request is `retired`. Repository untouched. Integration test.
6. `SelectionAction` documents that overflow actions drop `pending`/`wrap`.
7. `docs/contracts/catalog.md`: "notFound" is for retire and tags.

## Next
- Gate, integration, /bb-review in a fresh subagent, final commit `org: review fixes for library bulk actions`.
