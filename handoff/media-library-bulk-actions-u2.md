# Handoff — media-library/bulk-actions U2 (zip builder)

- **Status:** Done — unit committed as `org: browser zip of a library selection with fflate [CONTRACT]`
- **Last pushed sha:** (see `git log origin/claude/media-library-build -1`)
- **Goal:** TRD Delivery U2: `fflate` 0.8.3 pinned exactly, `buildZip`, `mediaFilesApiClient`, `useLibraryZip`, the DEPENDENCIES.md row, the OPERATIONS.md CORS `GET` step. No UI. Closes A3 (client half; the bar is U3), D5 (doc step), D6, D7 (zip parts); Q11, Q15.

## Done
- `fflate` `0.8.3` in `dependencies` (was already a dev transitive; the lockfile only lost its `dev` flag).
- `src/lib/zip/build-zip.ts` — `buildZip(entries, { open, limitBytes, signal, onProgress })` → `{ blob | null, added, failed }`. Stored entries, one file at a time, each read whole first (Q15, TRD D6 amended), so a half-failed fetch is skipped, never truncated. Each file's output is sealed into a Blob as it is added (no double copy at the end). `ZipLimitError` when real bytes pass the limit; AbortError on cancel.
- `src/components/org/mediaFilesApiClient.ts` — `open(url, signal)`: presigned GET, `credentials: "omit"`, `TRANSFER_TIMEOUT_MS` deadline over the body, throws `ApiError`. In `tests/unit/api-clients.test.ts` `REQUEST_MODULES` with its reason; exempt from "sends through apiRequest" (the bucket answers no envelope).
- `src/components/org/useLibraryZip.ts` — `useLibraryZip(orgId, shopCode, limitBytes?)` → `{ download(ids), cancel, progress }`. `download` always resolves a `LibraryZipOutcome` (`saved | noneFetched | nothingToZip | tooBig | error | cancelled`), never toasts, and joins a call in flight. `progress` is `{ done: 0, total: ids.length }` while links are asked for, then per file. fflate is `import()`ed on first download. `libraryZipName` (Q11).
- `saveBlob` in `src/lib/browser-navigation.ts` (object URL revoked after 60 s for Safari); `withTimeout` exported from `src/lib/api-client.ts`.
- `ZIP_LIMIT_BYTES` moved to `server/catalog/media-library.types.ts` (client-importable); `docs/contracts/catalog.md` line updated.
- Docs: DEPENDENCIES row, OPERATIONS §4 CORS JSON now `["PUT", "GET"]` with the why, decisions Q11 and Q15 implemented (unit 2), TRD D6 amendment, ARCHITECTURE test counts.
- Tests: `tests/unit/build-zip.test.ts`, `tests/unit/use-library-zip.test.ts`, `tests/unit/media-files-api-client.test.ts`, `tests/unit/api-clients.test.ts`.
- Mutations (all red, restored): `>`→`>=` on the byte limit; `ZipLimitError` rethrow dropped; room not reduced by bytes so far; `!response.ok` dropped; timeout not applied; in-flight join removed; `gone` forced to 0; cancel check before mapping a links error removed. The per-file Blob seal is a memory property no output test can see (mutation stays green) — checked by review, not a test.
- Gate green (typecheck, unit tests, boundary lint). Integration 761 passed / 7 skipped.

## Review (/bb-review, fresh subagent) — all handled
1. Zip held twice at the end → per-file Blob sealing.
2. No busy state during the links request; cancel then gave `error`/`tooBig` → progress set before the request; aborted checked first.
3. Client-side over-limit size misleading → `tooBig.totalBytes` is `null` when found mid-fetch.
4. Files client threw plain `Error` → `ApiError`.
5. Timeout not proven by test → test spies `AbortSignal.timeout`, aborts the deadline and the caller.
6. Unit in wip commits / handoff in progress → this commit and this file.
7. Cancel mid-read untested → added.
8. fflate loaded up front → dynamic `import()` in the hook.
9. Unexpected errors rejected → resolve `{ kind: "error" }`.
10. DEPENDENCIES row stale after Q15 → reworded.
11. Older Safari (< 17.4, no `AbortSignal.any`) gets no per-file deadline; Cancel still works. Accepted, noted here.

## Notes for U3
- Call `useLibraryZip(orgId, orgCode)` (the grid already has `orgCode`). Map outcomes to ux copy:
  - `saved` → "Downloaded {saved} files", or partial "Downloaded {saved} of {total} files · {failedIds.length} couldn't be fetched." with **Try those {n} again** = `download(failedIds)`. Add "{links} YouTube link(s) left out…" when `links > 0`.
  - `noneFetched` → "Couldn't fetch any of these files. Try again later."
  - `nothingToZip` → only links/deleted/gone; ux has no exact row — pick copy (links copy covers the common case).
  - `tooBig` with numbers → "That's {size}, more than {limit} at once"; with `totalBytes: null` use copy without the size (needs a line in ux.md first).
  - `error` → "Couldn't reach the server. Nothing was changed." · Try again. `cancelled` → nothing.
  - `deleted` (retired, file swept) and `gone` (no longer this shop's) have no ux copy yet; add to ux.md before building.
- `progress !== null` is the Loading state ("Preparing your zip… {done} of {total} files", Cancel → `cancel()`); other actions wait on it.
- Q13 is still `decided`: the retry toast is U3's. Q4's client half is done.
- **Owner action before U3 ships:** add `"GET"` to the R2 bucket's CORS rule (OPERATIONS.md §4, Q14). Without it every zip is `noneFetched`.

## Resume (macOS)
```
source ~/.nvm/nvm.sh && nvm use 22
export DATABASE_URL=postgresql://$(whoami)@localhost:5432/bhendi_bazaar_ci
npx prisma generate && npx prisma migrate deploy
env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate
npm run test:integration
```
