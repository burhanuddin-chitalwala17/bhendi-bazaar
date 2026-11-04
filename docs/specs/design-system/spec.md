# Spec — design-system (overview)

- **Summary:** The store, the seller portal and the admin feel designed rather than assembled: one type scale, one icon voice, one page grammar, phone first and deliberate at tablet and desktop
- **Status:** Draft
- **Domain:** cross-domain (front end)
- **Phase:** 13 — Design system
- **Verified:** 2026-11-04
- **References:** [decisions.md](decisions.md), [foundations](foundations/), [ADR-0066](../../adr/0066-the-ui-is-built-in-tiers-and-every-icon-goes-through-one-seam.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md), [ADR-0031](../../adr/0031-one-components-home-organised-by-domain.md), [ADR-0049](../../adr/0049-colour-is-a-primitive-palette-read-through-semantic-tokens.md), [ADR-0050](../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md)

> The parent of eight subfeatures. Each has its own spec, decisions, UX and TRD; this file holds only
> what they share and their order. Every decision, with who made it, is in decisions.md.

## What this is
A revamp of how every screen looks and behaves, built on the layers that already exist (palette →
semantic tokens → bridge → primitives → shared composites → domain composites → layouts → pages).

## Why
The platform works but reads as assembled from defaults: a generic icon set imported straight into
~209 files, 9–10px tracked-out uppercase labels as house style, a gradient box where a photograph
should be, three page-header systems, four ways of drawing a table, and each loading, empty and error
state built anew per screen. A shopper judges a store's trustworthiness from exactly these cues before
reading a word, and a seller judges whether the tool is worth learning the same way. The aim is not
parity with the leaders in Indian fashion commerce but to be calmer and clearer than them on a phone.

## The rules every subfeature follows
- **Keep the brand, refine it (Q3).** Emerald, parchment and gold, and the serif, used with restraint:
  one accent per screen, photography over gradient boxes, no decoration standing in for content.
- **Phone first for shoppers, then deliberate at tablet and desktop (Q5).** Every screen is designed
  at ~360px, then `md:` and `lg:` are designed, not stretched. A screen with no tablet design is not done.
- **Type is smaller and tighter on a phone, never enlarged (Q6).** Each role has a phone size and a
  desktop size; nothing below 11px; uppercase only for a single short label.
- **Icons speak one voice and can be replaced in one place (Q1, Q2).** Fewer icons, each with a job.
- **Two of everything is a defect.** A screen reuses the page grammar; a new variant is a decision.
- **Fast is part of the design (Q7).** Server-rendered by default, streamed where a part is slow,
  the largest image preloaded, nothing laid out twice.

## Subfeatures, in order
Each is one outcome, ships alone, and needs the one before it.
1. **foundations** — the type scale, the icon seam on Phosphor, motion and elevation tokens, the tier
   rules and their gates. Visible result: every screen's type and icons change at once.
2. **page-grammar** — one page header, sticky action bar, empty, error and loading state, tabs with
   counts, status badge, and a list that is a table on desktop and rows on a phone.
3. **storefront-journey** — home, category and search (sort, filter, count), product page (docked
   price, delivery and returns by the button), cart and checkout (errors only after an attempt), order page.
4. **seller-workspace** — the products list rebuilt for a phone with bulk edits, the top bar, orders.
5. **admin-console** — grouped navigation, a dashboard led by one figure and its trend, dense tables.
6. **brand-icons** — 6–10 icons drawn for the brand by Claude, approved by the owner (Q2).
7. **image-slots** — one picture field with a phone and a desktop version, crop or fit, for admin banners, shop banners and storefront photos (Q24).
8. **render-performance** — Cache Components and partial prerendering, after the other session's caching lands (Q8).

## Open questions
See decisions.md.
