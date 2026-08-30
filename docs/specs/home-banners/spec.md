# Home banners

**Verified:** 2026-08-30

## Problem

The storefront hero is three banners hard-coded in `src/lib/home-banners.ts`. Changing a
campaign — new artwork, new copy, a different order, taking one down for Eid — is a code
edit and a deploy. The platform owner cannot do it, and the person who can is not the
person who decides what the shop is selling this week.

## Who it is for

The platform owner, working in `/admin`. Not org members: the home hero is the platform's
own shelf space, and an org's promotion of its own products is what offers already are.

## What they can do

- **Create a banner** with a headline, an optional eyebrow and description, and an
  optional background image.
- **Upload the image and be told what size to bring.** The required dimensions are stated
  on the field before the file picker opens, and a file that is too small or the wrong
  shape is refused with the number it should have been.
- **Add up to two calls to action**, each a label and a destination, one of which may be
  the quieter outlined treatment.
- **Order the banners.** The order is what the shopper sees, first to last.
- **Take a banner down without deleting it** — an inactive banner keeps its copy and its
  artwork for the next time the same campaign runs.

## What they cannot do, deliberately

- **Schedule.** No start or end date. A campaign that must go live at midnight is a
  reason to build scheduling; wanting it in principle is not, and an unset date field is
  a worse answer than no field.
- **Choose colours or layout.** The banner takes the storefront's tokens. A per-banner
  palette is how a shop stops looking like one shop.

## Rules

- A banner needs a title. Everything else may be empty.
- With no image, the banner renders the brand gradient scene rather than a blank box.
- **Every banner is the same box on screen**, whatever its copy — height is fixed and the
  text is clamped, because a rail that changes height as it advances reads as broken.
- An inactive banner is invisible to the storefront and still listed in admin.
- With no active banners, the hero renders nothing. The homepage is still a shop.

## Done when

The owner can add, edit, reorder, deactivate and delete a banner in `/admin/banners` and
see the result on the storefront without a deploy.

The hero starts empty in a fresh environment. The three banners hard-coded today are
development copy, not the owner's, so they are not carried across — the first banner on
the shop is one the owner wrote.
