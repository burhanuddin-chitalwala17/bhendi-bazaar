# Spec — picker-filters

- **Summary:** The library picker filters by tag, usage, source and date, as the Library page does
- **Status:** Implemented
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-24
- **References:** [../spec.md](../spec.md) (media-library R6), [decisions.md](decisions.md), ux.md, trd.md, [ai-images/media-tags](../../ai-images/media-tags/)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The picker — the dialog a seller uses to choose a library picture for a product gallery, a video's poster, or an AI styled shot's reference — shows the whole library by kind and nothing else. This gives it the filters the Library page already has.

## Why

The picker is where the library is actually used, and it is where finding the right picture matters most: a seller choosing a reference wants their references, and one filling a new product wants the shoot they uploaded this morning, not to scroll past two hundred older photos to find it.

## Requirements

- **R1** — The picker filters by tag, by usage (all, used, unused), by source (uploaded, cropped or made, video link) and by the date added, with the same choices and words the Library page uses.
- **R2** — Filters combine with the kind tabs the picker already has. A filter that cannot apply to the tab in view (a tag on a video) is not offered on that tab.
- **R3** — The filters belong to the picker, not the page underneath: choosing one never changes the page's address or the Library page's own filters.
- **R4** — Changing a filter starts the grid over and keeps what is already chosen in the gallery marked as chosen.
- **R5** — When filters leave nothing to show, the picker says the filters are why and offers to clear them in one tap.
- **R6** — Every surface that opens the picker gets the filters: the product gallery, a video's poster, and the styled shot's reference.

## Product acceptance

Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).

- **A1** — In the product gallery's picker, Tag "Product photo" and Usage "Unused" show only unused product photos. (R1)
- **A2** — On the Videos tab, no Tag filter is offered. (R2)
- **A3** — Filtering in the picker leaves the page's URL unchanged. (R3)
- **A4** — A photo already in the gallery stays ticked after a filter change. (R4)
- **A5** — A filter with no matches shows "Nothing matches these filters" with "Clear filters". (R5)
- **A6** — The poster picker and the styled-shot reference picker both show the filters. (R6)

## Scope

- **Outcome:** A seller finds the library picture they want inside the picker.
- **In:** the four filters (R1, R2), picker-local state (R3, R4), the empty state (R5), all three callers (R6).
- **Later:** search by product name (Q4).

## Open questions

None open.
