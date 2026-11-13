# Spec — own-store/storefront-font

- **Summary:** A shop picks the font its store's headings are set in, from a short curated list, for whichever template it uses; sizes stay the platform's
- **Status:** Accepted — 2026-11-13
- **Domain:** catalog (storefront), front end
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-11-13
- **References:** [decisions.md](decisions.md), [ux.md](../storefront-look/ux.md) (shared with storefront-look), [storefront-look](../storefront-look/spec.md), [storefront-themes](../storefront-themes/spec.md), [ADR-0064](../../../adr/0064-a-storefront-theme-is-a-token-set-and-a-section-composition-declared-in-code.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
In Storefront → Look, a shop chooses the font for its shop name, headings and product titles, from a
short list that suits its template. The template's own font is the default.

## Why
Shops asked to look like their own brand, and a typeface carries a brand more than any colour. The
owner wants that choice without the risk of an absurd font or a page that breaks the platform's sizes.
ADR-0064 answered "no" to a shop's own font; this feature changes that answer, for headings only.

## Requirements
- R1 — A shop may choose one heading font for its store from a curated list of at most eight, each
  readable at phone size and with Latin and the ₹ sign.
- R2 — The choice applies to text that names something: the shop name, section titles, product names
  on cards and the product page, page titles, banner and offer titles, and category names. Prices,
  descriptions, reviews, buttons, chips, labels and navigation stay in the template's own faces (Q2).
- R3 — Sizes never change with the font: the platform's type scale holds (storefront-look R1).
- R4 — Each template shows the fonts that suit it first, marked "Suggested", and its own font as
  "Template default". Every font on the list is offered with every template.
- R5 — The shop sees its own store in the chosen font before publishing it, as it does a template.
- R6 — Changing template keeps the chosen font if it is on the list; resetting returns to the
  template's default.
- R7 — No buyer's page fetches a font from a third party; a store downloads only the faces it shows.

## Product acceptance
- A1 — On a phone, a shop opens Look, taps Font, picks one, sees the preview redraw, publishes, and the
  live store shows headings in it.
- A2 — The same store's title and price sizes are identical before and after the change.
- A3 — "Use template default" restores the template's face.
- A4 — A store with a chosen font downloads that face and the template's body face, nothing else.

## Scope
- **Outcome:** a shop's headings are set in a font it chose from a safe list.
- **In:** R1–R7: the list, the picker in Look, the preview, publishing, the store reading it.
- **Later:** a body-font choice (Q3); fonts outside the list on request (Q4); non-Latin scripts (Q5).

## Open questions
None.
