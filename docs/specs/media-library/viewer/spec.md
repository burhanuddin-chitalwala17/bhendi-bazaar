# Spec — viewer

- **Summary:** A seller opens any library item full screen, swipes through the rest of the library, and saves the original to their device
- **Status:** Accepted
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-24
- **References:** [../spec.md](../spec.md) (media-library R6), [decisions.md](decisions.md), ux.md, trd.md, [bulk-actions](../bulk-actions/), [ADR-0027](../../../adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The Library shows every picture as a square tile, and the side sheet shows it as a square too. A seller cannot see a photograph whole, cannot flick through their pictures the way they would in their phone's gallery, and cannot get a picture back onto their phone to send on WhatsApp. This gives the Library a full-screen viewer and a download.

## Why

The library is where a shop's photographs live, and a shop judges a photograph by looking at it whole — the square crop hides exactly the edges a seller is checking. And a picture that went in has to be able to come out: a seller shares product photos with customers and suppliers outside the platform every day.

## Requirements

- **R1** — Any item in the Library opens in a full-screen viewer that shows it whole, at its own proportions, never cropped to a square.
- **R2** — The viewer is reached two ways: a full-screen control on each grid tile, and a "View full image" action in the item's side sheet. Both open the viewer on that item.
- **R3** — In the viewer, the seller moves to the next and previous item by swiping on a phone and by arrows or keys on a larger screen. The order is the grid's order under the filters in force, and reaching the end of what is loaded brings in more, as scrolling the grid does.
- **R4** — Photographs can be zoomed and panned in the viewer. Hosted videos play in it; YouTube links play in it as they do in the side sheet.
- **R5** — The seller can save an item to their device from the side sheet and from the viewer. A photograph or hosted video is saved as the original file the shop put in, not a resized copy, under a name that says which shop and which picture it was.
- **R6** — A YouTube link is not a file the platform holds. Where download is offered for one, it says so and offers to open the video on YouTube instead.
- **R7** — Download and viewing are open to every member of the shop, as the Library is. Nothing outside the shop's own library can be fetched through them.

## Product acceptance

Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).

- **A1** — A portrait photo tapped full-screen from its tile shows top to bottom, uncropped. (R1, R2)
- **A2** — From the side sheet, "View full image" opens the viewer on the same item. (R2)
- **A3** — With 30 photos filtered to "Product photo", swiping from the first walks the same 30 in grid order, loading past the first page without a stop. (R3)
- **A4** — A pinch zooms a photograph; a hosted video plays; a YouTube link plays. (R4)
- **A5** — Download from the sheet or the viewer saves the original file, its name beginning with the shop's code. (R5)
- **A6** — Download on a YouTube link explains why and offers "Open on YouTube". (R6)
- **A7** — A member of another shop cannot download this shop's picture by its id. (R7)

## Scope

- **Outcome:** A seller can see any library item whole and keep a copy of it.
- **In:** the viewer and its two ways in (R1–R4); single-item download (R5–R7).
- **Later:** downloading many at once — [bulk-actions](../bulk-actions/); the viewer on other surfaces (Q6).

## Open questions

None open.
