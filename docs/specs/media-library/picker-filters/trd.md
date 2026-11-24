# TRD — picker-filters

- **Status:** Accepted
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-24
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0048](../../../adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md), [ADR-0067](../../../adr/0067-words-live-in-copy-modules-and-our-own-paths-in-one-routes-table.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

The server already filters the picker's fetch. `GET /api/org/:orgId/media` parses the same `mediaLibraryFilterSchema` the page does, and `useMediaLibraryPages` takes a query string. The picker only sends `kind=…`. So this change is client-side only: it adds filter state to the picker, builds the query from it, and shares the filter fields with the Library page so the words and choices cannot drift.

## Prior art

None — no new model.

## Technical decisions

- **D1 — One set of filter fields, two hosts.** The Tag, Usage, Came from and When controls move out of `MediaLibraryFilters` into `MediaFilterFields` (new `media-filter-fields.tsx` in `src/components/org/`). That component is controlled and takes `value`, `onChange`, `kinds`, `sources` and an `omit` list. The Library page's form wraps it with its URL behaviour, which is unchanged. The picker wraps it with local state. *Rejected:* a second copy inside the picker. Two lists of the same options are how "Came from" and "Source" drift apart.
- **D2 — Options are named by the caller, as today.** The page passes `KIND_OPTIONS` and `SOURCE_OPTIONS` built from the Prisma enums on the server. The picker is a client component and cannot import those enums. So the option lists move to `media-library-copy.ts` keyed by the mirrored string values, with a `satisfies Record<MediaAssetSource, …>` mirror check in the same style as `MEDIA_TAG`. Both hosts then read one list.
- **D3 — Picker state is local and survives closing (Q2).** `usePickerFilters` (new `usePickerFilters.ts` in `src/hooks/product/`) holds `{ tag, usage, source, from, to }`. It sits in the `MediaLibraryPicker` component, which stays mounted while its host is open: the page for the product gallery, the asset's sheet for the poster, the styled-shot dialog for the reference. Reopening keeps the filters, and a reload or closing the host resets them. Nothing touches the router.
- **D4 — The query.** `pickerQuery(kind, filters)` is pure, in a new `picker-query.ts` under `src/lib/media/`. It builds the string `useMediaLibraryPages` already accepts. It leaves blanks out, never sends `retired` (Q3), drops `tag` when `kind` is not `IMAGE` (R2, Q6), and drops a `source` the kind cannot hold (Q7). `PickerPages` is keyed on that string, so a filter change remounts it and the grid starts over (R4). The ticks come from `taken`, which the caller owns, so they survive the remount unchanged.
- **D5 — The count on the button** is the number of filters that apply to the current tab. A tag chosen and then hidden on Videos is not counted (Q6).
- **D6 — Filtered-empty versus library-empty.** `PickerPages` shows the existing "No photos in your library yet." only when the query has no filters. Otherwise it shows "Nothing matches these filters." with Clear filters (R5), which resets the hook.
- **D7 — All three callers get it for free (R6).** The product gallery (`product-media-manager.tsx`), the poster picker (`media-library-grid.tsx`) and the styled-shot reference (`styled-shot-dialog.tsx`) all render `MediaLibraryPicker`, and the change is inside it. A caller passes no new prop.

## Packages

None.

## UI approach

Screens, states and copy are as in [ux.md](ux.md).

- **Per form factor (ADR-0050).** Phone (base): a **Filters · n** button at the end of the tab row toggles a panel above the grid with the four fields stacked. The panel's open state is local to the dialog. `md:` drops the button and renders the four fields inline beside the tabs. `lg:` is the same as `md:`.
- **Rendering.** The picker is already a client component. Nothing server-side changes.
- **Behaviour.** No new request. `useMediaLibraryPages` and `orgMediaApiClient.page` are unchanged.
- **Surfaces.** Inside the existing `TaskDialog`. The fields use the `Select` primitive and `DateRangeField`, as the page does. No new overlay and no new token.
- **Copy.** It reuses `MEDIA_FILTERS_COPY`. New strings are `filtersButton`, `clearFilters` and `nothingMatches` in `LIBRARY_PICKER_COPY` (`src/components/product/media-copy.ts`). The picker's inline "Photos", "Videos", "YouTube", the default description and the load-more nouns move into that copy module in the same change, because the suite fails on inline words in a file it touches (ADR-0067).

## Gates touched

- `labelled-controls`: each field keeps its visible label.
- `form-factors`: the phone button and the `md:` inline row.
- `file-cohesion`: `media-library-picker.tsx` stays under the limit by delegating to `MediaFilterFields`.

## Data model

None.

## API / contract changes

None. The route and its schema are unchanged.

## Test plan

Per [TESTING.md](../../../TESTING.md).

- **Unit.** `pickerQuery`: blanks left out, `retired` never sent, `tag` dropped off the Photos tab (A2), dates passed as day keys.
- **Component.**
  - Choosing Tag and Usage fetches with both (A1).
  - The router is never called (A3).
  - A taken ref stays pressed after a filter change (A4).
  - The filtered-empty state clears (A5).
  - The Library page's form still writes the same URL as before, which is the regression check for D1.
- **Acceptance.** A1–A6 on a phone by the owner, through all three callers.

## Delivery (PRs)

1. **U1 — Picker filters** (`independent`, sharing no file with the viewer or bulk units). Covers D1–D7: the shared fields, the copy moves, the hook, the query, the button and panel, and the empty state. Changes behaviour.

## Open questions

None open.
