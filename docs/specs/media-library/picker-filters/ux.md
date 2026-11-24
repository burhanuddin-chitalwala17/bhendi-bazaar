# UX — picker-filters

- **Status:** Signed off
- **Verified:** 2026-11-24
- **Prototype:** https://claude.ai/artifact/A3rngfrZXuCHNRTme36QSy (journey 3)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md)

## Journeys

**J1 — Fill a new product from this morning's shoot** (R1, R4, R6)
1. Product form → Photos → "From your library" → the picker opens on Photos.
2. **Filters** → Tag "Product", When "Today" → the button reads "Filters · 2" and the grid starts over.
3. Tap four tiles; each is ticked. Change Usage to "Not used"; the four stay ticked.

**J2 — Choose a styled shot's reference** (R6)
1. Styled shot → choose reference → picker → **Filters** → Tag "Reference".

**J3 — Filters leave nothing (goes wrong)** (R5)
1. Filters Tag "Reference", Came from "Cropped or made", When "Last week" → "Nothing matches these filters." → **Clear filters** → the full Photos tab returns.

## Screens

| Screen | Route / how reached | Spec ids |
|---|---|---|
| Library picker (changed) | Product gallery, video poster, styled-shot reference | R1–R6 |
| Filters panel inside the picker (new) | **Filters** on phone; inline from `md` | R1, R2 |

## State matrix — Library picker

| State | What the person sees | Copy | Action |
|---|---|---|---|
| First use | **Filters** with no count | "Filters" | Filters |
| Empty (library) | Existing empty line; no Filters button, there is nothing to filter | (existing) "No photos in your library yet." | — |
| Empty (filtered) | Search mark, line, button | "Nothing matches these filters." | Clear filters |
| Loading | Grid starts over with the existing loading tiles; panel stays open | — | — |
| Partial | n/a | — | — |
| Success | Filtered grid; chosen items still ticked | "Filters · {n}" | — |
| Retryable error | Existing load-more error | (existing) | Try again |
| Terminal error | n/a | — | — |
| Refused | n/a — the picker shows only this shop's library | — | — |
| Stale | Filters kept while the page is open; reset on reload (Q2) | — | — |
| Long content | n/a — fixed option labels | — | — |
| Many items | Paged as today | — | — |
| Slow | Existing load-more spinner | — | — |
| Tab without tags | On Videos and YouTube the Tag filter is hidden, and a tag already chosen is ignored there (and not counted) | — | — |
| Tab with one source | On Videos, Came from offers Uploaded and Cropped or made; on YouTube it is hidden, and a source chosen elsewhere is ignored there (Q7) | — | — |
| Filters kept on an empty tab | A filter chosen on another tab, then a tab whose library is empty: "Nothing matches these filters." until Clear filters shows the library's own empty line | (as Empty (filtered)) | Clear filters |
| Phone / tablet / desktop | Phone: **Filters** opens a panel above the grid. `md`: four selects inline beside the tabs | — | — |

## Copy deck

Filter labels and options reuse the Library page's existing words (`MEDIA_FILTERS_COPY`, `LIBRARY_FILTER_COPY`) so they cannot drift.

| Where | Text |
|---|---|
| Filters button | Filters · Filters · {n} |
| Filter labels | Tag · Usage · Came from · When (existing) |
| Options | All tags · Product · Reference; Used or not · In use · Not used; Anywhere · Uploaded · Cropped or made · Video link (existing) |
| Clear | Clear filters |
| Filtered empty | Nothing matches these filters. |

## Sign-off

Signed off by owner, 2026-11-24.
