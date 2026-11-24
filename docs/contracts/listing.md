# Contracts — listing

- **Verified:** 2026-11-24
- **Covers:** `server/listing/*.types.ts`

The listing shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Listing vocabulary

Since PR-243 `ProductFormInput` (`server/catalog/admin.product.types.ts`) accepts five more
fields, all optional: `kind`, `familyId`, `brandId`, `facts` and `measurements`. The answers are
**bare values** on the wire — `{ "colour": "black", "material": "nida-matte" }` — never the stored
shape, because an answer is persisted with the level that supplied it and a request that could
set that could claim a shop typed something it inherited.

Since BF-015, `kind`, `familyId` and `brandId` also accept `""` and read it as `null`: a picker's
"none" option ("On its own", "Not specified") submits the empty string, and `familyId` used to
refuse it with a `min(1)` error. Additive — every payload valid before is still valid and means
the same; `""` is never stored.

**`productType` is absent from the wire deliberately**, like `slug` and `thumbnail`. It is
resolved from the category tree when the product is saved and copied onto the row
([categories](../specs/listing-vocabulary/categories) D1b), so a payload cannot put a product under
a type its category does not use. `tests/unit/product-listing-payload.test.ts` holds that, and
holds the stored `{value, origin}` shape out of the inbound schema.

What the repository writes is a **different type**: `ProductPersistInput` is `ProductFormInput`
minus the two answer maps, plus `productType` and the same maps carrying origins. The two are
separate because they genuinely differ, and because forcing both through one is how a
server-owned field comes to look like something a request may set (Invariant 4).

`Category` gains `productType` on its admin DTO — a key validated against `ProductType`, not a
closed enum, since the types are rows an admin creates. The create and update envelopes are
**factories**: `categoryFormSchemaFor(keys)` is built by the form from the options it was handed
and by the route from the database, so what a shop is shown inline stays what the server enforces
([ADR-0013](../adr/0013-one-error-envelope-and-useserverform.md)).

New admin surface: `GET`/`POST /api/admin/product-types` and `PATCH`/`DELETE
/api/admin/product-types/:key`, speaking `ProductTypeRecord`
(`server/listing/product-type.types.ts`). `DELETE` **retires** rather than deletes and answers
`{ retired, usage: { categories, products } }` — the foreign keys refuse a delete while anything
names the type, and the counts are what make that a sentence somebody can act on.

Since PR-248 a product may belong to a **family** — what an abaya in four colours has in common.
`POST /api/org/[orgId]/families` takes `{ name, description?, categoryId }` and answers the row.
`productType` and `variantAxis` are absent from the payload deliberately: both are resolved from
the category when the family is made, so a request cannot group products by a fact their type
never asks about. The listing is read by the product form's page on the server, so there is no
`GET` ([ADR-0034](../adr/0034-render-on-the-server-by-default.md)).

`ProductStats` gains `familyCount` — how many families the available products belong to. Two
numbers rather than one, because twenty abayas in five colours is twenty families and a hundred
sellable things, and a figure that does not say which it counts is the ambiguous one
([variants](../specs/listing-vocabulary/variants) D6).
