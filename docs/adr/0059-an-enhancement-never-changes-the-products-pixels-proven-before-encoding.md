# ADR-0059: An enhancement never changes the product's pixels, proven before encoding

- **Date:** 2026-10-05
- **Status:** Accepted

## Context

[Image enhancement](../specs/image-enhancement/) lets a shop put a photographed product on a clean backdrop or into a scene. The product promise is that the *product* in the picture is untouched — a buyer who sees a colour or a stitch in the enhanced image sees what the camera saw. A hosted model generates the surroundings, and a model can quietly repaint an edge, shift a hue, or smooth a texture while doing so.

The TRD's D4 made the promise a test rather than a hope, and D7 kept the store out of the judgement. Both shipped on 2026-09-29 (`server/content/tools/pixel-identity.ts`, `server/content/channel-rules.ts`). The conventional alternative — compare with a tolerance, or trust the model's mask — is what every reviewer will suggest the first time the strict check refuses a result that "looks fine".

## Decision

1. **Pixel identity is a zero-tolerance comparison, run before the result is encoded.** The cut-out's fully opaque pixels are compared to the same region of the composed result; a single differing pixel fails the run. Partially transparent edge pixels were blended with the backdrop and are not the product, so they are excluded by opacity, not by distance.
2. **The comparison happens on raw pixels, not on the encoded file.** Encoding is lossy; comparing after it would either fail every run or force a tolerance that hides real changes.
3. **The proposal is an object, not an asset.** An enhancement run produces a proposal the shop accepts or declines; only an accepted proposal becomes a derived asset ([ADR-0058](0058-media-is-one-aggregate-a-derivative-is-lineage-not-a-use-and-usage-is-derived.md)). A refused or failed run leaves no media behind.
4. **The channel image rule is asked only at time of use, and the store never asks it.** `channel-rules.ts` is one pure function over a declared table of what each channel asks of a photograph. The store accepts whatever the shop has; the rule is advice shown when a channel is in view, in the spirit of [ADR-0053](0053-readiness-advises-and-never-gates.md).

## Alternatives considered

- **A tolerance** (per-channel distance, a percentage of differing pixels). What every image-diff tool defaults to. Rejected: the question is not "does it look the same" but "is it the same product"; a tolerance is a number nobody can justify to a buyer, and it moves every time a model improves.
- **Trust the model's mask.** Faster. Rejected: the mask is the model's claim about its own work; the comparison exists because that claim is sometimes wrong.
- **Compare after encoding.** Simpler pipeline. Rejected by decision 2.
- **Gate uploads on the channel rule.** Rejected: a photograph that fails Amazon's long-edge minimum is still a fine storefront photograph; refusing it at upload loses the image for every other use.

## Consequences

- ✅ "The product is untouched" is a tested property of every accepted enhancement, not a marketing claim.
- ✅ A model host can be swapped behind the provider seam without weakening the promise, because the check is ours.
- ⚠️ Strictness costs runs: a model that repaints one edge pixel fails. The failure is recorded on the proposal with its reason, and the shop can try again or keep the original.
