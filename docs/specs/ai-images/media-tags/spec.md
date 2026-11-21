# Spec — ai-images/media-tags

- **Summary:** A library image carries one or more tags — product, reference — and the library filters by tag, by whether it is in use, and by where it came from
- **Status:** Draft
- **Domain:** catalog (media)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-21
- **References:** ux.md, trd.md, [../decisions.md](../decisions.md), [media-library](../../media-library/), [ADR-0058](../../../adr/0058-media-is-one-aggregate-a-derivative-is-lineage-not-a-use-and-usage-is-derived.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
A word or two on each picture saying what it is for, and a library that can show only those.

## Why
Reference pictures — a mood, a pose, a setting a seller likes — are about to enter the library
alongside product photographs. Without a way to tell them apart, a seller picking a gallery photo
wades through mood boards, and a seller picking a reference wades through 400 products.

## Requirements
- **R1** — Tags are a fixed list the platform declares: **Product** and **Reference** now, Social
  later. A seller picks from the list and never types a tag (Q21).
- **R2** — An image may carry several tags at once; it appears under each of them (Q21).
- **R3** — The library gains a **Tag** filter beside the ones it already has (kind, in use, where it
  came from, date, product, slot). The filters combine.
- **R4** — Whether an image is in use and where it came from stay what they are today: facts the
  platform works out, filtered on, never tags a seller sets.
- **R5** — On the day this ships, every shop image a product uses is tagged Product; an image no
  product uses stays untagged. Platform images (banners, category heroes) are untouched (Q22).
- **R6** — A seller can add or remove a tag on an image from its detail panel. An image with no tag
  is still in the library, under "All".
- **R7** — Putting an image into a product's gallery tags it Product; an upload made as a reference
  is tagged Reference; choosing a library image as a reference adds Reference to it. An upload from
  the library's own Upload button carries no tag (Q23, Q37).
- **R8** — Everything works on a ~360px phone.

## Product acceptance
- **A1** — On the day it ships, Product lists exactly the shop's images that some product uses; the
  rest show only under "All".
- **A2** — A photo tagged Product and Reference shows under both filters and once under "All".
- **A3** — Product + Not in use lists exactly the product photos no product, banner or listing uses.
- **A4** — Tag: Reference with Kind: Photos lists only reference photos, newest first.
- **A5** — Removing Product from an image leaves it in "All" and out of the Product filter.

## Scope
- **Outcome:** a seller finds the kind of picture they are after in a large library.
- **In:** R1–R8.
- **Later:** the Social tag, with the Instagram composer (parent Q27).

## Open questions
None.
