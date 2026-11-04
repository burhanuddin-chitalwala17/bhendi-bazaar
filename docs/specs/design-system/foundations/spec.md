# Spec — foundations

- **Summary:** Every screen's type, icons, motion and depth come from one refined system, sized for a phone first, so the platform stops reading as assembled from defaults
- **Status:** Draft
- **Domain:** cross-domain (front end)
- **Phase:** 13 — Design system
- **Verified:** 2026-11-04
- **References:** [../spec.md](../spec.md) (programme), [../decisions.md](../decisions.md), [trd.md](trd.md), [ADR-0065](../../../adr/0065-the-ui-is-built-in-tiers-and-every-icon-goes-through-one-seam.md), [ADR-0022](../../../adr/0022-design-decisions-go-through-tokens.md), [ADR-0049](../../../adr/0049-colour-is-a-primitive-palette-read-through-semantic-tokens.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
The ground every later subfeature stands on: a type scale, an icon voice, motion and depth, and the
rules that stop the next screen drifting from them.

## Why
Today a shopper's first impression is 9–10px uppercase labels, a generic stroke icon beside every
heading, and shadows and timings chosen per file. These are the cues people read as "template". They
are also why a redesign is a hundred-file edit: the decision lives at each call site, not in one place.

## Requirements
- R1 — Type has seven roles (display, headline, title, body, small, caption, label), each with a phone
  size and a desktop size (Q10). Phone sizes are smaller and tighter, never a desktop size squeezed down.
- R2 — No text renders below 11px. Uppercase is reserved for the label role, at most one run per section.
- R3 — Every icon on every surface comes through one icon component, named for its meaning (`bag`,
  `close`, `warning`), never for its drawing. Replacing a drawing changes one file.
- R4 — One meaning has one icon: success, warning, error, close and loading are each drawn one way.
- R5 — The store's icons are lighter than the portals'; a selected state is filled (Q11).
- R6 — An icon is either decorative (hidden from screen readers) or the only label of a control (which
  then carries a spoken name). Never both, never neither.
- R7 — A busy control shows the button's own busy state; no screen draws its own spinner.
- R8 — Motion has three speeds and two curves, and all of it stops for a person who asked for reduced motion.
- R9 — Depth has named levels (raised, lifted, overlay) whose shadows are drawn from the palette, so a
  dark or themed surface is not lit by black.
- R10 — The rules above are checked by the test suite, so the next screen cannot quietly break them.
- R11 — Pages paint no slower than today: no new layout shift, no larger first-load bundle for a shopper.

## Product acceptance
Judged on a 360px phone first, then a tablet and a desktop.
- A1 — On the home, product, cart and portal home pages at 360px, no text is smaller than 11px and the
  body copy is 15px; at desktop width body copy is 16px. (R1, R2)
- A2 — The same pages show Phosphor icons only, light in the store and regular in the portal. (R3, R5)
- A3 — Changing the drawing behind one icon name in one file changes it on every screen. (R3)
- A4 — Success, warning and error look the same on the order page, a portal form and an admin table. (R4)
- A5 — A screen reader announces each icon-only button by name and skips every decorative icon. (R6)
- A6 — Tapping Save on a slow connection shows the button's busy state, and a second tap sends nothing. (R7)
- A7 — With "reduce motion" on, nothing slides or fades. (R8)
- A8 — A test fails when an icon library is imported outside the icon component, or text is set below 11px. (R10)
- A9 — Lighthouse on the home and product pages, phone profile: layout shift and first-load script no
  worse than the measurement taken before the change. (R11)

## Scope
- **Outcome:** every screen's type and icons come from one system, at once.
- **In:** the type tokens and their adoption (R1, R2), the icon component and replacing every lucide
  import (R3–R7), motion and depth tokens (R8, R9), the gates (R10), the before and after measurement (R11).
- **Later:** redesigned layouts (page-grammar onward), the brand-drawn icons (Q2, brand-icons),
  Cache Components (Q8).

## Open questions
None.
