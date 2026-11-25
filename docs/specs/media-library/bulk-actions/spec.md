# Spec — bulk-actions

- **Summary:** A seller selects many library items at once and downloads them as one zip, retires them, or tags them
- **Status:** Implemented
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-24
- **References:** [../spec.md](../spec.md) (media-library R6, R7), [decisions.md](decisions.md), ux.md, trd.md, [viewer](../viewer/), ai-images/media-tags (`planning-archive-2026-11-25:docs/specs/ai-images/media-tags/`), [ADR-0032](../../../adr/0032-records-people-authored-are-retired-not-deleted.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

Today every Library action is one item at a time: open, act, close, repeat. This lets a seller select many items and act on them together — download, retire, or tag.

## Why

A shop's library grows by the shoot, not by the photo: twenty shots of a new arrival, of which five are kept. Sending a supplier a set, clearing out the rejects, or marking a shoot as references means twenty round trips through the side sheet. That is the moment a seller gives up on the library and goes back to their phone's gallery.

## Requirements

- **R1** — The Library has a selection mode. In it, a tap on a tile selects or deselects it instead of opening the side sheet, and a selected tile is plainly marked. Leaving the mode clears the selection.
- **R2** — The seller can select every item loaded under the current filters in one action, and clear the selection in one action. The count selected is always shown.
- **R3** — Download saves every selected file as one zip, each file the original under the same name a single download gives it ([viewer](../viewer/) R5). YouTube links are not files and are left out; the seller is told how many were left out and why.
- **R4** — Retire retires every selected item that nothing uses, after one confirmation that says how many. Items still in use are left as they are, and the seller is told how many and that the Usage filter finds them. Retiring many follows every rule retiring one does.
- **R5** — Tag adds or removes a tag on every selected photo. Videos and links carry no tags and are left out, and the seller is told so.
- **R6** — An action on a selection reports its outcome as a whole: how many succeeded, how many were left out and why. A partial failure never leaves the seller unsure which items changed — the grid shows the result.
- **R7** — Retired items, shown with "Show retired", can be selected for download only; Retire and Tag say on tap why they do not apply to them.
- **R8** — Only members of the shop act on its library; a selection can never reach another shop's items.

## Product acceptance

Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).

- **A1** — In selection mode, a tap ticks a tile and does not open the sheet; leaving the mode clears every tick. (R1)
- **A2** — "Select all" ticks every loaded tile and the bar shows the count. (R2)
- **A3** — Downloading 12 photos and 1 YouTube link saves one zip of 12 originals and says 1 link was left out. (R3)
- **A4** — Retiring 5 items, 2 of them used on a product, retires 3 and says 2 are still in use. (R4, R6)
- **A5** — Tagging 4 photos and 1 video as "Reference" tags the 4 and says the video was left out. (R5, R6)
- **A6** — A request naming another shop's asset changes nothing. (R8)

## Scope

- **Outcome:** A seller can act on many library items at once.
- **In:** selection mode (R1, R2); zip download (R3); bulk retire (R4); bulk tag (R5); outcome reporting (R6, R7); scoping (R8).
- **Later:** selection that spans pages not yet loaded (Q8); bulk crop or improve (Q9).

## Open questions

None open.
