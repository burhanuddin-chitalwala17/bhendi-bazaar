# Spec — image-enhancement

- **Summary:** A phone photo becomes a marketplace-grade image on demand — cut out, on white, on a studio backdrop, in a scene, brightened, or enlarged — each a tool applied alone, each result a proposal the org accepts or discards
- **Status:** 🔨 In progress — PR-185, PR-190, PR-191, PR-193 (4 of 5)
- **Domain:** content (enhancement), reading catalog (assets); runs on the worker
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-28
- **References:** [trd.md](trd.md), [media-library](../media-library/) (R3, R8, D6, D11), [renditions](../media-library/renditions/), [worker-foundation](../worker-foundation/), [ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0028](../../adr/0028-images-live-in-cloudflare-r2.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

An org member picks a photograph in a gallery slot or the library and asks for one improvement: cut the product out, put it on pure white, put it on a plain studio backdrop, place it in a real-looking scene, fix its light, or make it larger. The work runs in the background; the result comes back as a before-and-after the member accepts or discards. An accepted result is a new image in the library that remembers what it was made from; the original is never touched.

## Why

Good photography is the small seller's largest handicap ([media-library](../media-library/spec.md)). A marketplace's main image must sit on pure white at a minimum size; an Instagram post wants the product in a place a buyer can imagine it; a phone in a shop produces neither. Each of these is a repeatable operation a service can perform in seconds for less than a paisa to a few rupees, and the worker exists to run exactly this kind of work ([ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)).

## Requirements

- **R1** — Six tools, each applied on its own: **cut out** (the product alone, on nothing), **white** (on pure white, padded to a square), **studio** (on a plain colour or soft gradient with a shadow), **scene** (in one of a fixed set of real-looking settings), **light** (exposure and sharpness corrected), **enlarge** (made large enough for any marketplace). A result can itself be given to another tool, so the member composes; the platform never bundles.
- **R2** — Enhancement runs only on demand: from a slot in the product editor, from the library, and at the moment an image is put to a channel. Nothing is enhanced automatically.
- **R3** — A result is a proposal, and running for it is what costs. Asking for an improvement spends one of the month's runs whether the member keeps it or not, because the service has already been paid by the time the proposal is on the screen; the sheet says so before a tool is chosen, never after. Only a run that failed outright is not charged. The member sees before and after — a toggle, or a swipe on a phone — and accepts or discards. Only an accepted result enters the library, as a derived image pointing at its source ([media-library R3](../media-library/spec.md)). A discarded one leaves no trace.
- **R4** — A scene is painted around the product, never over it. The product region of a scene result is the org's own cut-out, pixel for pixel; no service is trusted to keep a logo's letters or a bottle's shape.
- **R5** — The label slot is never enhanced. It is evidence to be read later, and the capture checks' warnings on it stay advice.
- **R6** — Nothing here blocks saving a product. A photograph below a channel's minimum size is blocked from *that channel* at the moment of use, with the tool that fixes it — enlarge, or white — offered right there. The same offer is made earlier, from the capture warning on the photograph itself: a warning that only names the problem leaves the member with no next step, so the warning carries the improvement that answers it, and carries none where no tool does ([media-library R8](../media-library/spec.md)). The store itself never blocks.
- **R7** — Every org has a monthly allowance of enhancements. The org sees its use; the platform owner sees every org's use and spend; a platform-wide daily spend cap stops all enhancement when reached; and the platform owner can pause enhancement for any one org, and lift the pause. **Both numbers are the platform owner's to change from the admin screen, without a deploy** — they are what the first provider bill will argue with, and waiting for a release to answer it is the wrong shape. An organisation records only a **deviation**: a different allowance, or a pause. An org that is exactly the platform's number holds nothing of its own, so changing the platform's number moves it too.
- **R8** — Which service performs a tool is the platform's choice and can change without the org noticing. Before a service is chosen for a tool, the same real photographs go through each candidate and the outputs are compared side by side.
- **R9** — Every run records its tool, its service and its cost. Cost is integer paise ([Invariant 3](../../../CLAUDE.md)).
- **R10** — A run that fails says so where it was asked for, with the reason and a retry, and applies nothing partway.
- **R11** — Scene settings are a fixed list — a wooden table by a window, a marble counter, a shop shelf, a fabric drape, plain studio colours — chosen by the platform owner. An org picks from the list and never types a description.
- **R12** — Everything works on a ~360px phone: choosing a tool, waiting, comparing, accepting.

## Product acceptance

- **A1** — From a dark photo's warning, the member taps "improve", picks **light**, waits under a minute, compares, accepts; the slot now shows the brighter image and the library shows both, the new one pointing at the old.
- **A2** — **White** on a product photo yields a square on RGB 255,255,255 with the product centred and unchanged; Amazon's main-image check would pass it.
- **A3** — **Scene** with "wooden table by a window": the product's pixels in the result are identical to the cut-out's; the shadow and light look like the table's.
- **A4** — An 800px photo saves on a product without complaint; putting it to Amazon is refused with "smaller than 1000px — enlarge it?"; **enlarge** yields a 1600px image that passes.
- **A5** — An org at its monthly allowance is told so, by the number that actually applies to it, and can still save products; the platform owner pauses an org and its members see "enhancement is paused for your shop"; lifting it restores the tools and leaves the org carrying no rule of its own.
- **A6** — Twenty real photographs through two cut-out services produce a side-by-side sheet the owner chooses from; switching the choice changes no screen.
- **A7** — The label slot offers no tool; every other slot offers all six.
- **A8** — A discarded proposal appears nowhere afterwards and cost what one run costs, no more.

## Out of scope (this feature)

- Photoroom and any service with a monthly floor — not at this stage.
- An upscaler that reconstructs detail. **Enlarge** is a plain resize and always will be: a service that invents pixels the camera never saw changes the product's own appearance, which is the one thing this feature promises it will not do (R4). Refused on fidelity, not deferred on cost.
- Automatic enhancement of every upload, and batch enhancement of a catalogue.
- Free-text scene prompts for orgs.
- Reading the label — [listing-schema](../listing-schema/) and [product-form](../product-form/).
- Composing the Instagram post itself — [instagram-post](../instagram-post/); a scene result is its input.
- Video.
