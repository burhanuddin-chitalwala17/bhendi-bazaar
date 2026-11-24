# Spec — ai-images/social-posts

- **Summary:** From the post composer, a shop makes a post picture from its product photos or its brand, styled the way it describes and shaped for Instagram or Status, and a caption with hashtags drafted from the product's own facts, paid from its credit and kept in its library as AI-made
- **Status:** Draft
- **Domain:** content, reading catalog (media, products) and subscriptions (credit)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [../decisions.md](../decisions.md) (Q27, Q46–Q48), [improve-with-ai](../improve-with-ai/spec.md), [generation-foundation](../generation-foundation/spec.md), [shop-credits](../shop-credits/spec.md), [social-selling/post-composer](../../social-selling/post-composer/spec.md), [ADR-0076](../../../adr/0076-image-generation-goes-through-one-port-and-models-are-data.md), [ADR-0077](../../../adr/0077-the-pixel-promise-belongs-to-the-backdrop-tools-and-an-ai-picture-is-labelled-and-secondary.md)

> Requirements and product approach only. Technical approach lives in trd.md. The fifth subfeature
> of ai-images, built and released; this one extends it (Q27). social-selling's step 1, built
> alongside its step 2. ai-images' implemented decisions are superseded, never edited.

## What this feature is
"Make a picture" and "Write a caption" in social-selling's post composer. The first opens the
Improve with AI window the shop already knows, with a social purpose and the post's shape; the
second drafts a caption and hashtags from the products the post names. Both land where the
composer reads them: the picture in the library, the caption in the caption box.

## Why
Shops have product photos but not post pictures: an abaya worn, a bag in a café, a festival frame.
Improve with AI already makes such pictures for listings, paid at cost from credit (Q27). A post
also needs words, and a shop writing captions every day for every post gives up.

## Requirements
- R1 — "Make a picture" opens Improve with AI's window from the composer, with the post's shape
  (square, 4:5 or 9:16) chosen and the post's products' photos offered as references; the shop
  describes the picture and may add the brand's logo or other library pictures (Q46).
- R2 — Pictures for posts are a purpose of their own, with their own prompt version and model
  order, changeable as data like every purpose (ADR-0076).
- R3 — Each picture is paid from the shop's credit at exactly what it cost, through the same ledger;
  a refusal or a failure follows the existing rules and charges as they do (shop-credits).
- R4 — Every paid version is kept in the library, tagged AI-made with what it was made from; Use
  this puts the one shown into the post (Q25, ADR-0077).
- R5 — "Write a caption" drafts a caption and hashtags from the named products' own facts (name,
  price with any offer, category, what it is made of) and the shop's name, in English or Hindi;
  the shop edits it freely before scheduling (Q47).
- R6 — A caption never states a price, offer or stock that the product does not have at that
  moment; it is drafted from the live product, and the shop is warned if the price changes before
  the post goes out (Q47).
- R7 — Price, offer or brand name on a picture are added by us as exact text, never painted by the
  model (Q48).

## Hazards the TRD must answer
- **A model changes the product** in a post picture: the shop judges every result, as on listings.
- **A caption that promises a stale price** by the time the post goes out.
- **Text models are a new provider kind** for this codebase: a decision record and the same rules
  as images (one port, models as data, cost before the call).

## Product acceptance
Judged on a phone (~360px) first.
- A1 — From the composer, "Make a picture" with two product photos and "worn by a model on a Mumbai
  street, festive" returns a 4:5 picture in the post and in the library, tagged AI-made, and the
  credit balance falls by its cost.
- A2 — Regenerate with a new instruction returns another version; both stay in the library.
- A3 — "Write a caption" for a post naming one product on offer drafts a caption with its offer
  price and hashtags, in the chosen language.
- A4 — A post whose product's price changes after its caption was drafted warns the shop before it
  goes out.
- A5 — An offer badge on a picture shows the exact price, as text we placed.

## Scope
- **Outcome:** a shop makes the pictures and words for a post without leaving the composer.
- **In:** R1–R7, tested by A1–A5.
- **Later:** templates of seasonal frames; a fidelity check by a vision model (Q9).

## Open questions
Q47, Q48.
