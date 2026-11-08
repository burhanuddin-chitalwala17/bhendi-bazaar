# TRD — listing-model / dynamic-form

- **Status:** Accepted
- **Domain:** listing, with catalog and channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-08
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), parent [trd.md](../trd.md) D3, D9

> Technical approach. Refines parent D3, D9. Switches reads to the new model.

## Approach
The form renders from the product type's attributes and the shop's connected channels. Every read path
(form, storefront, feeds, builder) reads the product's values (`ProductValueSet`, attributes Q8). Completeness is stored per product per
connected channel and refreshed by a job.

## Prior art
Akeneo completeness per channel, stored and recomputed on change. Followed.

## Technical decisions
- **D1 — Form model.** Server-built per type (and per kind, Q7) from the shop's channels and the field maps:
  which channel requires or is helped by each question (`form-channels.service`, unit 1), handed to the form
  with the types; the pure `groupQuestions` splits "Required now" from "Also helps on" (Q8). Inherited values
  and their source join it with the reads switch (D4).
- **D2 — Validation** from the same model: a Zod schema built per type at runtime on the server and the
  client (`useServerForm`), never disabling Save (ADR-0053).
- **D3 — `ProductChannelState`** (productId, orgId, channel, required, missing, missingKeys Json,
  computedAt; unique product+channel); written by `listing.refresh-completeness` after a product save,
  archive, bulk sheet, fix-page answer, channel connect, map or catalogue change, plus a daily sweep (Q11);
  batched 500, one refresh per shop at a time; one writer. No inputs hash: a refresh is cheap and exact.
- **D4 — Reads switched.** Storefront facets, `shopfront-feed`, readiness, the builder and the product
  page read `ProductValueSet`; `Product.facts`/`measurements` no longer read (removed in retire-old-paths).
  The migration that switches writes to `product-value.repository` drops the attributes sync triggers in
  the same migration (attributes Q7), so ProductValue never has two writers.
- **D5 — Connect prompt and channel-change alert** are Home attention lines reading `ProductChannelState`
  and the catalogue's change record.
- **D6 — Bulk fill** extends readiness-fix to any attribute: one attribute, many products, empty only.
- **D7 — Brand form** gains three party blocks and the Amazon registration choice, saved with the brand
  in one request and transaction (Q13); name-only required; the shop-wide switch retires (Q14).

## Packages
None.

## UI approach
Per [ux.md](ux.md). Phone first: one column, groups collapsible, channel strip under the title; from
`lg:` the strip sits beside the form. Server pages read DALs; the form is the one client leaf, through
`useServerForm` and a `productsApiClient`.

## Gates touched
`hardcoded-copy`, `page-grammar`, `rendering-strategy`, `form-error-display`, `one-repository`, docs.

## Data model
[MIGRATION] `ProductChannelState`.

## Test plan
Integration: completeness rows update on save and on connect (spec A2, A3); inherited and overridden
values round-trip (A4). Unit: form model groups required vs helps-on by connected channels (A1).

## Delivery
1. Form model, validation, form. 2. Completeness rows and jobs, Home lines, bulk fill. 3. Reads switched.
4. Brand form.

## Open questions
None.
