# ADR-0081: Text generation goes through the generation port

- **Date:** 2026-11-23
- **Status:** Proposed

## Context

Captions and hashtags drafted from a product's facts (ai-images Q47) are the first text a model
writes for Bhendi Bazaar. ADR-0076 put every generated image behind one port with models as data,
cost recorded before the call and a ledger row per generation. A second, ad-hoc path for text would
repeat vendor names, prices and failure handling in another place.

## Decision

1. **Text joins the same port.** The generation module gains a `text` modality: a request names a
   purpose (`caption`), a versioned platform prompt, the product facts as structured input, the
   language and an idempotency key; the result is text, the model id and its cost.
2. **Models are data, as for images**: a registry entry per model route with its price rule per
   input and output token, its source and checked date; a router that tries models in order,
   moving on only for unavailability, never for a refusal.
3. **Cost before the call, ledger after.** The same `Generation` row records the purpose, model and
   cost in paise; a caption is charged as ai-images' shop-credits rules say.
4. **Facts, not free text, go to the model.** The prompt is built from the live product's fields; the
   output is checked against them (no price, offer or stock the product does not have) before the
   shop sees it.

## Alternatives considered

- **Call one vendor's SDK from the caption code.** Fastest to write, rejected for the reasons
  ADR-0076 rejected it for images: vendor types in server code and no fallback.
- **Template captions with no model.** Kept as the fallback when every model is unavailable, not as
  the feature: shops asked for captions that read as written.

## Consequences

- ✅ One place for providers, prices and failures across images and text.
- ⚠️ The registry gains a token-priced rule; costs stay integer paise.
