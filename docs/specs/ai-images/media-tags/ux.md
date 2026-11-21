# UX — ai-images/media-tags

- **Status:** Signed off 2026-11-21 (Q31)
- **Verified:** 2026-11-21
- **Prototype:** [published](https://claude.ai/artifact/U3bdiGkYPCKfZdbaihLAE5) · source [../prototype.html](../prototype.html) — journeys 9–10
- **References:** [spec.md](spec.md), [../decisions.md](../decisions.md), `src/components/org/media-library-grid.tsx`, the library page's filters

## Screens
| Screen | Where | Change | Serves |
|---|---|---|---|
| Library filters | `/org/{id}/library` | A **Tag** select (All · Product · Reference) first in the row | R3 |
| Photo detail panel | Library → a photo | A "Tags" row of chips; tap a chip to toggle | R2, R6 |
| Grid tile | Library grid | A small "Reference" badge on reference-only images | R2 |

## Journeys
9. **Find references.** Library → Tag: Reference → grid of reference photos → tap one → panel shows
   Tags: [Product] [✓ Reference].
10. **Retag a photo.** Panel → tap **Product** to switch it off → toast "Removed tag Product" → still in
   "All", gone from Tag: Product.

## Copy (exact)
- Filter label "Tag" · options "All tags" · "Product" · "Reference"
- Panel row label "Tags" · chip `aria-pressed` states · toasts "Added tag {t}" / "Removed tag {t}"
- Tile badge "Reference"

## State matrix — library with Tag filter
| State | What the person sees | Action |
|---|---|---|
| First use | Photos a product uses under Product (the migration); the rest untagged | — |
| Empty | Tag: Reference with none: EmptyState "No reference pictures yet. Add one when you improve a photo with AI." | — |
| Loading | Today's grid skeleton | — |
| Partial | n/a | — |
| Success | Filtered grid, today's paging | — |
| Retryable error | Tag toggle failed: chip returns to its state, toast "Couldn't change the tag" | Tap again |
| Terminal / Refused | Retired image: chips read-only | — |
| Stale | n/a — server rendered | — |
| Long / Many / Slow | Today's grid behaviour | — |

## Decisions confirmed at sign-off
- **U7** — Uploads from the library's own Upload button carry no tag (Q37).
