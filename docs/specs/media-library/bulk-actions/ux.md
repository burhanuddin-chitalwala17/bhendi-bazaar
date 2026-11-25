# UX — bulk-actions

- **Status:** Signed off
- **Verified:** 2026-11-24
- **Prototype:** https://claude.ai/artifact/A3rngfrZXuCHNRTme36QSy (journey 2)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), ../viewer/ux.md (`94a656e9:docs/specs/media-library/viewer/ux.md`)

## Journeys

**J1 — Send a supplier a shoot** (R1–R3)
1. Library → filter Tag "Product", When "Today" → tap **Select**.
2. Tap 12 tiles (or **Select all 24**). The bar reads "12 selected".
3. Tap **Download** → "Preparing your zip… 4 of 12 files" → the browser saves `<shopcode>-library-2026-11-24.zip`.
4. Toast: "Downloaded 12 files". Selection stays, so the seller can act again; **Done** leaves.

**J2 — Clear out rejects** (R4, R6)
1. Select 5 → **Retire**.
2. Dialog: "Retire 3 pictures?" and "2 more are still in use, so they'll stay. Filter by Usage: In use to find them." → **Retire 3**.
3. Toast: "Retired 3 pictures". The 3 leave the grid; the 2 stay ticked.

**J3 — Mark a shoot as references** (R5)
1. Select 4 photos and 1 video → **Tag** → sheet "Tag 4 photos".
2. Reference → **Add** → toast "Tagged 4 photos as Reference · 1 video left out (videos don't take tags)".

**J4 — Too big (goes wrong)** (R3, Q4)
1. Select 30 videos → **Download** → toast "That's 640 MB, more than 500 MB at once" / "Select fewer and download in two goes." Nothing starts.

**J5 — Connection drops mid-download** (R3, R6)
1. Two of twelve files fail → toast "Downloaded 10 of 12 files" / "2 couldn't be fetched." with **Try those 2 again**, which builds a second zip of only those.

## Screens

| Screen | Route / how reached | Spec ids |
|---|---|---|
| Library grid in selection mode (new mode) | **Select** above the grid | R1, R2 |
| Selection bar (new) | Appears in selection mode | R2–R6 |
| Retire confirm dialog (new) | **Retire** on the bar | R4 |
| Tag sheet (new) | **Tag** on the bar | R5 |

## State matrix — Library grid in selection mode

| State | What the person sees | Copy | Action |
|---|---|---|---|
| First use | **Select** sits right of the item count | "Select" | Select |
| Empty | **Select** hidden: nothing to select | — | — |
| Loading | Ticks persist across load-more; new tiles arrive unticked | — | — |
| Partial | n/a — selection itself never fails | — | — |
| Success | Ticked tiles ringed with a check | "{n} selected" | — |
| Retryable error | n/a — load-more's existing error | (existing) | — |
| Terminal error | n/a | — | — |
| Refused | n/a | — | — |
| Stale | A filter change leaves the mode and clears the selection | — | — |
| Long content | n/a | — | — |
| Many items | **Select all {loaded}** selects what is loaded, never more (Q8) | "Select all {n}" | — |
| Slow | n/a | — | — |
| Phone / tablet / desktop | Phone: tap ticks. `lg`: a tick also appears on tile hover and starts the mode | — | — |

## State matrix — Selection bar

| State | What the person sees | Copy | Action |
|---|---|---|---|
| First use | Bar with 0 selected | "Tap pictures to select them" | — |
| Empty | Action tapped with nothing selected | "Select a picture first." | — |
| Loading | Download building: progress bar and count; other actions wait | "Preparing your zip… {done} of {total} files" | Cancel |
| Partial | Some done, some left out — one toast names both | see copy deck | Try those {n} again (download) |
| Success | Toast; the grid re-reads | "Downloaded {n} files" · "Retired {n} pictures" · "Tagged {n} photos as {tag}" | — |
| Retryable error | Nothing changed | "Couldn't reach the server. Nothing was changed." | Try again |
| Terminal error | All files failed to fetch | "Couldn't fetch any of these files. Try again later." | — |
| Refused | Over the zip limit; all in use; all retired (for Tag/Retire) | see copy deck | — |
| Stale | An item retired elsewhere meanwhile: counted as left out | "{n} were already retired." | — |
| Long content | Counts only; no names | — | — |
| Many items | Up to 100 per Retire or Tag request (Q10); more is sent in batches, reported as one | — | — |
| Slow | Retire or Tag past 3 s: the action's button shows its spinner | — | — |
| Phone / tablet / desktop | Phone: bar floats above the bottom edge, three equal buttons. `md`: bar centred, max 480px | — | — |

## State matrix — Retire confirm dialog

| State | What the person sees | Copy | Action |
|---|---|---|---|
| First use | n/a | — | — |
| Empty | n/a — not opened with nothing retirable | — | — |
| Loading | **Retire {n}** pending | — | — |
| Partial | Some in use: second paragraph | "{m} more are still in use, so they'll stay. Filter by Usage: In use to find them." | — |
| Success | Dialog closes; toast | "Retired {n} pictures" | — |
| Retryable error | Dialog stays, error under the buttons | "Couldn't reach the server. Nothing was changed." | Retire {n} |
| Terminal error | n/a | — | — |
| Refused | All in use: no dialog, toast instead | "None of these can be retired" / "All {n} are still in use. Take them off the products that use them first." | — |
| Stale | One became used since the grid loaded: server skips it, toast counts it | "{n} turned out to be in use and stayed." | — |
| Long content | n/a | — | — |
| Many items | Numbers only | — | — |
| Slow | Button spinner | — | — |
| Phone / tablet / desktop | Centred dialog at every size | — | — |

## State matrix — Tag sheet

| State | What the person sees | Copy | Action |
|---|---|---|---|
| First use | n/a | — | — |
| Empty | No photos selected (only videos): no sheet, toast | "Only photos take tags. None of these are photos." | — |
| Loading | Tapped button pending | — | — |
| Partial | Non-photos or retired left out: subtitle, then toast | "{n} video(s) selected too. Videos don't take tags." | — |
| Success | Sheet closes; toast; grid re-reads | "Tagged {n} photos as {tag}" · "Removed {tag} from {n} photos" | — |
| Retryable error | Toast | "Couldn't reach the server. Nothing was changed." | Try again |
| Terminal error | n/a | — | — |
| Refused | All retired | "Retired pictures can only be downloaded." | — |
| Stale | n/a — add and remove are idempotent | — | — |
| Long content | n/a — two tags | — | — |
| Many items | Batched as Retire is | — | — |
| Slow | Button spinner | — | — |
| Phone / tablet / desktop | Bottom sheet on phone, side panel from `md` (the existing adaptive sheet) | — | — |

## Copy deck

| Where | Text |
|---|---|
| Enter mode | Select |
| Leave mode | Done |
| Select all | Select all {n} |
| Clear | Clear |
| Bar count | {n} selected |
| Bar, none | Tap pictures to select them |
| Actions | Download · Tag · Retire |
| Nothing selected | Select a picture first. |
| Zip progress | Preparing your zip… {done} of {total} files |
| Zip done | Downloaded {n} files |
| Zip, links left out | {n} YouTube link(s) left out. A link isn't a file. |
| Zip, too big | That's {size}, more than {limit} at once · Select fewer and download in two goes. |
| Zip, partial | Downloaded {ok} of {total} files · {n} couldn't be fetched. · Try those {n} again |
| Zip, none fetched | Couldn't fetch any of these files. Try again later. |
| Retire dialog title | Retire {n} pictures? |
| Retire dialog body | They leave the library now, and their files are deleted after thirty days. |
| Retire dialog, some used | {m} more are still in use, so they'll stay. Filter by Usage: In use to find them. |
| Retire confirm | Retire {n} |
| Retire, all used | None of these can be retired · All {n} are still in use. Take them off the products that use them first. |
| Retire done | Retired {n} pictures |
| Retire, turned used | {n} turned out to be in use and stayed. |
| Already retired | {n} were already retired. |
| Retired, not taggable/retirable | Retired pictures can only be downloaded. |
| Tag sheet title | Tag {n} photos |
| Tag sheet, non-photos | {n} video(s) selected too. Videos don't take tags. |
| Tag row buttons | Add · Remove |
| Tag done | Tagged {n} photos as {tag} · Removed {tag} from {n} photos |
| Tag, no photos | Only photos take tags. None of these are photos. |
| Server unreachable | Couldn't reach the server. Nothing was changed. · Try again |

## Sign-off

Signed off by owner, 2026-11-24.
