# Spec — own-store/storefront-look

- **Summary:** Every storefront template shares the platform's type scale, spacing and category size, opens on a first phone screen that is never bare, and shows banners in full colour with no shade over them
- **Status:** Accepted — 2026-11-13
- **Domain:** catalog (storefront), front end
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-11-13
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [spike.md](spike.md), [storefront-themes](../storefront-themes/spec.md), [storefront-font](../storefront-font/spec.md), [ADR-0015](../../../adr/0015-mobile-first-design.md), [ADR-0022](../../../adr/0022-design-decisions-go-through-tokens.md), [ADR-0064](../../../adr/0064-a-storefront-theme-is-a-token-set-and-a-section-composition-declared-in-code.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
The four storefront templates (Edge, Darbar, Bloom, Daily) keep their style and lose their outsized
proportions. Titles, shop names and prices follow the platform scale; the top of every store is full of
the shop's goods; banners are vivid.

## Why
The owner opened Niqab Boutique (Bloom, blush) and saw a product title five lines tall in bold serif,
an oversized price, and a store hero that was mostly empty pink. Shops share these links on WhatsApp;
a buyer on a phone must see goods on the first screen, not one giant word. Full-image banners look
grey because a dark shade covers them, which hides the very photograph a shop is proud of.

## Requirements
- R1 — Every template uses the platform's type sizes for every role (headline, title, body, price,
  label). A template may change face, weight, case and letter-spacing; never size.
- R2 — Every template uses the same section spacing, page gutter, page width and grid gap.
- R3 — On a product page inside a store, the title and price are no larger than the platform's
  product page shows them, in the template's own face.
- R4 — On a ~360×740 phone, a store's first screen shows the shop's identity, one picture, and the
  start of either its categories or its products. Nothing on it is an empty area.
- R5 — On desktop, the hero area holds the picture and goods or categories side by side; no column is
  left empty.
- R6 — No photograph is covered by a shade. Text that belongs to a picture sits beside or below it, or
  on a small solid label.
- R7 — Categories are the same size in every template: compact tiles or circles, several to a screen.
  Darbar's full-screen tiles go.
- R8 — The templates, their palettes, section order and product card styles stay. A shop sees its
  store improve without choosing anything.
- R9 — A store with no photo, one product or no categories still has no empty area (storefront-themes
  R10, unchanged).

## Product acceptance
- A1 — Niqab Boutique's product page on a 360px phone: the title is at most three lines and the price
  one line, at platform size, in every template.
- A2 — Each template's store home on a 360×740 phone shows identity, picture, and categories or
  products above the fold.
- A3 — The same store at 1280px shows no empty column beside the hero.
- A4 — A bright banner photo is shown at its own colours; no part of it is darkened.
- A5 — Darbar shows at least four categories on one phone screen and six on desktop.
- A6 — Swapping templates on the same shop moves no text size and no section spacing; only faces,
  colour, shape and order change.

## Scope
- **Outcome:** a shop's store looks proportionate, full and vivid in whichever template it uses.
- **In:** R1–R9 across the landing page, shop page, product card and product page title/price.
- **Later:** font choice per shop ([storefront-font](../storefront-font/spec.md)); the marketplace's
  own home banner (Q9); a shop-arranged hero (Q10).

## Open questions
None.
