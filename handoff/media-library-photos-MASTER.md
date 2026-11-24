# Handoff — media-library photos feature (master)

- **Updated:** 2026-11-24 19:30 UTC
- **Planning branch:** `claude/gracious-gates-l2b7u5` (this file)
- **Status:** Building — viewer U1 and picker U1 running

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
  (bucket → Settings → CORS Policy → `"AllowedMethods": ["GET", "PUT"]`). **Not yet confirmed done.**
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
| 1 | viewer U1 — download route | `claude/gracious-gates-l2b7u5` | `claude/media-library-build` | running | `session_01Kc21QZt95tL4EJCVq7VQ7Q` |
| 2 | viewer U2 — sheet download | `claude/media-library-build` after 1 | same | waiting | — |
| 3 | viewer U3 — full-screen slider | after 2 | same | waiting | — |
| 4 | bulk U1 — bulk routes | after 3 | same | waiting | — |
| 5 | bulk U2 — zip builder, fflate, OPERATIONS CORS step | after 4 | same | waiting | — |
| 6 | bulk U3 — selection mode | after 5 **and** the owner's CORS change | same | waiting | — |
| 7 | picker-filters U1 | `claude/gracious-gates-l2b7u5` | `claude/media-picker-filters` | running | `session_01Kc21QZekBRwKqbeQZnEMFe` |

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
