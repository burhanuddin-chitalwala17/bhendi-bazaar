# TRD — ai-images/social-posts

- **Status:** Accepted
- **Domain:** content, reading catalog (media, products), promotions (effective price) and subscriptions (credit)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [../decisions.md](../decisions.md) (Q27, Q46–Q48), [ux.md](ux.md), [generation-foundation TRD](../generation-foundation/trd.md), [improve-with-ai TRD](../improve-with-ai/trd.md), [ADR-0076](../../../adr/0076-image-generation-goes-through-one-port-and-models-are-data.md), [ADR-0087](../../../adr/0087-text-generation-goes-through-the-generation-port.md), [post-composer TRD](../../social-selling/post-composer/trd.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Two calls into content's generation module from the composer. "Make a picture" is improve-with-ai's
request path with a new purpose (`social`) and presets from the post. "Write a caption" is the
first text purpose (`caption`, ADR-0087). Words on a picture are checked by reading them back
(Q48); a caption's price is checked against the live product before it goes out (Q47).

## Prior art
- Covered by generation-foundation's TRD (ports, models as data, ledger). Specific here:
  **read-back verification of rendered text** (OCR of a generated image compared with intended
  strings) is how design tools that let models letter images guard against misspelling; we use the
  generation port's vision-capable route for the read, not a separate OCR vendor.
- **Overlay fallback**: when lettering fails, compositing exact text over the image is the
  conventional repair (Canva's text layers). Followed, with the shop's brand font from the
  storefront's token set.

## Technical decisions
- **D1 — Picture purpose (R1, R2, Q46).** Purpose `social` in the registry with its own prompt
  version (`social.v1`) and model order; the request path is improve-with-ai's unchanged, given
  shape (from the post's destinations), references (the post's products' main photos, first three)
  and examples. Cost, credit and ledger exactly as listing pictures (R3).
- **D2 — Words on the picture (R7, Q48).** The request carries `lettering: { text, role }[]` built
  on the server from the live product (price via promotions' resolver, offer, shop name) or the
  shop's own ≤40 characters. After generation, a read-back call (purpose `lettering-check`) returns
  the text it sees; a normalised comparison (digits, ₹, case, whitespace) passes or fails. Fail →
  regenerate once; fail again → render the original picture without lettering and composite exact
  text server-side (sharp, already a dependency) in the shop's heading face. The shop sees only a
  passing result.
- **D3 — Caption purpose (R5, ADR-0087).** `caption.v1` prompt over structured facts (name, price
  and list price in rupees from paise, offer, category, material, shop name, language); output
  limited to 600 characters and 8 hashtags. A deterministic post-check rejects any number that is
  not one of the facts' prices; a rejected draft is retried once, then a template caption is used.
- **D4 — Staleness (R6, Q47).** The draft records the facts it used (`CaptionDraft(postId, facts
  hash, prices)`). `captionStillTrue(postId)` compares with live facts; a change raises the
  composer's note and, at publish, post-composer's hold. Update price replaces the old price string
  in the caption with the new one, nothing else.
- **D5 — Credit.** Both purposes charge through shop-credits' existing quote and settle; a caption
  is priced per token by the registry and typically costs under a paisa, shown as part of the
  credit line only when non-zero.

## Packages
None (sharp exists).

## UI approach
ux.md: the existing Describe it `TaskDialog` gains the preset shape, product references, post
examples and the Add words chips; the composer's caption field gains Write a caption with language
chips and the replace sheet. Words in `styled-shot-copy.ts` and `social-copy.ts`.

## Gates touched
Route caption (rate-limited per shop); the generation vendor-boundary test covers the new purposes.

## Data model
[MIGRATION] `CaptionDraft(postId PK, factsHash, pricesPaise, language, generationId, createdAt)`.

## API / contract changes
[CONTRACT] `captionStillTrue` on content's public surface for social.

## Test plan
- Lettering: a matching read-back passes; a mismatch regenerates once; a second mismatch composites
  exact text (A5); the shop never sees a mismatched result.
- Caption post-check rejects an invented price; template fallback.
- Staleness raises the note; Update price changes only the price string (A4).
- Credit settled once per call (shop-credits' tests extended).

## Delivery
1. `social` purpose and presets (behaviour: pictures).
2. Lettering and its check.
3. Caption purpose, staleness, update (behaviour: captions).

## Open questions
None.
