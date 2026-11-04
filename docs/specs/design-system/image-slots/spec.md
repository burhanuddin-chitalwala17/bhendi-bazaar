# Spec — image-slots

- **Summary:** One picture field and one renderer give every banner and storefront photo a phone and a desktop version, cropped or fitted to the shape each place declares
- **Status:** Accepted
- **Domain:** catalog (banners, storefront slots, media assets), front end
- **Phase:** 13 — Design system
- **Verified:** 2026-11-04
- **References:** [../spec.md](../spec.md) (programme), [../decisions.md](../decisions.md) Q24, [trd.md](trd.md), [ADR-0026](../../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0058](../../../adr/0058-media-is-one-aggregate-a-derivative-is-lineage-not-a-use-and-usage-is-derived.md), [ADR-0065](../../../adr/0065-storefront-reads-are-shared-across-requests-and-cleared-by-the-tables-a-write-touches.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
Admins upload separate phone and desktop versions of a home banner; shops do the same for their own
banners and storefront photos. Each place that shows a picture declares its phone and desktop shape;
the same field and the same renderer serve every one of them (Q24).

## Why
Today a banner is one picture at one 5:2 shape. On a 360px phone the hero keeps only its middle ~55%,
so words drawn into the artwork are cut and the subject is small. A picture slightly off the shape is
refused outright, and the person uploading has no say in what is kept.

## Requirements
- R1 — Every place that shows a picture declares, once, its desktop shape, its phone shape and the
  smallest width that will not look soft. Home banner: desktop 5:2, phone 4:5.
- R2 — The uploader may add a desktop version, a phone version, or both. Each is optional on its own.
- R3 — When a picture is off its shape, the uploader chooses: **Keep it exact** (crop to the shape,
  dragging to choose what stays) or **Fit it in** (show the whole picture, edges filled with a colour
  taken from it, which they may change).
- R4 — With no phone version, phones show the desktop picture cut to the phone shape around a focus
  point the uploader picks.
- R5 — Before saving, the uploader sees the result at 1280, 834 and 390 wide.
- R6 — A visitor's phone downloads only the phone picture, a desktop only the desktop one, each at the
  size its slot is drawn.
- R7 — A shop can only use pictures from its own library. The server checks every choice again: the
  shape of a crop, that it lies inside the picture, and the fill colour.
- R8 — Every banner that exists today keeps rendering exactly as before, without anyone re-uploading.
- R9 — A picture in use as a phone version counts as used in the media library: it cannot be retired
  from under a banner.

## Hazards (named so the TRD cannot skip them)
- H1 — A crop measured on a downscaled preview stored as pixels of the original lands in the wrong place.
- H2 — An asset id inside JSON is invisible to a foreign key and to the library's usage query (R9).
- H3 — A shop pasting another shop's picture URL would publish a picture it does not own (R7).
- H4 — A shared cached storefront read that starts joining a new table goes stale (ADR-0065).

## Product acceptance
Judged on a 360px phone first, then a tablet and a desktop.
- A1 — An admin uploads a 1600×660 desktop picture, chooses Keep it exact, drags, saves; the desktop
  hero shows the chosen part. (R3)
- A2 — The same banner with a 4:5 phone version shows the phone picture on a 360px phone and the desktop
  one at 834 and above; the phone does not download the desktop file. (R2, R6)
- A3 — Without a phone version, a focus point on the right keeps the right of the picture on a phone. (R4)
- A4 — Fit it in shows the whole picture with edges in a colour from it. (R3)
- A5 — A shop cannot save a banner with another shop's picture; it is told why on the field. (R7)
- A6 — Banners saved before this change still render, unchanged. (R8)
- A7 — A picture used only as a phone version is listed as in use and cannot be retired. (R9)

## Scope
- **Outcome:** every banner and storefront photo can have its own phone picture, cropped or fitted.
- **In:** the slot declarations (R1), the field (R2–R5), the renderer (R6), home banners, shop banners
  and storefront photos (R7–R9).
- **Later:** category heroes (the admin category form, its own pass); a stored cropped file for a
  surface that cannot draw a crop with CSS (email, a marketplace feed).

## Open questions
None — Q24 decided the behaviour; the TRD records the technical choices.
