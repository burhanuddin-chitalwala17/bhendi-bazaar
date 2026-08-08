# Consumer inventory — fields this feature removes or moves

- **Verified:** 2026-08-08
- **References:** [spec.md](stock-locations-and-allocation/spec.md), [trd.md](stock-locations-and-allocation/trd.md), [CONTRACTS.md](../../CONTRACTS.md)

Every site that reads or writes a field this feature changes. Sections 1–4 swept 2026-08-06, section 5 on 2026-08-07, section 6 on 2026-08-08. Target-model names follow [data-model.md](data-model.md). A supporting artifact, not line-capped ([ADR-0010](../../adr/0010-spec-convention.md)). Its purpose is that no consumer is discovered late: the DTO duplication recorded in [CONTRACTS.md](../../CONTRACTS.md) means several of these shapes are declared twice, and changing one without the other typechecks on the side you looked at.

Counts are call sites, not lines. Re-run the sweeps in [Verifying this list](#verifying-this-list) before starting — this was accurate on the date above, not necessarily on the day you read it.

---

## 1. `Seller.default{Pincode,City,State,Address}` → become an `ORG_ADDRESS` + `ADDRESS` pair

**Deleted.** The shop becomes an ordinary `ORG_ADDRESS` row — there is no default flag ([data-model.md](data-model.md)).

| Site | What it does | Becomes |
|---|---|---|
| `prisma/schema.prisma:162-165`, `:191` | four columns + `@@index([defaultPincode])` | dropped; the index belongs on `ADDRESS.pincode`, since the postal fields live there |
| `prisma/seed/sellers.seed.ts:15-18`, `:34-37` | seed data for two sellers | seeds a default warehouse per seller |
| `prisma/seed/types.ts:29-32` | seed input type | follows the seed shape |
| `prisma/seed.ts:127-130` | writes the four columns | writes a warehouse row |
| `prisma/seed/shipments.seed.ts:47-49`, `:76-78`, `:121-123`, `:150-152`, `:184-186` | builds five seeded shipments' `from*` from the seller | builds them from the location; `orgAddressId` set |
| `server/catalog/seller.repository.ts:106`, `:127` | create/update write `defaultAddress` | warehouse repository owns it |
| `server/catalog/product.repository.ts:13` | `select` on the seller relation | selects the product's warehouse instead |
| `server/catalog/admin.product.repository.ts:36` | same, admin read path | same |
| `server/cart/cart.service.ts:55-58` | selects all four for the cart | selects the warehouse |
| `server/cart/cart.service.ts:81-84` | maps them onto the cart item's `seller` block | maps a `warehouse` block |
| `server/catalog/product.types.ts:35-38` | server-side DTO | replaced by a warehouse shape |
| `src/domain/seller.ts:11-14`, `:38-41` | **two** client declarations of the seller shape | both change, or consolidate first |
| `src/domain/product.ts:37-40` | nested seller block on the product shape | nested warehouse block |
| `src/domain/cart.ts:39-42` | nested seller block on the cart item | nested warehouse block |
| `src/lib/validation/schemas/seller.schema.ts:26-38` | Zod rules for the four fields | move to a warehouse schema |
| `src/components/shared/forms/sellers/SellerLocationFields.tsx:31-73` | the seller form's location section | becomes warehouse CRUD, not a section of the seller form |
| `src/components/shared/forms/sellers/index.tsx:49-52` | form default values | drop |
| `src/admin/sellersContainer/index.tsx:53` | search filter matches on `defaultCity` | search across the seller's warehouses, or drop the clause |
| `src/admin/sellersContainer/components/SellersTable.tsx:65`, `:67` | displays city, state, pincode in the sellers table | show the default warehouse, or a location count |
| `src/data-access-layer/products.dal.ts:39-42` | maps the four onto the client shape | maps the warehouse |
| `src/data-access-layer/admin/products.dal.ts:72-75` | same, admin | same |
| `src/app/(admin)/admin/products/new/page.tsx:20-23` | passes them into the product form | passes the seller's warehouses |
| `src/app/(admin)/admin/products/[id]/edit/page.tsx:24-27` | same, edit | same |
| `src/admin/products/types.ts:58`, `ProductsView.tsx:15`, `productAdd/index.tsx:14`, `productEdit/index.tsx:15`, `forms/product/index.tsx:22`, `ProductSellerShippingFields.tsx:12` | **six** copies of the same inline `sellers: {...}[]` prop type, each spelling out all four fields | one warehouse-bearing type; the six copies are why this must be consolidated first |
| `src/components/shared/forms/product/ProductSellerShippingFields.tsx:65-68` | renders the "Default Shipping Location" info box | replaced by the warehouse selector |
| `src/utils/shipping.ts:95-96` | sets a shipment group's `fromCity`/`fromState` from the **seller** while its `fromPincode` comes from the **product** | reads all three from one warehouse row — this is the mismatch the feature removes |

**Not consumers** despite matching the grep: `src/hooks/useAddressManager.ts:17,146,170` and `src/containers/checkoutContainer/components/AuthenticatedAddress.tsx:29,30,52` use a local variable named `defaultAddress` for the *customer's* delivery address. Unrelated.

---

## 2. `Product.shippingFrom{Pincode,City,Location}` → `PRODUCT_STOCK`

**Deleted.** Only `shippingFromPincode` is read for anything today; the other two are written and then redisplayed in the admin form only.

| Site | What it does | Becomes |
|---|---|---|
| `prisma/schema.prisma:62-64`, `:78` | three columns + `@@index([shippingFromPincode])` | dropped; the join table carries the relation |
| `server/catalog/admin.product.repository.ts:48-50` | `select` | selects the join |
| `server/catalog/admin.product.repository.ts:190-192`, `:286-288` | create and update write all three (via `blankToNull` since PR-22) | write join rows |
| `server/catalog/admin.product.types.ts:36-38` | server DTO | warehouse reference |
| `server/catalog/product.types.ts:40` | `shippingFromPincode` on the public product shape | resolved from the warehouse |
| `server/cart/cart.service.ts:76` | `product.shippingFromPincode \|\| product.seller.defaultPincode` — **fallback site 1 of 4** | gone; origin is definite |
| `src/hooks/product/useProductActions.ts:48` | `?? product.seller.defaultPincode` — **fallback site 2** | gone |
| `src/data-access-layer/products.dal.ts:34` | `\|\| product.seller.defaultPincode \|\| ""` — **fallback site 3** | gone |
| `src/data-access-layer/admin/products.dal.ts:77-79` | `?? ""` on all three — **fallback site 4** | gone |
| `src/utils/shipping.ts:85` | `groupId = \`${seller.id}-${shippingFromPincode}\`` — a composite key standing in for a warehouse | `groupId = orgAddressId` |
| `src/utils/shipping.ts:94` | `fromPincode` for the rate request | from the warehouse |
| `src/admin/products/types.ts:59-61`, `:91-93` | `ProductDetails` and `ProductFormInput` | warehouse reference |
| `src/domain/product.ts:32`, `src/domain/cart.ts:33` | client shapes | warehouse reference |
| `src/lib/validation/schemas/product.schema.ts:10-16`, `:55-57`, `:66-75` | the three fields, `SHIPPING_OVERRIDE_FIELDS`, and the all-or-none refine added in PR-22 | all removed — the group rule exists only because origin has two homes |
| `src/components/shared/forms/product/ProductSellerShippingFields.tsx:99-125` | three free-text inputs | a warehouse dropdown plus per-location stock |
| `src/app/(main)/checkout/page.tsx:30` | passes `shippingFromPincode` for buy-now | from the warehouse |

---

## 3. `Product.stock` → `PRODUCT_STOCK.quantity`

**Deleted, derived by aggregation.** `lowStockThreshold` stays on `Product` — it is a policy, not a quantity.

| Site | What it does | Becomes |
|---|---|---|
| `server/checkout/order.repository.ts:99-110` | reads stock, compares, throws — the read-then-check half of the race | guarded conditional update per location, owned by [inventory-reservation](../inventory-reservation/) |
| `server/checkout/order.repository.ts:133-143` | unguarded `decrement` inside the transaction | guarded `updateMany` against the allocated `PRODUCT_STOCK` row |
| `server/checkout/order.service.ts:175` | creates shipments inside a transaction | one shipment per allocated warehouse |
| `server/catalog/admin.product.repository.ts:26`, `:187`, `:284` | select and both write sites | join rows; product write no longer carries stock |
| `server/catalog/admin.product.repository.ts:84` | `outOfStock` filter as `{ stock: 0 }` | filter on the aggregate |
| `server/catalog/admin.product.repository.ts:97` | **sorts by stock** | needs the aggregate; the sharpest argument for a cached total if it proves slow |
| `server/catalog/admin.product.repository.ts:229-234` | dashboard counts: out-of-stock, low-stock | aggregate |
| `server/catalog/seller.repository.ts:19`, `:53` | per-seller stock rollups | aggregate scoped to the seller's warehouses |
| `server/analytics/dashboard.repository.ts:68-74` | admin dashboard stock stats | aggregate |
| `src/app/api/products/check-stock/route.ts` | 7 sites — the storefront availability check | totals; may also report per-location |
| `src/hooks/product/useStockCheck.ts`, `src/hooks/product/useProductActions.ts` | client stock checks | totals |
| `src/components/cart/CartItem.tsx` (11), `StockStatus.tsx` (6), `StatusBadge.tsx` (3), `product-card.tsx`, `product-details.tsx`, `ProductsTable.tsx` | display and cap quantity | totals; unchanged if the DTO keeps a `stock` total field |
| `src/containers/checkoutContainer/hooks/useCheckout.ts`, `useCheckoutPayment.ts` | checkout-time checks | totals, plus the split preview |
| `src/components/shared/forms/product/ProductInventoryFields.tsx:29-35` | single stock input | per-location inputs |
| `src/lib/validation/schemas/product.schema.ts` | `stock` rule | moves to the join's schema |

Keeping a `stock` **total** on the outbound DTO is what limits the blast radius: most of section 3 is display code that does not care where the number came from. The DTO field stays; only its source changes.

---

## 4. `Shipment.from{Pincode,City,State}` → kept, plus `orgAddressId`

Not deleted. A shipment is a historical record, so its origin snapshot must survive the warehouse being edited later — the same reasoning that puts price on the order rather than joining to `Product.price` ([ADR-0002](../../adr/0002-server-holds-pricing-authority.md)).

| Site | What it does | Becomes |
|---|---|---|
| `prisma/schema.prisma` `Shipment` | `sellerId` FK + three `from*` columns | unchanged, plus nullable `orgAddressId` |
| `prisma/seed/shipments.seed.ts` | five shipments built from seller defaults | built from warehouses |
| `src/utils/shipping.ts:79-105` | `groupItemsByOrigin` builds groups | keyed on `orgAddressId`, whole origin from one row |

Historical rows get `orgAddressId = NULL`: the warehouse they shipped from did not exist as a record, and inventing an attribution would be a guess written into an audit trail.

---

## 5. Checkout, rates and the parcel view

Mostly already correct in shape. Multi-parcel checkout exists — it is keyed on the wrong thing and labelled by origin, which stops distinguishing parcels once two warehouses share a city ([trd.md](stock-locations-and-allocation/trd.md) D12).

| Site | What it does | Becomes |
|---|---|---|
| `src/domain/shipping.ts:128-155` | `ShippingGroup`: `groupId` documented as `"SEL-001-400001"`, seller name and code, three `from*` fields, `rates`, `selectedRate`, `serviceable` | keyed on `orgAddressId`; origin read from one row; parcel index added |
| `src/domain/shipping.ts:141` | `items: any[]` — "using any to avoid circular dependency" | typed while the shape is being changed anyway |
| `server/checkout/order.types.ts:77+` | `ShippingGroupInput`, the server mirror of the same shape | same change, and it is a **second declaration** to keep in step |
| `src/utils/shipping.ts:79-105` | `groupItemsByOrigin` builds the groups | groups by `orgAddressId` |
| `src/utils/shipping.ts:118` | `totalWeight += item.weight * item.quantity` | unchanged — weight became real in PR-22 |
| `src/utils/shipping.ts:33-45` | `formatDeliveryEstimate` (relative), `getEstimatedDeliveryDate` (unused) | the second starts being used; dates read better than "3 days" across parcels |
| `src/hooks/shipping/useMultiShippingRates.ts:65`, `:74` | per-group rate fetch and serviceability | per parcel; unchanged in shape |
| `src/hooks/shipping/useShippingRates.ts:15`, `:31`, `:81` | single-origin variant of the same hook | confirm whether it still has a caller once allocation always produces groups |
| `MultiShippingSection.tsx:95-101` | heading "Ships from {fromCity}, {fromState}" + "Seller: {sellerName}" | "Parcel 1 of 2"; city demoted to secondary detail |
| `MultiShippingSection.tsx:132` | per-group "Shipping not available" | per parcel |
| `MultiShippingSection.tsx:164` | `formatDeliveryEstimate(rate.estimatedDays)` per rate | plus an order-level completion date, the latest of the selected estimates |
| `src/app/api/shipping/rates/route.ts` | quotes a single origin | quotes per parcel; must not return per-location stock (R11) |
| `src/app/api/products/check-stock/route.ts` | availability check, 7 sites | returns the total only, never a breakdown (D13) |

## 6. `Seller` → `Org` (added 2026-08-08)

Not swept site-by-site: **566 references across 57 files**, and unlike sections 1–4 they are almost
all a straight rename rather than a semantic change. The concentrations are
`src/admin/sellersContainer/` (55 + 42 + 32), `server/catalog/seller.repository.ts` (38),
`server/catalog/seller.service.ts` (35) and `src/components/shared/forms/sellers/` (35).

Two parts are *not* mechanical and need real attention:

- **`Product.sellerId` and `Shipment.sellerId`** are foreign keys, so the rename is a migration, not
  a find-and-replace. `Shipment.sellerId` also stops being the right question — a shipment's origin
  becomes `orgAddressId` ([data-model.md](data-model.md)).
- **`ORG_MEMBER` is new behaviour, not a rename.** Nothing today associates a user with a vendor, so
  there is no existing code to convert — but every admin route that currently authorises on
  `role === "ADMIN"` will eventually need to authorise on membership instead. Out of scope here;
  noted so the rename is not mistaken for the whole job.

Do this as its own PR before the schema work ([trd.md](stock-locations-and-allocation/trd.md) D14). A 566-reference rename tangled
with a behaviour change is unreviewable.

## Verifying this list

```bash
grep -rn "default\(Pincode\|City\|State\|Address\)" --include="*.ts" --include="*.tsx" --include="*.prisma" . | grep -v node_modules
grep -rn "shippingFrom" --include="*.ts" --include="*.tsx" --include="*.prisma" . | grep -v node_modules
grep -rn "\bstock\b" --include="*.ts" --include="*.tsx" src server | grep -v lowStock
```

## Totals

| Field group | Sites | Files | Fate |
|---|---|---|---|
| `Seller.default*` | ~60 | 27 | deleted |
| `Product.shippingFrom*` | ~30 | 16 | deleted |
| `Product.stock` | ~90 | 28 | moved to the join, total kept on the DTO |
| `Shipment.from*` | ~12 | 3 | kept as a snapshot |

The count is dominated by duplicate type declarations, not by logic: six inline copies of the seller prop type, two `Seller` shapes in `src/domain/seller.ts`, and the two `ProductFormInput` declarations. Consolidating those first turns much of this from an edit into a no-op, which is why it is PR 1 in [trd.md](stock-locations-and-allocation/trd.md).
