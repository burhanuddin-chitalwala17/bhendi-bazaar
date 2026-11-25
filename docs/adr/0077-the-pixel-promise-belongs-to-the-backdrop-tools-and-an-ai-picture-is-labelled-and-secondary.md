# ADR-0077: The pixel promise belongs to the backdrop tools; an AI picture is kept, labelled and never a marketplace's main image

- **Date:** 2026-11-21
- **Status:** Accepted. Amends [ADR-0059](0059-an-enhancement-never-changes-the-products-pixels-proven-before-encoding.md) (its scope)

## Context

ADR-0059 made "an enhancement never changes the product's pixels" a tested property, and every
enhancement until now could keep it: a backdrop is painted around our own cut-out, which is pasted
back and compared with zero tolerance. The owner now wants a picture of the product worn by a person
in a real setting (ai-images (`planning-archive-2026-11-25:docs/specs/ai-images/`), Q28). No image model can do that while keeping the
product's pixels: the cloth must fold around a body and take the setting's light. Read as written,
ADR-0059 forbids the feature; quietly ignoring it would make its test a lie for one tool.

## Decision

1. **ADR-0059's promise is the backdrop tools' promise.** White, studio and scene keep it unchanged:
   cut-out pasted back, zero-tolerance comparison before encoding.
2. **The AI tool (`STYLED`) promises something else, and says so:** the result is shown to the shop
   with the original one tap away and the words "AI-made picture — check the product looks right";
   it is labelled AI-made where it is stored (its transform names the tool); and it is **never a
   marketplace's main image** — `server/channels/listing-photos-out.ts` moves it behind a real
   photograph and refuses a listing with none.
3. **Fidelity is checked by the shop, not assumed.** The modal tells the shop what helps; a
   model's refusal is never routed around (ADR-0076).

## Alternatives considered

- **Keep ADR-0059 for every tool and refuse styled pictures.** The conservative choice. Rejected by
  the owner: a product shown worn sells what a cut-out cannot, and the shop sees and chooses every result.
- **Apply a tolerance for the AI tool** (a perceptual distance between the product region and the
  photo). Rejected for now: there is no product region to compare once the product is worn, and a
  number nobody can justify is the failure ADR-0059 named. A model that judges fidelity is parked (Q9).
- **Allow an AI picture as the main image where a marketplace permits it.** Rejected: Amazon's 2026
  policy already restricts AI people to secondary slots, and a main image is what a buyer trusts most.

## Consequences

- ✅ The backdrop tools' test still means exactly what it said.
- ✅ An AI picture can be found and treated differently anywhere it travels, by its transform.
- ⚠️ A styled picture can misdraw a stitch or a logo; the shop is the check, and the label says so.
