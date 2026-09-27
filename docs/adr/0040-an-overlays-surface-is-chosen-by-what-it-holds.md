# ADR-0040: An overlay's surface is chosen by what it holds, not by what was easiest to reach for

- **Date:** 2026-09-27
- **Status:** Accepted
- **Context:** [ADR-0016](0016-mobile-app-shell.md) made the bottom sheet the phone's dialog, and it was the right call: a centred, zoom-animated dialog inset by a rem a side is wrong at 360px. `SheetContent` then grew a `side="adaptive"` so one component could serve both screens, and from there the sheet became the answer to every overlay — a country list, a date range, a crop canvas, a before-and-after comparison, a picker grid. On a phone each of those is right. On a laptop the same code opens a 24rem panel against the right edge: a two-month calendar is cramped in it, a crop canvas is unusable, a three-up grid shows one and a half tiles, and picking "India" from a list slides a whole panel in. The platform had one overlay and four jobs, and the job stopped choosing.
- **Decision:** The surface follows the content, and each surface carries its own phone form so a component never chooses between screens.
  1. **A picker** — choosing one value from a set, where the field stays the subject — is a **popover anchored to its field** from the desktop breakpoint and a **bottom sheet** below it. `ResponsivePicker` is that pair; a country, a date range, a status, a category goes through it.
  2. **A task with a canvas** — cropping, comparing a before and an after, choosing from a grid of pictures — is a **centred dialog sized to its content** from the breakpoint and a **full-screen sheet** below it. `TaskDialog` is that pair.
  3. **The details of a selected item**, where the list must stay visible and selection can move, is a **side panel**: `SheetContent side="adaptive"` as it is.
  4. **A short flow the page hands off to** — signing in, writing to support — stays a sheet on both screens. It is a passage, not a place.
  5. **Filters and per-row controls are inline.** An overlay to change a filter hides the thing being filtered.
  6. **`SheetContent` is not imported outside those primitives and the four surfaces named above**, and `tests/unit/overlay-surfaces.test.ts` fails a new import. A surface that belongs in none of these cases is a decision, recorded by adding it here.
- **Alternatives considered:**
  - *Leave it: one adaptive sheet everywhere.* The conventional answer for a mobile-first codebase and the cheapest to maintain — one primitive, one set of behaviours. Rejected because it is mobile-first read as mobile-only: the desktop form of every overlay was a consequence of the phone's, never a choice, and four screens were worse for it.
  - *Choose per component, with no rule.* What was happening. It produces exactly this drift, and the review that would catch it has nothing to check against.
  - *A single `Overlay` component with a `variant` prop.* One import, four behaviours. Rejected: popover and dialog are different primitives with different focus, anchoring and escape behaviour, and a prop that switches between them hides which one a screen actually gets.
  - *Desktop-first dialogs with a phone breakpoint.* Rejected outright: [ADR-0015](0015-mobile-first-design.md) stands, and every pair here is defined from its phone form up.
- **Consequences:**
  - ✅ A field's picker opens where the field is, a canvas gets the room it needs, and neither is a compromise struck for the other screen.
  - ✅ The choice is reviewable: a pull request can be asked which of four cases this is.
  - ⚠️ One more package — Radix's popover, sibling of the dialog already in use — and two more primitives to learn before writing an overlay.
  - ⚠️ A component that wants a fifth shape has to argue for it here rather than reaching for the sheet, which is the cost this record is buying.
