# Handoff — media-library photos feature (master)

- **Updated:** 2026-11-25 — all units built and merged; waiting on the owner's phone walk
- **Planning branch:** `claude/gracious-gates-l2b7u5` (this file)
- **Status:** viewer and picker-filters Implemented and merged here. bulk U1 (`159397ca`), U2 (`6cbc01c6`) and U3 (`1a015fe3`) done and merged. Next: owner's phone walk, then `/bb-sdlc pr-finish` (owner confirmed R2 CORS GET on 2026-11-25).

## RESUME HERE (new account)

Nothing is scheduled any more; no session is running. To continue:

1. Open a session on `claude/media-library-build` and read `handoff/media-library-bulk-actions-u1.md`.
   - If its Status is not Done, say: "Resume the bb-build of media-library/bulk-actions unit 1 from
     handoff/media-library-bulk-actions-u1.md. Keep that handoff current; commit and push
     claude/media-library-build after every step. No PR, no force-push."
   - If it is Done (or the checkpoint never landed and the file is missing), start/redo U1 with:
     "Build unit 1 of the accepted feature media-library/bulk-actions by invoking the bb-build skill
     with media-library/bulk-actions unit 1." (Same standing rules.)
2. After U1: start bulk U2 from the same branch (`… unit 2`): fflate 0.8.3 pinned, buildZip,
   mediaFilesApiClient, useLibraryZip, DEPENDENCIES.md row, OPERATIONS.md CORS GET step.
3. After U2, **and only once `GET` is in the R2 bucket's CORS policy** (bucket → Settings → CORS →
   `"AllowedMethods": ["GET", "PUT"]`): start bulk U3 (`… unit 3`), selection mode. The ⤢ control
   hides in selection mode and the tick takes the top-left (already decided; see below).
4. After each unit: merge its finished commit into `claude/gracious-gates-l2b7u5`, take the unit's
   side of `Verified:` dates, run `npm run docs:index` for generated counts, run
   `env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate`, push.
5. When bulk U3 is done: the owner walks each spec's acceptance on a phone, then `/bb-sdlc pr-finish`.

Build sessions started on the new account load `.claude/settings.json` (from main `4fc858bf`), which
allows a plain `git push` to origin, so they push on their own.

Read this first if you are continuing from another account. Each build unit also keeps its own
`handoff/<unit>.md` **on its own build branch**, updated after every step; that file is the truth
about where that unit stopped.

## What the owner asked for

On the org Library ("photos") page: (1) download from the side sheet, (2) a full-screen viewer
that slides through the library, opened from a tile and from the sheet, (3) multi-select with
zip download, bulk retire and bulk tag, (4) the Library's filters inside the media picker.

## Where the plan lives (all Accepted, signed off by the owner 2026-11-24)

| Subfeature | Folder | Units |
|---|---|---|
| viewer | `docs/specs/media-library/viewer/` | U1 route · U2 sheet download · U3 slider |
| bulk-actions | `docs/specs/media-library/bulk-actions/` | U1 routes · U2 zip + fflate · U3 selection mode |
| picker-filters | `docs/specs/media-library/picker-filters/` | U1 (one unit) |

Each folder has spec.md, decisions.md, ux.md (prototype: https://claude.ai/artifact/A3rngfrZXuCHNRTme36QSy), trd.md.

## Owner decisions already made

- Zip, not separate files; limit **500 MB** per zip (bulk Q4).
- Viewer includes photos, hosted videos and YouTube links (viewer Q3).
- Bulk retire and tag included (bulk Q2).
- **R2 bucket CORS must allow `GET`** (bulk Q14) — owner adds it in Cloudflare
  (bucket → Settings → CORS Policy → `"AllowedMethods": ["GET", "PUT"]`). **Confirmed done by the owner 2026-11-25.**
  Bulk U3 must not ship before it.

## Branches

| Branch | Holds |
|---|---|
| `claude/gracious-gates-l2b7u5` | The accepted specs (commit `25fea199`) and this file |
| `claude/media-library-build` | The viewer → bulk chain, one unit after another |
| `claude/media-picker-filters` | Picker filters U1, independent |

## Build order and state

| # | Unit | Starts from | Branch | State | Session (account 1) |
|---|---|---|---|---|---|
| 1 | viewer U1 — download route | `claude/gracious-gates-l2b7u5` | `claude/media-library-build` | done, pushed `4676e522`, gate re-run green by master | `session_01Kc21QZt95tL4EJCVq7VQ7Q` |
| 2 | viewer U2 — sheet download | `claude/media-library-build` after 1 | same | done `69033278`, merged here | `session_01Kc21QWDFRJaaeEwD3Lgcq3` |
| 3 | viewer U3 — full-screen slider | after 2 | same | done `d160044e` (viewer Implemented), merged here | `session_01Kc21QZLqA5dbdePyBT5SPm` |
| 4 | bulk U1 — bulk routes | after 3 | same | done `159397ca`, merged here, gate re-run green by master | resumed on new account |
| 5 | bulk U2 — zip builder, fflate, OPERATIONS CORS step | after 4 | same | done `6cbc01c6`, merged here, gate re-run green by master | new account |
| 6 | bulk U3 — selection mode | after 5 **and** the owner's CORS change | same | done `1a015fe3`, merged here, gate and integration re-run green by master | new account |
| 7 | picker-filters U1 | `claude/gracious-gates-l2b7u5` | `claude/media-picker-filters` | done, pushed `9e24da09` (spec Implemented) | `session_01Kc21QZekBRwKqbeQZnEMFe` |

## Merged into this branch

Each finished unit is merged here at the commit it finished on, the gate re-run, then pushed:
viewer U1 `4676e522`, picker U1 `9e24da09`, viewer U2 `69033278`, viewer U3 `d160044e`, bulk U1 `159397ca`, bulk U2 `6cbc01c6`, bulk U3 `1a015fe3`. On a conflict, take the unit's side
of `Verified:` dates and run `npm run docs:index` for the generated counts.

## For bulk U3 (selection mode)

Viewer U3 asked where a tile's selection tick goes, since all four corners are taken. Already
decided in bulk-actions trd.md (UI approach) and the prototype: the ⤢ control is hidden in
selection mode and the tick takes the top-left. No new Q needed. The tile is
`src/components/org/media-library-tile.tsx`.

## Pushing

main (`4fc858bf`, `40041ed6`) now lets build sessions push their working branch. A session that
started before that change could not push until the owner typed "push" in it; sessions started
after it push on their own.

## Local setup (new account, macOS)

- Use Node 22 (`nvm use 22`); vitest fails on the default Node 20.
- Integration DB: Homebrew Postgres 14, `DATABASE_URL=postgresql://burhanuddin.c@localhost:5432/bhendi_bazaar_ci` (no `postgres` role).
- Worktrees: `../bhendi-bazaar-media-library-build`, `../bhendi-bazaar-gracious-gates`.

## Notes from bulk U1 for bulk U2

See `handoff/media-library-bulk-actions-u1.md`: `downloadLinks` returns `{ files: [{ id, url, filename, bytes }], noFile, totalBytes }`; `bytes` may be null, so `buildZip` checks real sizes while streaming; links last 900 s; the 422 carries `totalBytes`/`limitBytes` in `details`.

## Owner to confirm on the phone walk (from bulk U3)

See `handoff/media-library-bulk-actions-u3.md` for the A1–A5 walk. Claude-reversible calls for the owner: Q17 (retire confirm is `FormDialog`, a bottom sheet on phone; tag picker is `ResponsivePicker`, a popover from `md`), Q18 (desktop hover tick top-right, hides the use count on hover), Q19 (a later batch failing shows "Couldn't reach the server." alone), and the bar's buttons are natural width, not three equal (shared `SelectionBar`).

Local test DB: the drifted `bhendi_bazaar_ci` was renamed to `bhendi_bazaar_ci_old` (kept) and a clean one migrated; full integration suite green on `1a015fe3`.

## Notes from bulk U2 for bulk U3

See `handoff/media-library-bulk-actions-u2.md`. U3 calls `useLibraryZip(orgId, orgCode)`; outcomes `saved | noneFetched | nothingToZip | tooBig | error | cancelled`. U2 flagged states with no ux.md copy yet: `tooBig` with no size (limit hit mid-download), `deleted` items, `gone` items, `nothingToZip`.

## Notes from viewer U1 for viewer U2

- Use `orgMediaApiClient.canDownload` (HEAD; rejects `ApiError` with `.status` 404/410/422, no body), then navigate to `/api/org/${orgId}/media/${assetId}/download`. U2 adds an href helper to `orgMediaApiClient`.
- Server copy `DOWNLOAD_FILE_GONE` / `DOWNLOAD_NO_FILE_FOR_YOUTUBE` lives in `server/catalog/media-download.ts`; UI copy goes in `media-library-copy.ts`.
- viewer Q8 and Q10 stay `decided` until U2 ships their UI.
- In these containers run the gate as `env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate` (`open-shop-page` test fails otherwise; pre-existing).
- Integration DB: `service postgresql start`, `createdb bhendi_bazaar_ci`, postgres password `postgres`, `npx prisma migrate deploy`.

## Merge note from picker U1

`docs/ARCHITECTURE.md` test counts and `docs/specs/README.md` will conflict with the viewer/bulk branch; rerun `npm run docs:index` after merging.

## How to continue from another account

1. Fetch the branch of the unit you are resuming and read its `handoff/<unit>.md`.
2. If that unit is not Done, start a session on its branch and say:
   "Resume the bb-build of `<feature> unit <n>` from `handoff/<unit>.md`."
3. If it is Done, start the next unit in the table from the same branch with:
   "Build unit `<n>` of the accepted feature `<feature>` by invoking the bb-build skill with
   `<feature> unit <n>`. Keep `handoff/<feature-slug>-u<n>.md` current, commit and push to
   `<branch>` after every step. Do not open a PR."
4. Before starting a unit, run `npm ci`, `git fetch --unshallow`, and `npm run gate` on the
   branch to confirm the previous unit left it green.

## Rules every build session follows

- bb-build skill and CLAUDE.md: failing test per acceptance id first, `npm run gate`,
  bb-review in a fresh subagent, findings fixed.
- Push only its own build branch; no pull requests; no other branch.
- Keep `handoff/<unit>.md` current and pushed after every meaningful step, with work in
  progress committed (`wip(<unit>): …`), so a token cut-off loses nothing.
- Stop and report on an open decision or a check failing twice for the same reason.

## When everything is built

The owner walks each spec's acceptance list on a phone; then `/bb-sdlc pr-finish`; the owner
decides on the PR. Spec and TRD go to Implemented with `npm run spec:status` only then.
