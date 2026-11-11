# Spec — image delivery

- **Summary:** Images are stored small and served at the size the screen uses
- **Status:** ✅ Implemented — PR-105
- **Domain:** catalog (identity for avatars)
- **Phase:** 2 — Operability
- **Verified:** 2026-09-16
- **References:** `431ed6e7:docs/specs/image-delivery/trd.md`, [ADR-0026](../../adr/0026-images-are-delivered-through-the-optimizer.md), [ADR-0017](../../adr/0017-video-is-embedded-not-hosted.md), [bulk-catalog-upload](../bulk-catalog-upload/)

> Requirements and product approach only. Technical approach lives in `431ed6e7:docs/specs/image-delivery/trd.md`.

## What this feature is
Images are stored at a size worth storing and served at the size the screen actually uses, so that showing the catalogue costs a fraction of what it did and cannot quietly exhaust the hosting allowance again.

## Why
The store ran out of its monthly image-transfer allowance before it had any customers. On the plan we are on, running out does not produce a bill — it produces a blank catalogue, because the host stops serving the files rather than charging for them. So the thing standing between the store and every product image disappearing was a quota nobody was watching.

Two costs were being paid for the same mistake. A phone loading a category page was downloading roughly seven megabytes to show twelve thumbnails the size of a postage stamp — slow, and expensive for a buyer on mobile data, which is most of them. And the store was paying for all of it against a fixed monthly allowance.

None of it was visible. Every page looked correct, every image appeared, and the only symptom was a number on a dashboard. That is the part worth fixing properly: not just the bandwidth, but the fact that the mistake could be made three separate times over nine months without anything objecting.

## Requirements
- **R1** — A page requests images at the size it will display them, not at the size they were uploaded.
- **R2** — What is stored is bounded. An image uploaded from a phone camera is reduced before it is kept, so the worst case is a known size rather than whatever the device produced.
- **R3** — R2 holds on **every** route by which an image can be uploaded, including the ones where the file never passes through our server.
- **R4** — Reducing an image never fails an upload it could have completed. A file that cannot be read differently is refused with a message; a file already small enough is left alone.
- **R5** — An image already stored keeps working, at its existing address. Nothing is rewritten and no link changes.
- **R6** — A picture just chosen for upload is shown from the copy already in the browser, not fetched back from storage.
- **R7** — Photographs keep their orientation. A reduced image is not rotated relative to what the person uploading it saw.
- **R8** — Making this mistake again fails the build, naming the file. This is a requirement, not a nicety: the three causes were each invisible on screen, and two of them were introduced *while fixing something else*.
- **R9** — An exception to R1 is possible — some renderers cannot use the mechanism, and a local preview has nothing to optimise — but an exception must carry its reason, and must stop being an exception when it is no longer needed.
- **R10** — Whoever operates the store can see this allowance being consumed before it runs out, and knows which meter to look at.

## Hazards this must address
Named here so the technical approach cannot skip them.

- **H1 — Two upload paths, one budget.** Bulk upload sends files straight from the browser to storage, deliberately, because a large photograph will not fit through a server function. Any reduction implemented only on the server therefore misses the single largest source of images. A budget enforced on one path and not the other is not a budget.
- **H2 — Declaring the display size is optional, and its absence is silent.** The mechanism that sizes an image defaults to "as wide as the screen" when not told otherwise. A thumbnail with no size declared therefore downloads a full-width image and looks perfectly correct doing it — the original mistake, wearing the new mechanism's clothes.
- **H3 — A stated size can be wrong.** Enforcement can check that a size is declared; it cannot check that the number is honest. An overstated size passes every automated check and costs exactly as much as declaring nothing.
- **H4 — Suppressing the mechanism looks like a fix.** Two of the three original causes were introduced by someone making a broken image render correctly. The suppression worked, on screen, and moved the cost to a meter they were not looking at. Whatever replaces it must make the trade visible at the point it is made.
- **H5 — The second meter.** Sizing images on demand consumes its own separate allowance. Fixing the first quota by leaning entirely on a mechanism governed by a second one substitutes a new failure for the old one unless the results are cached and the new meter is named in the runbook.
- **H6 — Local development spends the live allowance.** Development reads the same stored files as production, so the work of diagnosing this consumes the thing being diagnosed.
- **H7 — Stored images are already large.** This changes what is written from now on. The existing files stay as they are, and anything that assumes otherwise — a cleanup script, a storage estimate — is reasoning from the wrong premise.
