# Spec — ai-images (overview)

- **Summary:** A seller describes how a product photo should look, adds a few reference pictures, and gets a styled image made by whichever AI model the platform has chosen, paid from the shop's credit at exactly what it cost
- **Status:** Accepted
- **Domain:** content, with catalog (media), subscriptions and payouts
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-21
- **References:** [decisions.md](decisions.md), [image-enhancement](../image-enhancement/), [media-library](../media-library/), [org-payouts](../org-payouts/), [INTEGRATIONS.md](../../INTEGRATIONS.md#image-generation-cloudflare-ai-fal), [ADR-0037](../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md), [ADR-0059](../../adr/0059-an-enhancement-never-changes-the-products-pixels-proven-before-encoding.md)

> The parent of four subfeatures. Each has its own spec, UX and TRD; this file holds only the
> model they share and their order. Every decision, with who made it, is in decisions.md.

## What this is
An **Improve** button with two halves. The main half asks an AI model for a new picture of the
product, styled the way the seller describes, using reference pictures the seller chooses. The
arrow keeps today's six exact tools. The seller pays for AI pictures from a credit balance the
platform keeps, at the platform's own cost.

## Why
Today's tools make a photograph clean; they cannot make it attractive. A seller with no studio and
no model cannot show an abaya worn, or a bag in a café. Models can now do that for a few rupees,
but every one of them sometimes changes the product, and prices and quality move monthly. So the
platform must be able to change model without changing code, must let the seller judge every
result, and must charge exactly what it spent.

## The model every subfeature follows
- **One pipeline, any provider (Q5, Q6).** Every AI picture goes through one interface. A provider
  is an adapter; a model is an entry. Which model runs is the platform's setting (Q12).
- **The seller is the fidelity check (Q25).** Nothing AI-made is kept until the seller says so,
  and the original is always one tap away.
- **Exact tools keep their promise (Q1, Q28).** White, studio and scene still never change the
  product's pixels; only the AI tool may, and its results are marked as AI-made.
- **Money is a ledger (Q2, Q15, Q17).** Credit in, charges out, every line with its proof or its
  cost; the balance is the sum. Free tools stay free (Q16).

## Subfeatures, in order
1. **generation-foundation** — the pipeline, Cloudflare and Gemini adapters, a side-by-side model
   comparison, and "In a scene" painted through it. No screen changes.
2. **media-tags** — library images carry tags; the library filters by tag, use and origin.
3. **shop-credits** — each shop's credit ledger, the starting ₹2,500, offline top-ups with proof,
   per-shop margin, and proof on payouts.
4. **improve-with-ai** — the split Improve button, the description-and-references modal, the result
   with Use this and Regenerate, on the library and the product form.
5. **social-posts** — post pictures and captions for social-selling's composer, through the same
   window, with a social purpose (Q46). Draft, 2026-11-22.

## Scope
- **In:** the four subfeatures above.
- **Later:** Instagram and WhatsApp composers are social-posts (Q46); OpenAI and Anthropic adapters (Q9), an
  automatic fidelity check, an admin screen for the model order (Q12).

## Open questions
None at this level.
