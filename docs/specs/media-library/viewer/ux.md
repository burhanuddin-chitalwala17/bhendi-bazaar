# UX — viewer

- **Status:** Signed off
- **Verified:** 2026-11-24
- **Prototype:** https://claude.ai/artifact/A3rngfrZXuCHNRTme36QSy (journey 1)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md)

## Journeys

**J1 — Look at a photo whole, from the grid** (R1–R4)
1. Library → tap the ⤢ control at the top-left of a tile.
2. The viewer opens on that item, at its own shape, with the counter "5 of 48".
3. Swipe left or right; neighbours peek at both edges and the thumbnail strip follows.
4. Pinch to check sharpness. Tap ✕; the grid is where it was, scrolled to the item last shown.

**J2 — From the side sheet** (R2, R5)
1. Library → tap a tile (anywhere but ⤢) → the side sheet opens.
2. Tap "View full image" → the viewer opens on the same item. Closing it returns to the sheet.
3. Or tap "Download" → the browser saves `<shopcode>-<id>.jpg`.

**J3 — Download a YouTube link (goes wrong by design)** (R6)
1. In the viewer on a YouTube link, tap Download.
2. A note: "This video lives on YouTube, so there's no file to download." → "Open on YouTube" opens it in a new tab.

**J4 — Download fails** (R5)
1. Tap Download with the connection down.
2. A toast: "Couldn't download" with "Try again". Nothing half-saved is left behind.

## Screens

| Screen | Route / how reached | Spec ids |
|---|---|---|
| Library grid (changed: ⤢ on each tile) | `/org/<id>/library` | R2 |
| Side sheet (changed: View full image, Download) | tile tap | R2, R5 |
| Viewer (new, full-screen overlay) | ⤢ on a tile, or View full image | R1, R3, R4, R5, R6 |

## State matrix — Library grid (changed parts only)

| State | What the person sees | Copy | Action |
|---|---|---|---|
| First use | n/a — an empty library shows no tiles, so no ⤢ | — | — |
| Empty | Unchanged empty card | (existing) | — |
| Loading | Unchanged; ⤢ appears with its tile | — | — |
| Partial | n/a — nothing is acted on here | — | — |
| Success | n/a | — | — |
| Retryable error | n/a — the grid's existing load-more error | (existing) | — |
| Terminal error | n/a | — | — |
| Refused | n/a — viewing is open to every member (R7) | — | — |
| Stale | n/a — the grid already re-reads after every change | — | — |
| Long content | n/a — the control is an icon | aria "View full screen" | — |
| Many items | ⤢ on every tile; it costs nothing until tapped | — | — |
| Slow | n/a | — | — |
| Phone / tablet / desktop | 22px control at every size, inside a 44px touch target | — | — |

## State matrix — Side sheet (changed parts only)

| State | What the person sees | Copy | Action |
|---|---|---|---|
| First use | n/a | — | — |
| Empty | n/a | — | — |
| Loading | Both buttons usable at once; they need nothing from the detail fetch | — | — |
| Partial | n/a | — | — |
| Success | Browser's own download; no toast of ours | — | — |
| Retryable error | Toast | "Couldn't download" / "Check your connection and try again." | Try again |
| Terminal error | Toast (retired file already deleted) | "This file was deleted thirty days after it was retired." | — |
| Refused | Toast (not this shop's) | "This picture isn't in your library." | — |
| Stale | n/a | — | — |
| Long content | Buttons wrap under the preview | — | — |
| Many items | n/a | — | — |
| Slow | Download button shows its pending spinner until the file starts | — | — |
| Phone / tablet / desktop | Unchanged sheet; buttons in one row from `sm` | — | — |

## State matrix — Viewer

| State | What the person sees | Copy | Action |
|---|---|---|---|
| First use | n/a — it opens on an item that exists | — | — |
| Empty | n/a — reached only from a tile | — | — |
| Loading | The tile's own thumbnail, enlarged, until the full image arrives | — | — |
| Partial | n/a | — | — |
| Success | The item whole; counter; strip; Download | "5 of 48" | Swipe, ✕, ⓘ, Download |
| Retryable error | Image failed to load: a muted panel in its place | "Couldn't load this picture." | Try again |
| Terminal error | Video FAILED: its frame dimmed and the reason | "This video couldn't be processed: <reason>" | Download still offered |
| Refused | YouTube download note (J3) | "This video lives on YouTube, so there's no file to download." | Open on YouTube |
| Stale | n/a — reads the grid's own list | — | — |
| Long content | A panorama or a tall strip fits inside the frame, letterboxed | — | — |
| Many items | The strip scrolls; reaching the last loaded item loads the next page, with a spinner slide | — | — |
| Slow | Next page slower than 3 s: the spinner slide stays; swiping back still works | — | — |
| Processing video | Its frame (or a film mark) and a note | "Still processing" / "This video will play here once it's ready. It usually takes a minute or two." | — |
| Last item | Tapping › at the end | "That's the last one." | — |
| Phone / tablet / desktop | Phone: swipe, 28px peeks, no arrows. `md`: arrows appear. `lg`: larger neighbours, ← → and Esc, wheel zoom | "← → to move, Esc to close" (lg only) | — |

## Copy deck

| Where | Text |
|---|---|
| Tile control (aria) | View full screen |
| Sheet button | View full image |
| Sheet / viewer button | Download |
| Viewer counter | {n} of {total} |
| Viewer close (aria) | Close |
| Viewer details (aria) | Details |
| Viewer arrows (aria) | Previous · Next |
| Viewer hint, lg | ← → to move, Esc to close |
| Last item | That's the last one. |
| Download failed | Couldn't download · Check your connection and try again. · Try again |
| Retired file gone | This file was deleted thirty days after it was retired. |
| Not this shop's | This picture isn't in your library. |
| YouTube download | This video lives on YouTube, so there's no file to download. · Open on YouTube |
| Image load failed | Couldn't load this picture. · Try again |
| Processing | Still processing · This video will play here once it's ready. It usually takes a minute or two. |
| Failed video | This video couldn't be processed: {reason} |

## Sign-off

Signed off by owner, 2026-11-24.
