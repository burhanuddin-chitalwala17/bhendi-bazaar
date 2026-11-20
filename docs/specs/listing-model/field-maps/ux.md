# UX — listing-model / field-maps

- **Status:** Signed off (2026-11-07); change for parts signed off 2026-11-20 (decisions Q23)
- **Verified:** 2026-11-20
- **Prototype:** none (parent Q34); this document is the reference
- **References:** [spec.md](spec.md), [decisions.md](decisions.md)

> The admin's view of how each channel field is filled. Read and edit only: Claude makes the
> defaults (parent Q23). Buttons are never disabled (ADR-0053).

## Journeys
1. **See why a field is filled the way it is.** Admin → Channels → Amazon → TOTE_BAG → the field list
   → a row shows its source and the reason, with the documentation it was checked against.
2. **Change a map.** Tap a row → choose another source (a product question, a rule, a core field, a
   shop setting, a fixed value) → for a choice, pair any unpaired answers → Save → "Saved. Every Tote
   bag uses it from now on."
3. **A channel added a field.** Home or the type page shows "Amazon added 2 fields to TOTE_BAG" → each
   is unmapped until mapped; a field nothing can fill shows "Needs a developer · requested".
4. **A field made of parts.** Admin → Channels → Amazon → RUG → "Item Dimensions L x W" shows "In parts: length,
   width" and one line per part, each "Not mapped" until mapped → Map a part → choose Length (a measure) and its
   unit → Save → "Saved. Every RUG uses it from now on." The whole field offers no Map of its own (decisions Q23).

## Screens
| Screen | Route | Reached from | Serves |
|---|---|---|---|
| Channel types | `/admin/channels/{channel}` (changed) | Admin → Channels | R6 |
| Field maps for a type | `/admin/channels/{channel}/{type}` (new) | a type row | R1, R3, R4, R6 |

## State matrix — Field maps for a type
| State | What the admin sees | Action |
|---|---|---|
| Normal | One row per field: label, Required / Conditional / Optional, source ("From product: Colour", "Rule: from Audience", "Fixed: Adult", "Name", "Filled by the system"), and a reason line | Tap a row to change |
| Unmapped | "Not mapped" in amber on that row | Map it |
| Needs a developer | "Needs a developer · requested" | — |
| Unpaired answers | "3 answers have no Amazon match" under the row; each pair chosen from the channel's list, or "No match" | Pair them |
| Waiting on a question | "Waiting on a new question; fills nothing yet" under a map naming a question not built yet (decisions Q17, 2026-11-08) | Change |
| A field in parts | Under the field's label, "In parts: {part}, {part}"; then one line per part: "{Field} · {part}" with its source, or "Not mapped" in amber. No whole-field Map. A whole-field map made before this shows "Can't fill a field in parts. Map each part instead." in amber, with no Change: mapping any part removes it, for every type of ours; a field the create fills itself stays "Filled by the system" (2026-11-20, built; was: with Change, which the server's refusal of a whole-field save would only fail) | Map each part |
| Changed by the channel | A row marked "New · added 7 Nov" | Map it |
| Saved | Toast "Saved. Every {type} uses it from now on." | — |
| Loading / slow | Skeleton rows | — |
| Retryable error | "Couldn't save that. Nothing was changed." | Try again |
| Long content | Labels and reasons wrap | — |
| Many items | Required first, then conditional, then optional; search by field name | — |
| Phone / tablet / desktop | Rows on every width, each opening its edit in place (decisions Q16, 2026-11-08; was: a table from `md:`) | — |

## Copy deck
"From product: {attribute}" · "Rule: {rule}" · "Fixed: {value}" · "{core field}" · "Filled by the system" ·
"Not mapped" · "Needs a developer · requested" · "{n} answers have no {channel} match" · "Pair them" ·
"Checked against {source}, {date}" · "In parts: {parts}" · "{Field} · {part}" · "Map {part}" ·
"Can't fill a field in parts. Map each part instead." · "Waiting on a new question; fills nothing yet" · "No match" · "Saved. Every {type} uses it from now on." · "Couldn't save that. Nothing was changed."

## Sign-off
Signed off by the owner, 2026-11-07 ("signed off"), as documents in place of prototypes (parent Q34).

The change for fields in parts (journey 4, "A field in parts", its copy) signed off by the owner, 2026-11-20 ("signed off").
