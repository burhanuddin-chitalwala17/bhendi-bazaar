# Handoff — media-library/bulk-actions U2 (zip builder)

- **Status:** In progress — implementation done, gate and review pending
- **Last pushed sha:** (see `git log origin/claude/media-library-build -1`)
- **Goal:** TRD Delivery U2: `fflate` 0.8.3 pinned exactly, `buildZip`, `mediaFilesApiClient`, `useLibraryZip`, the DEPENDENCIES.md row, the OPERATIONS.md CORS `GET` step. No UI. Closes A3 (client half, short of the bar), D5 (doc step), D6, D7 (zip parts); Q11, Q15.

## Done
- `fflate` `0.8.3` in `dependencies` (was already a dev transitive; lockfile only lost its `dev` flag).
- `src/lib/zip/build-zip.ts` — `buildZip(entries, { open, limitBytes, signal, onProgress })` → `{ blob | null, added, failed }`; `ZipLimitError` past the limit on real bytes; AbortError on cancel. Stored entries, one file at a time, each read whole first (Q15, TRD D6 amended).
- `src/components/org/mediaFilesApiClient.ts` — `open(url, signal)`: presigned GET, `credentials: "omit"`, `TRANSFER_TIMEOUT_MS` over body too. Listed in `tests/unit/api-clients.test.ts` `REQUEST_MODULES` with its reason, and exempt from "sends through apiRequest".
- `src/components/org/useLibraryZip.ts` — `useLibraryZip(orgId, shopCode, limitBytes?)` → `{ download(ids), cancel, progress }`; `download` answers a `LibraryZipOutcome`, never toasts; a second call while building joins it. `libraryZipName` (Q11).
- `saveBlob` in `src/lib/browser-navigation.ts`; `withTimeout` exported from `src/lib/api-client.ts`.
- `ZIP_LIMIT_BYTES` moved to `server/catalog/media-library.types.ts` (client-importable); contract line updated.
- Docs: DEPENDENCIES row, OPERATIONS §4 CORS JSON now `["PUT", "GET"]` with the why, decisions Q11/Q15, TRD amendment.
- Mutations (all red, restored): `>`→`>=` on the byte limit; dropped `ZipLimitError` rethrow; room not reduced by bytes so far; `!response.ok` dropped; in-flight join removed; `gone` forced to 0.
