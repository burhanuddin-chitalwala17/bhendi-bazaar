# CONTRACTS.md — client ↔ server DTO contracts

- **Verified:** 2026-11-01
- **Covers:** `src/lib/validation/schemas/*.ts`, `src/app/api/*/`, `src/lib/api-error-response.ts`
- **Scope:** shapes that cross the browser/server boundary via `src/app/api/**` route handlers.

## Purpose
In a monorepo the client and server share a type system but **not** a runtime. A shape TypeScript believes is shared still travels as JSON, so anything the compiler cannot see — a `Date` arriving as a string, a field the server never sends, a cast that silences a mismatch — becomes a runtime problem that compiles cleanly.

This file records the shapes that cross that boundary and is where a breaking change is negotiated. When a DTO here changes, the PR is flagged `[CONTRACT]` in [CHANGELOG.md](CHANGELOG.md).

## Rules

1. **One shape per concept, declared once.** A DTO is defined in exactly one module imported by both sides. Two declarations of the same concept drift, and the compiler will not catch it — separately declared string enums with matching values are mutually assignable.
2. **No casts across the boundary.** `as SomeType` on a value that arrived over the wire asserts a shape rather than checking it; parse with Zod ([Invariant 4](../CLAUDE.md)). `as unknown as T` is a hard block — it is a deliberate defeat of the type system.
3. **Timestamps cross as ISO strings.** JSON has no date type. A wire DTO types them `string`; conversion to `Date` is explicit and at the point of use.
4. **Money crosses as integer paise** ([ADR-0004](adr/0004-money-as-integer-paise.md)) — true since PR-37: every monetary column is `Int` paise and wire money validates as `paiseAmount`. Formatting happens once, in `src/lib/format.ts`. The one asymmetry: **admin product prices arrive as rupees** (`rupeeAmount`, ≤2 decimals — humans type rupees) and convert at the catalog service; a Zod transform could not do it because the same schema validates on both sides (ADR-0013) and would run twice.
5. **The server sends a projection, not a row.** Responses use an explicit `select`. A Prisma model is never returned wholesale — `User` carries `passwordHash` and reset tokens; `ShippingProvider` carries `authToken` and `accountInfo`.
6. **Additive changes preferred.** Add optional fields; never silently change a field's meaning. Removal goes through a deprecation note in the CHANGELOG.
7. **Server-owned fields are never accepted inbound**, even as optional: `paymentStatus`, computed totals, `rating`, `reviewsCount`, `createdAt`.

---

## The error envelope

Every route handler returns this shape on failure, and every client reads it through
`readApiError`. Defined in `src/lib/api-error.ts`; produced by `toErrorResponse`.

```json
{
  "error": "This SKU is already in use",
  "details": [{ "path": "sku", "message": "This SKU is already in use" }]
}
```

`error` is always present and always safe to show. `details` appears when the failure
can be blamed on specific input, and **one envelope carries both sources** — a Zod
failure and a database constraint violation are indistinguishable to the client, which
is the point: a form maps `details` onto its fields without knowing which produced it.

`path` matches the form field name. `useServerForm` routes each detail to its field via
`setError`, and surfaces anything it could not place rather than dropping it.

Statuses: 400 invalid input · 403 forbidden · 404 missing · 409 conflict (duplicate,
stale foreign key, exhausted stock) · 500 internal.

**Only the 500 branch discards its message.** Domain code opts into being shown by
throwing `DomainError` (or `NotFoundError` / `ConflictError` / `ForbiddenError`);
anything else is treated as an internal fault and logged, because a raw Prisma message
can name columns.

Neither key is compiler-checked, which is why both sides go through the shared helpers
rather than reaching into the body. A handler that hand-rolls `NextResponse.json({ ... })`
on an error path is a defect.

---

## Current shapes

### Paginated listings
Every admin and org listing crosses the wire as `{ ..., pagination: { page, limit, total, totalPages } }` — one `Pagination` declaration in `server/shared/pagination.ts`, re-exported by `src/types/shared.ts` (Rule 1; it was declared twice until PR-111).

`limit` is **caller-chosen but not caller-defined**: it is parsed at every handler against the closed set `PAGE_SIZE_OPTIONS` (10/25/50/100) by `resolvePageSize`, and anything else falls back to `DEFAULT_PAGE_SIZE` rather than reaching a Prisma `take`. An unbounded `take` is a table scan a query string can ask for, so this is Invariant 4 at a read boundary, not a convenience. `page` goes through `resolvePageNumber` for the same reason — a negative page is a negative `skip`.

`GET /api/admin/orgs` returns this envelope as of PR-111, where it previously returned a bare `OrgWithStats[]` and the browser searched, filtered and sliced it locally. Its `search` and `status` params now narrow the query, so `total` counts matching rows rather than fetched ones.

Since the B-007 tracker fix, `DELETE /api/admin/orgs/[id]` is removed. In its place, `PATCH /api/admin/orgs/[id]` accepts `{ action: "block" | "unblock" }` (Zod-validated) and returns the updated `OrgWithStats`. The `Org` client type (`src/domain/org.ts`) gains `isBlocked: boolean`. Blocked orgs are invisible to buyers via `FROM_ACTIVE_ORG` and their portal shows a suspended state.

### Cart
Since PR-44 the server stores only the buyer's choice per line (`CartLineInput`: product, quantity, size, colour) and **derives everything else from the product at read time** — prices, names, `weight`, `shippingFromPincode`, and the `org` block all come from the join, so a cart can no longer hold a stale or spoofed price and the boundary casts are gone. Since PR-45 there is **one `CartItem` declaration** (`server/cart/cart.types.ts`, re-exported by `src/domain/cart.ts`), satisfying Rule 1.

### Orders
`Shipment` is declared in three places across `src/domain/order.ts` and `server/checkout/order.types.ts`. Timestamp fields (`estimatedDelivery`, `createdAt`, `updatedAt`) are typed `Date` on the client side and `string` on the server side; JSON delivers strings, so Rule 3 is not currently met.

Order creation (`create-with-shipments`) accepts **unpriced lines** — `{ productId, quantity, size?, color? }` — plus a `displayedGrandTotal` used only for the changed-mid-session comparison and never persisted (PR-38). The optional variant (PR-43) is validated against the product's declared options server-side; on every outbound items array, `price` is the unit price actually paid and lines are rebuilt from `OrderItem`/`ShipmentItem` rows — the JSON blob is legacy. `paymentStatus` crosses the wire in **no direction** since PR-39: the update route is deleted, and the paid/failed transitions in `order.repository.ts` are the only writers (ADR-0005).

Order creation answers **409** for a sold-out item since PR-104, where it previously answered 400 for every failure — a client could not tell an unavailable item from a malformed payload. Failures now travel in the one envelope (`toErrorResponse`, ADR-0013). Order **codes** returned in `code` are `BB-` plus eight characters since PR-104 ([ADR-0025](adr/0025-order-codes-are-random-not-sequential.md)); the older `BB-1042` shape remains valid for ever, and `POST /api/orders/lookup` accepts both.

### Offers
`POST /api/checkout/promotions/quote` takes `{ items[], code? }` and returns `{ lineDiscounts, applied[], couponCoveredKeys, totalDiscountPaise, rejection }`. Every eligibility rule stays server-side: the response carries **per-line amounts** so the browser can badge covered items without re-deriving one, which is the same reason a discount amount is never accepted inbound.

`rejection` is a shape, not a string — `{ code, reason, message, shortfallPaise? }` — because the four reasons a code does nothing are acted on differently by the UI. **A code that would take nothing off is a rejection, never a success**: reporting one as applied means the buyer only finds out on the payment screen.

Order creation gains an optional **`couponCode`** — a string, normalised to upper case, and the only promotional input a request may carry (PR-67). Discount amounts, percentages and promotion ids are server-owned in exactly the way `paymentStatus` is; the amount is computed inside the order transaction from the persisted offer.

**A platform offer carries a budget and a loss confirmation (offers-hardening U5, 2026-10-29) `[CONTRACT]`.** `PlatformPromotionFormInput` (`platformPromotionSchema` in `src/lib/validation/schemas/promotion.schema.ts`, used by `POST /api/admin/promotions` and `PATCH /api/admin/promotions/[id]`) adds `budget?` (rupees, > 0) and `confirmLoss?` (empty, or exactly `"CONFIRM LOSS"`). When the offer could cost more than the lowest commission in force, both are required and refused on their fields otherwise. A shop's `PromotionFormInput` has neither and strips them. `platformSpentPaise`, `lossConfirmedAt` and `lossConfirmedByUserId` are never input: the spend is moved by the order transaction, the confirmer is the session's admin. The offer list (`GET /api/admin/promotions`, `OfferRow`) gains `platformBudgetPaise` (null = no budget), `platformSpentPaise`, `lossConfirmedAt` and `lossConfirmedBy: { name } | null`. A budgeted offer that cannot cover a basket's share is left out of the quote, so preview and charge agree; order creation is refused with a 409 "That offer has just ended. Please review your total." only when another order took the budget in between.

**Shipping is a signed quote, not a figure.** Each rate from `POST /api/shipping/rates` carries `quote`, a server signature over the courier, the charge in paise, the origin and destination pincodes, the billable weight and a 30-minute expiry. Order creation's `shippingGroups[].selectedRate` is `{ quote }` and nothing else (2026-10-14): the charge, courier and provider are read from the signature and checked against the parcel the server allocated, so an edited price, a quote for another address or weight, or an expired one is refused with a 409.

**`salePrice` is no longer a column.** It survives as a field name on the product and cart wire shapes, where it now means *the offer-adjusted price*, resolved server-side through the one function checkout prices with (ADR-0018). The name is retained because every consumer already reads it as "the reduced price"; renaming it is a follow-up, and until then the comment on each producer says what it is. Nothing accepts it inbound except `ProductFormInput`, where it is the seller's markdown and is stored as an offer rather than on the product.

### Payments
- `POST /api/payments/create-order` takes `{ localOrderId, customer? }` and **derives the amount from the persisted order's `grandTotal`** (PR-38) — which was itself computed from the catalogue inside the creation transaction. An `amount` in the body is not read; the field no longer exists in the schema.
- `POST /api/payments/verify` **is the browser-return confirmation trigger** (PR-39): it takes `{ localOrderId, razorpay_* }`, verifies the signature against the persisted order, performs the paid transition, and returns `{ orderId, paymentStatus }`. `POST /api/payments/confirm-free` does the same for zero-total orders. `PATCH /api/orders/[id]` is **deleted** — nothing updates an order from the browser any more.
- Gateway webhook payloads are Razorpay's contract, not ours. See [INTEGRATIONS.md](INTEGRATIONS.md) for the `notes` round-trip.

`POST /api/payments/abandon` (PR-104) takes `{ localOrderId }` — an order reference and deliberately nothing else. It reports that the buyer left the payment window; it does **not** assert what happened to the money, which the server establishes by asking the gateway. Returns `{ orderId, outcome }`, where `outcome` is one of `released`, `confirmed`, `in-flight`, `already-paid`, `already-released`, `not-released`. Safe to call more than once, and safe never to call — the reconciliation sweep reaches the same answer later.

### Admin
`GET /api/admin/shipping/providers` and `GET /api/admin/shipping/providers/[id]` return **`ShippingProviderSummary`** (`server/shipping/repositories/provider.repository.ts`): id, code, name, description, priority, connection state and dates, connection type, payment options, delivery modes, features, logo and website, and `accountInfo` narrowed to `{ email }`. `authToken`, `tokenExpiresAt`, `authError` and the rest of `accountInfo` never leave the server; `POST …/providers/[id]/connect` answers without the token or the password, and the audit record carries neither. `tests/unit/provider-dto.test.ts` holds the projection at type level, so `tsc` fails a widened select. Until 2026-10-05 the rows went out whole — the leak Rule 5 exists for.

### Banners
`BannerFormSchemaInput` (`src/lib/validation/schemas/banner.schema.ts`) is one declaration used by three things — `POST /api/admin/banners`, `PATCH /api/admin/banners/[id]`, and the admin form's resolver — so what an admin sees inline is what the route enforces (ADR-0013).

**`order` is absent from it deliberately, and that absence is the contract.** Display order is server-owned: a create appends to the end, and `PATCH /api/admin/banners/reorder` is the only thing that writes it. Accepting it here even optionally is Rule 7's case exactly — the field a form forgot to send would silently reset the hero's order, and nothing would fail to compile. `tests/unit/home-banners.test.ts` holds the line.

**Every field is optional, `title` included.** A banner may be artwork and nothing else, so the headline widened from required to nullable — an existing client sending one is unaffected, and one sending none now parses. The renderer branches on the absence: with no eyebrow, title, description or action, `HeroBanner` drops the reading scrim rather than fading it, because a phone has no hover to hide it behind. `""` and a whitespace-only title are the same absence as none and normalise to `null`, so the branch has one thing to test. `OrgBannerFormInput` (`src/lib/validation/schemas/org-banner.schema.ts`) widened the same way for an org's own promotions.

Two further shapes worth naming. Action `href` must be **relative** — the hero is the storefront's most prominent surface and an absolute URL sends a shopper off it — and `actions` is capped at two, which is what the banner lays out before a phone wraps a third onto its own line. Null and `""` are the same intent for every optional text column, and the schema normalises to `null` so only one of them reaches the database.

The read side does not cross this boundary: the storefront hero is a server component reading `bannersDAL.getActiveBanners()`, so there is no storefront route handler and no wire shape to keep in step.

### Seller profile

The storefront's public organisation shape is `Storefront` in `src/data-access-layer/storefront.dal.ts` — identity (`id`, `handle`, `name`) plus the public face (`about`, `tagline`, `logoUrl`, `heroUrl`, `accent`, `deliveryPolicy`, `returnsPolicy`). Since [seller-profile](specs/seller-profile/) PR 1 it is built from `OrgProfile` through `PUBLIC_PROFILE_SELECT` and `PUBLIC_ORG_IDENTITY_SELECT` in `server/catalog/org-profile.repository.ts`, and `tests/unit/storefront-public-dto.test.ts` holds both selects to an allowlist: a column added to `Org` cannot reach a buyer. The shape itself did not change in that PR, so the entry carries no `[CONTRACT]`.

Since PR-182 the about page speaks **`BrandPageDto`** (`server/catalog/storefront.types.ts`): identity (`id`, `handle`, `name`) plus the public face — `tagline`, `heroUrl` (the cover), `logoUrl` (the mark), `accent`, `location`, `since` (the year from `Org.joinedAt`), `about` (the introduction), `story`, `deliveryPolicy`, `returnsPolicy`, `brands` (names only, null unless two or more), `social` (links the platform composed from allowlisted handles — `network`, `label`, `handle`, `href`; `server/catalog/social-networks.ts`) and `proof` (null until brand-page part c). Blank text is null, never `""`. It is assembled by `storefrontService.brandPage` and widened once, in `src/data-access-layer/storefront.dal.ts`, to **`BrandPage`** with the marketplace's own `categories` and `newest` — the same priced, bidding-aware tiles the landing page renders, so nothing is priced twice. `PUBLIC_ORG_IDENTITY_SELECT` gained `joinedAt`. `tests/unit/storefront-public-dto.test.ts` holds the DTO's keys to a literal allowlist and checks the serialised payload for any brand's private value. Read-only: no route handler, no wire shape — the page is a server component.

Since PR-184 `BrandPageDto.proof` is filled — `{ rating: { average, count } | null, ordersFulfilled: number | null }`, or null when nothing cleared a floor (`server/catalog/brand-page-proof.ts`: three published reviews for a rating, ten paid orders for a count) — and the DTO gains **`buyersSay`**: `ShopReviewDto[] | null`, the shop's three newest published reviews across its on-sale products, null under the rating's floor. **`ShopReviewDto`** (`server/catalog/review.types.ts`) is a `Pick` of `ReviewDto` — `id`, `rating`, `comment`, `authorName`, `isVerifiedPurchase`, `createdAt` — plus `product: { name, slug }`; no `isMine`, and as `ReviewDto`, no `userId`. Both slices come through public surfaces: `reviewService.ratingForOrg` / `recentForOrg` and `orderService.paidOrderCountForOrg`, paid orders counted as orders. `toBrandPageDto` takes them as a third argument.

Since PR-209 **`MediaAssetDto`** carries `orgId` (null is the platform's own collection),
`retiredBy` (`ORG` or `PLATFORM`) and `retiredReason`, so a shop can read why its picture went
without an admin to ask. One route is added: `POST /api/admin/media/:assetId/retire` takes
`{ reason }` — required, four characters up — and answers the asset. The listing behind
`/admin/media` is `mediaAssetService.listAnywhere`, the same query the shop's own library runs
with the organisation filter widened; it is read through a server component and has no route.

Since PR-208 the DTO carries the shop's own additions and its choice of what to leave out.
**`owner`** is `{ name, role, quote, photoUrl } | null`, null unless a name is given — a face
with no name is not an introduction, so the other three are kept in the column and not shown.
**`pillars`** was `{ title, text }[] | null`; it left the DTO in org-profile unit 4 (below).
**`hiddenSections`** is the keys the shop has switched off, from
`HIDEABLE_BRAND_PAGE_SECTIONS` in `server/catalog/brand-page-sections.ts` — where the section
order, the hideable subset and the defensive readers for both JSON columns are declared once,
because the schema, the page and the shop's own panel all need them and must agree.

Hiding is subtraction, not a flag: a hidden section's content is left out of the payload
entirely, so no renderer can show it by mistake, and the introduction goes with the story
because they are one section. What a shop may hide is what it wrote. Reviews, orders filled
and the goods are not offered, because proof is derived and never typed and a page whose
reviews vanish when they turn unflattering is not proof. `storefrontSettingsSchema` grows to
match, so the same rules the page enforces are the ones the editor shows inline.

Since [org-profile](specs/own-store/org-profile/) unit 1, `POST /api/orgs` parses **`openShopSchema`**
(`src/lib/validation/schemas/org.schema.ts`): `name` (3–100), `phone` (required, any country, parsed by the
shared `phoneSchema` to E.164) and `email`. Any other key is stripped, so contact person, business name, GST,
PAN and description can no longer arrive through self-serve creation. The answer is unchanged
(`201` with the org). `POST /api/admin/orgs` still parses `createOrgSchema` (Q22).

Since org-profile unit 2, **`PATCH /api/org/[orgId]/shop/details`** (`withOrg`, any member) parses
**`shopDetailsSectionSchema`** (`src/lib/validation/schemas/shop-details.schema.ts`): a union on `section`
(`essentials`: `tagline`, `logoUrl` · `about`: `about` up to 4,000 · `place`: `location` · `person`: `ownerName`,
`ownerRole`, `ownerQuote`, `ownerPhotoUrl` · `social`: `social` · `promise`: `returnsPreset`, `promiseNote` up to
280), each strict, each carrying `expectedUpdatedAt` (ISO). It answers **`ShopDetailsDto`**
(`server/catalog/shop-details.types.ts`), with no code, GST, PAN or business name. A stale version is `409` with
"Someone changed this N min ago. Load their version?". `RETURNS_PRESET` is `STANDARD`, `EXCHANGE_7_DAY`,
`NO_RETURNS`. `BrandPageDto.about` is now `aboutOf` the profile (introduction and longer story joined until the
shop saves About); `story` is always null; `deliveryPolicy`/`returnsPolicy` are replaced by
`returns: { preset, note } | null`. `Storefront` (`storefront.dal.ts`) loses `deliveryPolicy`/`returnsPolicy`.
`storefrontSettingsSchema` is narrowed, strictly, to `heroUrl`, `accent`, `pillars`, `hiddenSections`.

Since org-profile unit 3, **`PATCH /api/org/[orgId]/shop/contact`** (`withOrg`, owner only; staff get `403`
"Only the shop owner can change this.") parses **`shopContactSchema`** (`shop-details.schema.ts`): any of `name`,
`phone`, `email` (the `openShopSchema` rules) plus `expectedUpdatedAt`, the org's own version; strict, at least one
field. It answers `ShopDetailsDto`, which gains `phone`, `email` and `contactUpdatedAt`. A stale version is `409`
with the same copy. An email change enqueues **`org.email-changed`** (`server/shared/jobs/org-email-changed.job.ts`:
`orgId`, `shopName`, `oldEmail`) in the same transaction. A refused handle change now reads "That link is taken."
plus "Try {suggestion}." when a numbered variant is free.

Since org-profile unit 4, "How you work" is retired (D5): `BrandPageDto` loses `pillars`, `PUBLIC_PROFILE_SELECT`
no longer reads the column, `"pillars"` leaves `BRAND_PAGE_SECTION_ORDER` and `HIDEABLE_BRAND_PAGE_SECTIONS` (a stored
hidden key is dropped on read), and `storefrontSettingsSchema` is narrowed, strictly, to `heroUrl`, `accent`,
`hiddenSections`, so a `pillars` key is refused. `OrgProfile.pillars` and its data are kept.

Since storefront-themes unit 3 `Storefront` (`storefront.dal.ts`) gains **`themeKey`** and **`paletteKey`**, the
published look parsed by `readStorefrontLook` (both null for an unthemed shop or a key retired from code);
`PUBLIC_PROFILE_SELECT` reads the two columns and its allowlist test moves with it. **`StorefrontPageDto`**
(`server/catalog/storefront.types.ts`) is `BrandPageDto` plus `themeKey`, `paletteKey`, `bestSellingIds` (by units
in paid orders over 90 days, Q34) and `dispatchDays` (median whole days from paid to ready, null under three
parcels, Q39), from `storefrontService.storefrontPage` — null until the shop publishes a look (Q19). The DAL widens
it to **`StorefrontPage`** with priced `bestSelling`, `newIn`, `categories` and `productCount`. `ShopListing` gains
`themed`. Read-only: no route handler and no wire shape; `ProductFilter` gains server-resolved `ids`.

Since storefront-themes unit 4 `StorefrontPage` gains **`offers: StorefrontOfferDto[]`** and **`dealProducts`** (priced
goods on the shop's own offer, 8 at most; `ProductFilter` gains server-set `ownOffersOnly`, so a platform offer adds none). **`StorefrontOfferDto`** (`server/promotions/storefront-offers.ts`, from
`promotionService.storefrontOffers`) is `{ id, title, headline, ends, code, fewLeft }`: the shop's running automatic
offers and the codes it ticked, worded from the offer (Q13), soonest ending first; `code` only when ticked (Q20),
`fewLeft` at ten or fewer uses with no count (Q36); a sale price is not a card (Q41). **`PromotionFormInput`** (the
shop's `promotionFormSchema`, `POST /api/org/[orgId]/promotions` and `PATCH …/[id]`) gains **`showOnStorefront`**
(boolean, default false), stored as `Promotion.showOnStorefront` only for a shop's code; `PlatformPromotionFormInput`
strips it.

Since storefront-themes unit 5 a shop publishes its look through **`StorefrontLookInput`**
(`storefrontLookSchema` in `src/lib/validation/schemas/storefront.schema.ts`, `PUT /api/org/[orgId]/storefront/look`):
`{ theme, palette, lookVersion }`, strict, the palette one of its theme's three. **`StorefrontRevertInput`**
(`storefrontRevertSchema`, `POST …/storefront/look/revert`) is `{ lookVersion }` alone: what it restores is the
server's record. Both answer **`StorefrontLookState`** (`server/catalog/storefront-look.types.ts`): `orgId`, `handle`,
`name`, `live: { theme, palette }` (both null before any theme), `lookVersion`, `publishedAt` (ISO or null) and
`previous: { theme, palette, until } | null` while it is kept (30 days, Q4). A stale `lookVersion` is 409 with
"{Name} published {theme} {n} min ago." (Q31); a switch back after the 30 days is 410 "Your previous look is no
longer kept."; a member who is not the owner gets 403.

Since storefront-themes unit 6 **`StorefrontSettingsInput`** (`storefrontSettingsSchema`, `PATCH
/api/org/[orgId]/storefront`) loses `accent` and gains a required **`expectedUpdatedAt`** (ISO; the save is a
compare-and-set on it, a miss 409 "Changed by {Name} just now. Load theirs?") and the editor's optional
`heroLine` (≤120), `heroPhotos` (≤3 URLs of the shop's own ready photos), `collections` (≤6 `{ categoryId,
photoUrl? }`, categories it sells in), `claims` (≤3 `{ key, detail? }`, keys on its own list in
`server/catalog/storefront-claims.ts`, else 400 on `claims`), `openingHours` (`{ open, close, closedDays }`) and
`storefrontHiddenSections`; strict, so no proof figure has a key (A7). Only fields sent change. `GET` answers
**`StorefrontSettingsDto`** (`server/catalog/storefront.types.ts`): those values parsed, `updatedAt`, and the
sheet's `claimOptions` and `categoryOptions`. **`StorefrontPageDto`** gains `heroLine`, `heroPhotos`, `collections`
(`{ slug, name, photoUrl }`), `claims` (`{ label, detail }`), `openingHours` and `themedHiddenSections`; a hidden
section's content is left out (story's `about` and `owner` too). **`StorefrontLookState`** gains `suggested: { theme,
label } | null`. `MediaUseDto.kind` gains `storefront-collection`; `ReferenceCounts` gains `storefrontSlots`.

Since order-fulfilment unit 2 a shop's orders read as **`ShopOrderView`** / **`ShopParcelView`**
(`server/checkout/shop-parcel.types.ts`): only the shop's own parcels on paid orders, each with `status`,
its lines and `parcelValue`, `position`/`ofCount` ("Parcel 1 of 2"), and the buyer as **`ShopBuyer`
`{ name, city, pincode }`** — no phone, street, landmark or email, and no basket totals (D7, Q22, A10).
`OrgOrderView` is gone. **`POST /api/org/[orgId]/shipments/[id]/ready`** (`withOrg`, no body) moves a paid
parcel of that shop from `packing` to `ready_for_pickup` and answers `{ ok: true }`; another shop's parcel,
or an unpaid one, is `404`; a cancelled one is `409` "This parcel was cancelled by {the buyer / you / us} on
{date}. Don't send it."; one already moved on is `409` "This parcel is already …". **`PATCH
/api/org/[orgId]/orders/[orderId]/transition` is deleted** (Q36). **`POST
/api/admin/shipments/[id]/email-shop`** (platform admin, no body) answers `{ message: "Email sent to {shop}." }`
for a paid parcel 36 h+ unpacked; `404` once it left the list, `409` if already emailed. `PATCH
/api/admin/shipments/[id]/tracking` now refuses a parcel the shop has not marked ready (`409`).

Since order-fulfilment unit 3, **`POST /api/admin/shipments/[id]/booking`** (platform admin) parses
**`bookingSchema`** (`src/lib/validation/schemas/booking.schema.ts`): `pickupDate` and `estimatedDelivery` as
India days `"YYYY-MM-DD"` (delivery strictly after pickup), `courierName`, `trackingNumber` (the AWB),
`trackingUrl` (https) and `labelUrl` (a Shiprocket label host, `server/shipping/label.ts`); all required. It moves
a `ready_for_pickup` parcel to `pickup_booked` and answers `{ ok: true }`. Refusals are `409` with ux.md's copy: an
AWB on another parcel ("This AWB is already on {code}.", `field: "trackingNumber"`), not ready, cancelled, or
"Already booked by {name} at {time}.". **`PATCH` on the same path** parses **`pickupDateChangeSchema`**
(`pickupDate` not before India's today, `estimatedDelivery`, and `seenPickupDate`, the date the panel opened with):
compare-and-set; a stale date is `409` "Changed to {day} by {name} at {time}.". **`POST
/api/admin/shipments/[id]/picked-up`** (no body) moves a booked parcel to `picked_up`. **`GET
/api/org/[orgId]/shipments/[id]/label`** (`withOrg`) streams the parcel's label as an attachment only while it is
`pickup_booked` and only to its own shop (otherwise `404`; an unreachable label host `502`). `ShopParcelView` gains
`pickupDay` ("Sat 2 Nov"); `AdminShipmentView` gains `pickupDate`, `pickupDay`, `estimatedDelivery`. Every
reader's timeline is **`ParcelTimelineDto`** (`server/checkout/parcel-timeline.ts`): `courierName`,
`trackingNumber`, and `entries` of `{ kind, status, actor, reason, courierWording, pickupDate, estimatedDelivery,
day, time, at }`, every date already India's. **Deleted** (Q36): `PATCH /api/admin/shipments/[id]/tracking` and
its schema; **`PATCH /api/admin/orders/[id]`** (`updateOrderStatusSchema`) is deleted too — an order's status is
only the summary of its parcels.

Since order-fulfilment unit 4 the courier webhook is **`POST /api/webhooks/shipping/tracking`** (was
`/api/webhooks/shipping/shiprocket`, deleted). It requires the header **`x-api-key`** equal to
`SHIPPING_WEBHOOK_TOKEN`, compared in constant time before the body is read; missing, wrong or unconfigured is
`401`. The body is parsed by `shiprocketWebhookSchema` (`awb`, `shipment_status`, optional `etd`, read as an India
day); unparseable is `400`. An applied, ignored or unmapped update is `200`; an AWB no parcel carries, or a move on
a cancelled parcel, is recorded as a `CourierConflict` and also answered `200`; a failure applying it is `500`, so the
courier retries (Q32). **`POST /api/admin/courier-conflicts/[id]/dismiss`** (platform admin, no body) dismisses that
row and every other open row for its AWB; `404` for an unknown id.

Since order-fulfilment unit 5 a paid parcel is cancelled by one of three routes, each answering the refusals in
ux.md's words as `409` (`CANCEL_REFUSAL`, `server/checkout/parcel-cancel.types.ts`) and any parcel the caller may
not see as `404`; an unpaid order's parcel is `409` (Q9). **`POST /api/org/[orgId]/shipments/[id]/cancel`**
(`withOrg`) and **`POST /api/admin/shipments/[id]/cancel`** (platform admin) parse **`shopCancelSchema`**
(`src/lib/validation/schemas/parcel-cancel.schema.ts`): `reason`, one of `SHOP_CANCEL_REASON` (required, "Pick a
reason."), and `other`, up to 120 characters, required when the reason is `other` ("Tell us the reason in a few
words."). The shop may cancel from `packing` and answers `{ feePaise }` (the fee charged); the admin until
`picked_up` and answers `{ awb }` (null unless it was booked). **`POST /api/orders/[orderId]/shipments/[id]/cancel`**
(signed-in owner only, `401` without a session, rate-limited under `ORDER`) parses **`buyerCancelSchema`**: optional
`reason` from `BUYER_CANCEL_REASON` and `other`; it may cancel from `packing` and answers `{ refundPaise }`. No body
field carries money: what is refunded, restocked or charged is the server's. **`PUT /api/admin/settings/fulfilment`**
(platform admin) parses **`fulfilmentFeeSchema`**: `feeRupees`, a whole number 0–1,000 ("Enter an amount from ₹0 to
₹1,000, in whole rupees."), and `seenVersion`; a stale version is `409` "Changed to ₹{fee} by {name} at {time}.
Check before saving."; it answers the saved **`FulfilmentSettingsView`** `{ feeRupees, feePaise, version,
updatedByName, updatedAt }`. `ParcelTimelineDto` gains optional `refundStarted`; the buyer's `Shipment` gains
`org.name`. **`createSettlement`** now refuses (`400`) a selection that leaves any of the org's unsettled negative
entries behind, or totals ₹0 or less (`SETTLEMENT_REFUSALS`, D15).

Since order-fulfilment unit 6 **`POST /api/admin/refunds/[id]/start`** (platform admin, no body) starts a refund
owed at Razorpay for the row's own amount (D17). It answers **`RefundStartOutcome`** (`server/payments/refund.types.ts`):
`{ kind: "started", gatewayRefundId, amountPaise }`, `{ kind: "unconfirmed" }` (no answer within 10 s, or a lookup
that failed; the row is `UNCONFIRMED`) or `{ kind: "refused", reason }` (Razorpay's own words; the row is `FAILED`).
A row already started, or being started by another press, is `409` "Already started by {name}."; an order with no captured
payment, or a server without Razorpay keys, is `409` in our words with the row untouched (Q38); an unknown id is
`404`. The admin's list reads **`RefundRow`** (`server/checkout/refund-queue.ts`) on the server; it crosses no route.

### Shop setup list

Since seller-onboarding unit 3 **`OnboardingStatus`** (`server/catalog/org-onboarding.types.ts`) is
`{ steps: { key, done }[], doneCount, next, complete, hidden }`: five steps (`ONBOARDING_STEP`,
Q19's order), `next` the first not done or null. `readiness`, `READINESS_STATE`, `STORE_MISSING`
and the re-exported channel set are gone (Q4); channel readiness lives in `server/listing/`. Read on
the server only (Home), never sent by a route. Two routes, `withOrg`, no body, each answering
`{ ok: true }` and idempotent: `POST`/`DELETE /api/org/[orgId]/setup/hidden` (hide, unhide) and
`POST /api/org/[orgId]/setup/shared` (the first share). Caller: `src/components/org/home/setupApiClient.ts`.
**`HomeAttentionDto`** (`src/data-access-layer/org/home.dal.ts`) is a server read for Home's lines,
each `{ ok: true, value } | { ok: false }`; no wire shape.

### Listing vocabulary

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
([categories](specs/listing-vocabulary/categories/) D1b), so a payload cannot put a product under
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
([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)).

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
`GET` ([ADR-0034](adr/0034-render-on-the-server-by-default.md)).

`ProductStats` gains `familyCount` — how many families the available products belong to. Two
numbers rather than one, because twenty abayas in five colours is twenty families and a hundred
sellable things, and a figure that does not say which it counts is the ambiguous one
([variants](specs/listing-vocabulary/variants/) D6).

### Channels

Three shapes cross the wire, all of them decisions rather than reads
([channel-registry](specs/channel-registry/)).

**A shop's channels** — `PUT /api/org/[orgId]/channels`, schema
`src/lib/validation/schemas/org-channels.schema.ts`. The whole set the form showed is sent every
time, so a channel the body omits is one the form did not render, never one being switched off:
treating silence as "off" would turn off whatever a later release adds the moment a page loaded
before it posted. `store` is not among the accepted values — a shop does not opt into the place
it already is.

**A value mapping and a not-sold decision** — `PUT /api/admin/channels/values` and
`/api/admin/channels/not-sold`, both in `channel-mapping.schema.ts`. `theirValue` is free text
because it is somebody else's vocabulary, which goes stale on their release schedule rather than
ours. Both upsert on the natural key, so sending one again is a correction and not a second row.

**Readiness of a saved product never crosses the boundary.** The verdict is computed on the
server and rendered there ([ADR-0034](adr/0034-render-on-the-server-by-default.md)). The one
exception is the unsaved product form ([product-form](specs/own-store/product-form/) D4):
`POST /api/org/[orgId]/products/readiness` takes `productReadinessSchema`
(`src/lib/validation/schemas/product.schema.ts`) — `categoryId` (blank answers nothing), `kind`,
`familyId`, `brandId`, `facts` as bare answers — fills them as a save would and answers the
existing `ChannelVerdict[]` (`server/listing/channel-readiness.service.ts`). The org is the
membership's, never the body's; nothing is written, and nothing of the answer reaches the save.
The browser only words the verdict; the server still decides it.

### Channel connections

Since channel-connectors ([spec](specs/marketplace-integration/channel-connectors/)) the org portal
reads **`ChannelsOverviewDTO`** (`server/channels/channel-connection.types.ts`) on the server: `cards`
(one **`ChannelCardDTO`** per channel — `channel`, `label`, `state` from `CARD_STATE`, who connected
or disconnected and when, `lastCheckedAt`, `stale`, `reapproveBy`, `reason` from `CONNECTION_ERROR`)
and `attention` for the dashboard banner. **No token, external account id or marketplace text is
in any of them** ([server/channels/CLAUDE.md](../server/channels/CLAUDE.md)).

Four routes, none with a request body:
- `GET /api/org/[orgId]/channels/[channel]/connect` — a link the browser follows; answers 302 to
  the marketplace's consent page, or back to `/org/[orgId]/channels?result=<CONNECT_RESULT>&channel=…`.
- `GET /api/channels/[channel]/callback` — the marketplaces' redirect; always answers 302 to the
  same Channels URL with one `CONNECT_RESULT` code, never an error body.
- `DELETE /api/org/[orgId]/channels/[channel]/connection` — `{ ok: true }`; 404 in the envelope
  when there is nothing to disconnect.
- `POST /api/org/[orgId]/channels/[channel]/connection/check` — `{ result: "ok" | "needs_reconnect" | "unreachable" }`.

`CONNECT_RESULT` is a closed set (connected, cancelled, expired, other_session, other_shop,
different_account, unreachable, full, unavailable); a client renders each with ux.md's copy and
nothing else. Google and Meta still turn on and off through `PUT /api/org/[orgId]/channels` above; since channel-connectors that schema accepts only `google` and `meta`, because a marketplace is on only by connecting it (D11).

### Marketplace listings

Since channel-import ([spec](specs/marketplace-integration/channel-import/)) each `ChannelCardDTO`
also carries `read` — a **`ChannelReadDTO`** (`state` from `READ_STATE`, `total`, `done`,
`startedAt`, `finishedAt`, `error` from `READ_ERROR` — busy, auth, other_shop, not_allowed,
different_account — and `stalled`) — and `listings` (`{ total, linked }`), both
null unless the marketplace is connected; `reason` may now be `other_shop` on a card that is not
connected, when a read found the account already in another shop.

The Listings page and the product page read on the server, through `channelListingsDAL`:
**`ChannelListingsPageDTO`** (`channel`, `label`, `connected`, `read`, `counts { linked, notLinked }`,
`listings`, `hasMore`), whose rows are **`ChannelListingDTO`** (the marketplace's `sku`, `externalId`,
`title`, `imageUrl`, `status` from `LISTING_STATUS`, `pricePaise` in integer paise, `quantity`, the
variation `parentSku`/`parentTitle`/`variationAxis`, the linked `product { id, name, sku, archived }`
or null, `linkSource`, `unlinkedByOwner`, `gone`); **`ChannelListingDetailDTO`** for the details
panel (`listing`, the linked product's own values, `linkBackTo`); and
**`ProductMarketplaceLinkDTO[]`** for a product — one per connected marketplace, its `listing` null
when not linked. Price and stock are what the marketplace last reported; nothing in them is charged.

Three routes, all `withOrg`, none with a request body:
- `POST /api/org/[orgId]/channels/[channel]/listings/read` — `{ ok: true }`; 409 in the envelope
  when the marketplace needs reconnecting.
- `POST /api/org/[orgId]/channels/[channel]/listings/[id]/unlink` — `{ ok: true }`; 404 when the
  listing is not this shop's or not linked.
- `POST /api/org/[orgId]/channels/[channel]/listings/[id]/link-back` — `{ listing }`; 404 when it
  was not unlinked by the owner, 409 when no product has its SKU any more.

### Settling marketplace listings

Since product-merge ([spec](specs/marketplace-integration/product-merge/)) `ChannelListingDTO` also
carries `leftOff`, a `suggestion` (`{ kind: SUGGESTION_KIND, text }`, same SKU elsewhere or a similar
product) and `photos` (`{ total, done, failed }` while copying); `ChannelListingsPageDTO.counts`
gains `leftOff` and the page `showingLeftOff`; the card's `listings` gains `toSettle`; a product's
`ProductMarketplaceLinkDTO.listing` gains `linkSource` and `photos`. The Settle page reads
**`SettleDetailDTO`** on the server (`primary` and an optional `pair`, each a **`SettleSideDTO`** read
live from its marketplace; the `product` being matched with its stock per location; `locations`,
`defaultCategoryId`, `readFinishedAt`).

Routes, all `withOrg`:
- `POST /api/org/[orgId]/channels/settle` — body `settle-listing.schema.ts`: `listingIds` (one or
  two, one per marketplace), `productId` when matching, `name`/`description` when chosen,
  `photosFrom` (a listing id, never a photo address) or `uploadedPhoto` (a ready asset's URL), `sku`
  (any SKU of 1–64 characters, since product-merge Q31; each listing keeps its own), `price` in rupees (stored as paise), `categoryId`, `stock` per location
  with `seenQuantity` when matching, `onSale`. Answers `{ result: SettleResultDTO }`; 409 in the
  envelope when settled meanwhile, a SKU is taken, the stock moved or the product is already linked
  on that marketplace; 502 when the main photo could not be copied.
- `GET /api/org/[orgId]/channels/settle/products?listing=…&q=…` — `{ similar, all }` of
  **`SettlePickerProductDTO`** (`linkedHere` when already linked on that marketplace).
- `POST …/channels/[channel]/listings/[id]/leave-off`, `…/bring-back`, `…/photos/retry` — `{ ok: true }`.

### Facts from a marketplace

Since marketplace-facts ([spec](specs/marketplace-integration/marketplace-facts/)) a stored fact or
measurement entry may carry `source` — `{ channel, value, readAt, chosen? }`, the marketplace and
its own words — beside `origin`, which gains `"marketplace"` (`server/listing/listing-facts.ts`). The
entry keeps `source` when the shop changes the answer, so "was Crepe from Amazon" can be shown; the
product form's DTOs (`admin.product.types.ts`, `console/types.ts`) carry it. `Product.mrpPaise` is
integer paise, filled only when empty. `ChannelListingDTO` gains `waitingForType`
(`{ marketplaceType }` when parked with reason `no_type`); `SettleDetailDTO` gains `type`, a
**`SettleTypeDTO`** (`kind` mapped / choose / none, `marketplaceType`, `types`) and, since Q35, `facts`,
a **`SettleFactsDTO`** (`typeOfCategory` category id → type key, `byType` type key → `fills`,
`questions`, `noMapping`; `matching`, and `fixedType` when matching; `saysNothing`). A typed SKU is
refused when another product's matches it ignoring case and spaces. The settle body takes
`answers` (fact → our answer's key, at most 60); the server re-plans from the listing's stored read
and keeps an answer only for a fact still asked and one of our answers to it. The product page
reads **`ProductMarketplaceFactsDTO`** per linked listing (`server/channels/channel-facts.types.ts`):
`state` from `FACTS_STATE`, `readAt`, `marketplaceType`, `filled` (**`MarketplaceFactRowDTO`**: label,
value, the marketplace's words, `chosen`, `changed`, `options`), `questions`, `staleCheckedOn`,
`types` (**`TypeChoiceDTO`** with its categories), `sku`, `title`.

Routes:
- `POST /api/org/[orgId]/channels/[channel]/listings/[id]/facts` (`withOrg`) — body
  `marketplace-facts.schema.ts`, one of `fill`, `answer` / `change` (`fact`, `value` a key of our
  list), `reset` (`fact`), `skip` (`fact`, `skipped`), `category` (`categoryId`). Answers
  `{ ok: true, outcome? }`, `outcome` on `fill` only: `filled`, `busy`, `reconnect` or `not_linked`;
  409 in the envelope when the fact was answered meanwhile, naming the answer.
- `POST …/listings/[id]/leave-off` takes an optional body `{ reason: "no_type" }`.
- `PUT /api/admin/channels/types` (`requirePlatformAdminId`) — `channelTypeChangeSchema`: `add`
  (`channel`, `productType`, `kind`, `theirCategory`), `publish` (`id`), `remove` (`id`,
  `typeLabel`); 409 when removing the publishing type or adding one already listed.

### Families from marketplace listings

Since family-merge ([spec](specs/marketplace-integration/family-merge/)) the family page reads
**`FamilyPageDTO`** on the server (`server/channels/channel-family.types.ts`): the marketplace, the family
being added to (or null), a starting `name` and `description`, `members` (**`FamilyMemberDTO`**: the
listing, its live read's state, and the product it already is, with that product's other family),
`more` beyond the page's 30, the type question, `typeOfCategory`, and `byType`, a
**`FamilyTypePlanDTO`** per type (its axes, each marked `added` when beyond the type's own, each
member's values and questions, the shared facts and questions, and duplicates). The Listings page's
`ChannelListingsPageDTO` gains `groups` (**`ListingGroupDTO`** per variation group: `state` from
`GROUP_STATE`, every member's listing id, totals, the family and how many sit outside it),
`firstFamily` and `sameItem` (suggested groups); `SettleDetailDTO` gains `group`.

Routes, both `withOrg`:
- `POST /api/org/[orgId]/channels/family` — body `family-settle.schema.ts`: `listingIds` (up to 30),
  `familyId` when adding, `name`, `description`, `categoryId`, `removedAxes`, `answers` (listing id →
  fact → our answer's key; the family's under `"*"`), and per member `include`, `move`, `sku`, `price`
  in rupees (stored as paise) and `stock`. Answers `{ result: FamilySettleResultDTO }` (`familyId`,
  `familyName`, `members`, `axisWord`); 400 in the envelope for two members alike, an unanswered one,
  a missing type or a price; 409 for a SKU in use, a product in another family not moved, or listings
  settled meanwhile; 502 when a member's main photo cannot be copied. Everything is planned again on
  the server; an answer counts only for a fact that member was asked.
- `POST …/channels/[channel]/listings/dismiss-group` — `{ listingIds }`; `{ ok: true }`.

### Stock sync and marketplace orders

Since inventory-sync ([spec](specs/marketplace-integration/inventory-sync/)) channels reads, on the
server, from `server/channels/channel-stock.types.ts`: **`StockSyncSectionDTO`** (the marketplace's
`state` from `STOCK_SYNC`, whether locations need matching and which one is new, last sent and checked
times, whether every listing is stocked by the marketplace, today's corrections), **`StockPreviewDTO`**
(a **`StockPreviewRowDTO`** per linked listing: their count or null when unread, ours, whether it
changes), **`LocationMatchDTO`** (each **`ChannelLocationDTO`** with its match, "not used", a
pincode suggestion, gone and closed flags, plus the shop's locations) and **`MarketplaceOrderDTO`**
(order and SKU, quantity, the amount in paise as reported, `state` from `ORDER_LINE_STATE`,
oversold, `locationGuessed`, `beforeSync`, `unlinked`). The section also carries `problem` (`STOCK_PROBLEM`: busy
or refused), `sending` (sent of total since sync went on) and `refused` (listings turned down). A product's marketplace link gains
`stock`: last sent, when, `heldByMarketplace`, and an oversold order still waiting to ship, or null
while sync is off.

Routes, both `withOrg`:
- `PUT /api/org/[orgId]/channels/[channel]/stock-sync` — body `stock-sync.schema.ts`
  (`stockSyncChangeSchema`): `{ action: "on" | "pause" | "off" }`; "on" is sent from the preview and
  enqueues a send for every linked product. Answers `{ ok: true }`; 409 when not connected.
- `PUT /api/org/[orgId]/channels/[channel]/locations` — `locationMatchSchema`: `matches`, each
  marketplace location to one of the shop's active locations or not used, never both. `{ ok: true }`;
  400 for a location not the shop's or closed.

### Image enhancement

Since PR-185 the org portal speaks **`EnhancementDto`** (`server/content/enhancement.types.ts`): `id`, `tool`, `preset`, `state`, `sourceAssetId`, `sourceRef`, `proposalUrl` (null unless the state is `PROPOSED`), `resultAssetId`, `resultRef`, `error`, `costPaise` (integer paise, [Invariant 3](../CLAUDE.md)), `createdAt`, `proposedAt`, `decidedAt` — beside **`EnhancementUsage`** (`used`, `allowance`, `paused`, `pauseReason`), which every answer carries so the sheet can say where the shop stands. Four routes, all `withOrg` and parsed by `src/lib/validation/schemas/enhancement.schema.ts`: `POST /api/org/:orgId/enhancements` (`{ sourceAssetId? | sourceRef?, tool, preset?, slot?, slotRole? }`, exactly one of the first two: the library names a photo by its asset id, the gallery editor knows only the URL of one it has just put up, and a request carrying both or neither is a 400) → `{ enhancement, usage }`; `GET …/:id` → `{ enhancement }`, which the sheet polls while the worker runs; `POST …/:id/accept` → `{ enhancement }` with `resultRef`, the derived image's URL; `POST …/:id/discard` → `{ enhancement }`. A refusal is a `DomainError` with the reason the org member reads ([image-enhancement](specs/image-enhancement/) R7, R10). Since PR-198 `preset` is **not free text**: it is one of the keys in `server/content/scene-presets.ts`, required when `tool` is `SCENE` and refused on every other tool, so a request carrying a description nobody approved is a 400 rather than a row (R11).

Two admin routes since PR-190, both `requirePlatformAdminId` and parsed by the same schema module. `PUT /api/admin/enhancements/settings` takes `{ defaultMonthlyAllowance, dailyCapPaise }` — both positive integers, the cap in **paise** (Invariant 3), since the form shows rupees and converts before it sends — and answers `{ settings }`, an **`EnhancementSettingsDto`** of `defaultMonthlyAllowance`, `dailyCapPaise` and `configured` (false while those are the code's fallbacks and nothing has been saved). `PUT /api/admin/enhancements/orgs/:orgId` takes `{ monthlyAllowance, paused, pauseReason }` — `monthlyAllowance` is `number | null`, and **null is not a missing field**: it says the org defers to the platform, which is what lets its row be deleted rather than kept holding a copy — and answers `{ policy }`, an **`OrgEnhancementPolicyView`** of `monthlyAllowance` (resolved), `monthlyAllowanceOverride` (what the org's own row says, or null), `paused` and `pauseReason`. `EnhancementUsage.allowance` is likewise the **resolved** number — the org's override where it has one, else the platform's setting, else the fallback in `server/content/enhancement.types.ts` — so a refusal names the number that actually applied.

The editor's shape is `StorefrontSettingsInput` in `src/lib/validation/schemas/storefront.schema.ts`, parsed by the settings route and rendered by `useServerForm`; it too now reads and writes the profile. Since PR-162 the portal's listing-context screen speaks two private-face shapes, neither of which reaches a storefront payload: **`BrandDto`** (`server/catalog/brand.types.ts` — `id`, `name`, `manufacturer`, `packerOrImporter`, `countryOfOrigin`, `isDefault`, `retiredAt` as ISO or null) and **`OrgListingDefaultsDto`** (`server/listing/org-listing-defaults.types.ts` — `countryOfOrigin`, `taxRatePercent`, `taxCodes` as a list of `{ categoryId, taxCode }`). The write shapes are `brandSchema` / `updateBrandSchema` and `listingDefaultsSchema` in `src/lib/validation/schemas/`, two envelopes for the brand as for locations. **The wire talks percent and a list; the column holds basis points and a JSON map keyed by category id**, converted in one place, so a reader never divides. Only a brand's name is required anywhere here ([seller-profile](specs/seller-profile/) R5). **`countryOfOrigin` is an ISO 3166-1 alpha-2 code** on both shapes, since PR-164 — `COUNTRY_CODES` in `server/shared/countries.ts` is the closed set the schemas accept, and `countryName` is how a code is shown.

### Media uploads

A browser-direct upload talks to two routes, named as a pair in `src/lib/image/upload-endpoints.ts` and driven by `uploadDirect` in `src/lib/image/upload-direct.ts` ([media-library](specs/media-library/) trd D2). The token response — `PresignedUpload` in `server/catalog/object-store.ts` plus `assetId` — now carries the id of the asset record registered before signing; a route that registers nothing (review photographs) omits it and the client skips the confirm. The confirm body is `confirmUploadSchema` in `src/lib/validation/schemas/upload.schema.ts`: the asset id and, when the browser could read them, the dimensions; the server reads the object itself otherwise. Additive on the wire, so `[CONTRACT]` marks the change without breaking a client that ignores the new field. Since PR-166 the token request may carry `contentHash` (SHA-256 hex of the bytes) and the response may be the `duplicate` variant instead of a permission; a client that never sends a hash never sees it. Since PR-178 it may also carry `derivedFrom` (`derivedFromSchema` in the same file), and `uploadDirect` hands its callers the asset id beside the URL, which is what a crop names as its source.

### Addresses
The address-book wire shape (`DeliveryAddress`) is flat and stable, but since PR-41 its `id` is the **UserAddress** relationship id (server-generated — clients no longer mint ids), `metadata` is gone (label and notes are top-level), and `fullName`, `mobile`, `state` are required. Storage is two tables: `Address` (postal fact, written only by `server/shared/address.repository.ts`) and `UserAddress` (the person's relationship). `Order.address` remains an embedded snapshot, deliberately.

### Phone numbers
Since PR-102 every phone on the wire — `DeliveryAddress.mobile`, `User.mobile`, `Org.phone`, `OrgLocation.contactPhone`, a guest bidder's `guestPhone`, and `Order.address.mobile` on new orders — is **E.164** (`+919876543210`). Inbound, any valid spelling of any country's number is accepted and normalised by `phoneSchema` / `optionalPhoneSchema`; a number without `+` is read as Indian, so a pre-PR-102 caller still works. Orders placed earlier keep a bare 10-digit snapshot, and readers display through `formatPhone` (`server/shared/phone.ts`), which treats both spellings alike. The rule lives in that module and nowhere else ([international-phone](specs/international-phone/trd.md)).

### Products
`ProductFormInput` has **one declaration** since PR-45 — `server/catalog/admin.product.types.ts`, re-exported by `src/components/product/console/types.ts`. It is the shape that already drifted once: `weight` was required by the client copy, absent from the server one, therefore collected and never written ([PR-22](CHANGELOG.md)). The same PR collapsed the ten copies of the org summary block (two domain files, two server types, six inline prop types — [consumer-inventory.md](specs/multi-vendor-marketplace/consumer-inventory.md) §1) into `OrgSummary` (`server/catalog/org.types.ts`), which is where PR-49 removed the `default*` fields in one edit when [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) replaced them with pickup locations — `OrgSummary` is now `{ id, name, code }`, and `Product.shippingFromPincode` on the wire is the indicative origin (largest active holding), with allocation deciding the real one at checkout.

Since PR-63 the product wire shape carries **`media`** — an ordered list of `{ id, kind, ref, description, isThumbnail, slot }` — in place of `images: string[]`, declared once in `server/catalog/media.ts` and re-exported through `src/domain/product.ts`. `ProductFormInput.media` is the write side of the same shape, minus the id. **`thumbnail` is read-only on the wire**: it is a cache of the flagged media row, so it is returned but never accepted, and `productFormSchema` has no field for it — like `slug`, submitting one is submitting a value the server overwrites. `MediaKind` is a Prisma enum with a single TypeScript declaration; the `ProductFlag` duplication this file records is precisely what that avoids.

Since PR-161 each media item also carries **`slot`** — the key of the named shot it fills, or `null` for an extra — and a category carries **`shotList`**, an ordered list of `{ key, label, hint?, role }` or `null` where it inherits ([media-library](specs/media-library/) D4). Both are additive. `slot` is a bare key, meaningful only against the list `resolveShotList` in `server/catalog/shot-list.ts` returns for the product's category: a key that list does not declare is refused at the boundary, a video item never carries one, and a key appears at most once per gallery. The default list lives in code, so a `null` `shotList` is not "no slots" but "the generic ones".

Since PR-181 `ProductMediaDto.kind` may be `VIDEO` — a video we host, whose `ref` is the source file's URL in our bucket — and every item carries four more fields: `poster` (the derived poster frame's URL, or `null`), `durationMs`, `renditions` (`{ key, url, width, height }`, largest first, empty until the worker is done) and `state` (`"processing"`, `"ready"` or `"failed"`; `null` for a photograph or a YouTube link). Built by `toProductMediaDto` in `server/catalog/media.ts` from the asset behind the row ([video-hosting](specs/media-library/video-hosting/) D1, D5). Additive; a client that knows only `IMAGE` and `YOUTUBE` treats an unknown kind as a video it cannot yet play.

Since PR-183 `ProductMediaDto.poster` is the photograph the org member chose for the video when there is one, else the worker's frame — resolved by `resolveVideoDerivatives` in `server/catalog/media.ts`, the one function both product reads and the library use ([video-hosting](specs/media-library/video-hosting/) D5, D8). The route `PUT /api/org/:orgId/media/:assetId/poster` takes `{ posterAssetId: string | null }` (`videoPosterSchema`) and answers with the video's `MediaAssetDto`; the photograph must be this org's and ready or the answer is 404, and null returns to the worker's frame.

Since PR-163 the org portal's library speaks **`MediaAssetDto`** (`server/catalog/media-library.types.ts` — `id`, `kind`, `ref`, `width`, `height`, `bytes`, `mimeType`, `source`, `state`, `uses`, `createdAt`, `retiredAt`) and **`MediaUseDto`** (`{ kind, id, label, slot }`, one per place an asset is used). `uses` is derived at read time from the referencing relations, never stored ([media-library](specs/media-library/) D7). Since PR-181 `MediaAssetDto` also carries `poster` (a hosted video's poster URL), `durationMs` and `failureReason`; `kind` may be `VIDEO` and `state` may be `PROCESSING` or `FAILED`, and the library lists those two states beside `READY`. Since PR-183 it also carries `renditions` (`{ key, url, width, height }`, largest first, empty for anything but a ready hosted video) so the library sheet can play, its `poster` resolves the chosen photograph over the frame, and `MediaUseKind` gains `video-poster`: a photograph chosen as a video's poster is listed among its uses and cannot be retired while it stands in. Since PR-196 it also carries `posterChosen`, which says whether that poster is a photograph somebody picked rather than the worker's own frame — the difference between having a choice to undo and not. Since PR-189 `uses` counts only where an asset is *shown*, and a new `derivedCount` carries how many pictures were made from it: lineage is not a use, so it never blocks retirement, though the source's file is kept while a child exists. `MediaUseKind` loses `derived`. The route `POST /api/org/:orgId/media/:assetId/crop` takes a `cropTransformSchema` body and answers with the new derived image's `MediaAssetDto`. Private to the portal: a buyer-facing payload carries `ProductMediaDto`, never an asset's owner, byte size or state. The library's filters are `mediaLibraryFilterSchema` in `src/lib/validation/schemas/media-library.schema.ts`, the same parse for the page's query string and the picker's fetch.

The order line's `thumbnail` did not change shape in PR-63 but changed *source*: it is now the snapshot persisted on `OrderItem` at creation rather than a live read through the product join, so a cover change no longer alters a completed order. A same-shape change of source is the kind that passes review unnoticed, which is why it is written here.

Since PR-97 the product wire shape carries **`biddingSlug?: string`** — the public link of the bidding event holding the item out of normal sale, absent when it can be bought as usual. It is **read-only on the wire and never accepted**: `productFormSchema` has no field for it, like `thumbnail` and `slug`. It is told to the client rather than inferred because nothing on the product itself changes when an event opens ([bidding](specs/bidding/) R32), and the storefront has to disable its buy actions and point at the event without a second round trip. Purely a display state — the refusal lives in the cart service and the order transaction, so a client ignoring the field gains nothing (R31). Declared once in `src/domain/product.ts`, populated in `src/data-access-layer/products.dal.ts` from one request-memoised lookup.

Since PR-113 the **org-facing** product shape carries **`archivedAt: Date | null`** — set when the org has archived the product ([ADR-0029](adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md)). The **buyer-facing shape does not carry it**, and deliberately never will: a buyer is never handed an archived product at all, so a field saying "this one is not for sale" would have no true value to hold. It is **read-only on the wire and never accepted**, like `thumbnail`, `slug` and `biddingSlug` — the server sets the clock, and `productFormSchema` has no field for it. Declared once in `server/catalog/admin.product.types.ts`, re-exported through `src/components/product/console/types.ts`; `ProductShelf` (`available` | `archived` | `all`) is the matching read filter, declared once in `server/catalog/product.visibility.ts`.

One handler is new: `PATCH /api/org/[orgId]/products/[id]/archive` takes **`{ archived: boolean }`** and answers `{ id, archivedAt }` — a parsed body rather than two verbs, so the intent is explicit and idempotent, and `archivedAt` itself is never an input. `DELETE /api/org/[orgId]/products/[id]` keeps answering `{ success: true }`: it briefly answered `{ outcome }` while one control did both jobs, and PR-115 gave archiving its own button and put that back (see the CHANGELOG for why a discriminated response was the wrong shape for two different acts). `ProductStats` gains **`archivedProducts`**, and its `totalProducts` now counts only what is available; every other figure on that row excludes archived stock, which is why the label reads "Available".

Since product-form unit 4 an edit is a **compare-and-set on `Product.version`** ([product-form](specs/own-store/product-form/trd.md) D6–D8). `PATCH /api/org/[orgId]/products/[id]` parses **`productEditSchema`** — `productFormSchema` plus a required **`seenVersion`** (int ≥ 0), the version the form was opened at. It is the client's claim of what it read, compared and never written; a create takes no version. A save from an older version is a **409 `ConflictError`** with one detail on path `seenVersion` and a message naming who saved and when ("Bhendi Bazaar team changed this product 2 min ago…" — the team, never an admin's name; a member by name; "You" for the same person in another tab). A sale on a row the editor saw stays the existing 409 on path `stock`. The org-facing `ProductDetails` gains **`version: number`**, **`lastEditedAt: Date | null`**, **`lastEditedBy: string | null`** (the name only, never an id) and **`teamEditedAt: Date | null`** — all read-only on the wire, none accepted. Wordings in `server/catalog/product-edit.ts`.

Since product-form unit 5 the **Bhendi Bazaar team saves a shop's product** through admin twins of those routes ([product-form](specs/own-store/product-form/trd.md) D11, D12): `POST /api/admin/orgs/[id]/products` parses **`teamProductFormSchema`** and `PATCH /api/admin/products/[id]` **`teamProductEditSchema`** (the shop's edit without `orgId`) — the shop's schemas plus a required **`reason`** (string, trimmed, 3–200; "Say why — the shop will read it."). The org is the path's or the product's; a body `orgId` is never used. An archived product is a **409** "This product is archived. Restore it to edit."; `POST /api/admin/products/[id]/restore` answers `{ id, archivedAt }`. Each team save writes one `AdminLog` row (`resource: "Product"`, action `PRODUCT_TEAM_CREATED` | `PRODUCT_TEAM_UPDATED`, declared in `server/catalog/product-team.ts`) with metadata `{ orgId, reason, changes: Array<{ field, at?, before, after }> }`, money first and in paise; a stock change's `at` is `"{location name} ({orgAddressId})"`. The org-facing `ProductDetails` gains read-only **`archivedAt?: Date | null`**.

Since product-form unit 6 the **shop reads the team's saves** ([product-form](specs/own-store/product-form/trd.md) D13): **`ProductTeamEditDto`** (`server/catalog/product-team.ts`) is `{ id, at: Date, created: boolean, reason, changes: Array<{ field, at?, before, after }> }` — the stored `changes` as written, money first and in paise, newest entry first, and **no admin identity** (the entry is read without its `adminId`; the shop is told "Bhendi Bazaar team"). It is a server read on `/org/[orgId]/products/[id]`, not a route; an entry that does not parse or names another org is left out. The org-facing `ProductForTable` gains read-only **`teamEditedAt: Date | null`**, and Home's `HomeAttentionDto` gains **`teamEdits: HomeRead<{ count, productId }>`** — available products with `teamEditedAt` set, `productId` only when there is one.

The three shipping-origin fields — `shippingFromPincode`, `shippingFromCity`, `shippingFromLocation` — are an all-or-none group: either all three are present or all three are absent. Enforced in `productFormSchema`, so both the form and the route apply it. Absent is spelled `NULL`, never `''`; readers treat absence as "fall back to the org's default address". That fallback is evaluated on four separate read paths, and one of them mixes a product's pincode with its org's city; [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) replaces all three fields with a foreign key and removes the fallback.

---

## Bulk catalogue upload

Two-step by design: validate writes nothing, create writes everything or nothing
([bulk-catalog-upload](specs/bulk-catalog-upload/spec.md)). Both steps re-run the
same checks — the second request is as untrusted as the first.

| Endpoint | Shape |
|---|---|
| `POST /api/org/:orgId/products/bulk/validate` | multipart `sheet` (.xlsx/.csv) + `filenames` (JSON array of dropped image names) → `{ ok, errors: RowError[], rows: { rowNumber, tab?, row }[], orgCode, summary, plan: { creates, updates }, sheet: SheetAge }`. Since own-store/bulk-sheet U3, `plan` counts the rows that create and the rows that update a product by SKU, and `sheet` (`server/catalog/bulk/sheet-copy.ts`) is `{ madeOn, version, stale, refusedColumn }`: a sheet whose columns no longer read answers `ok: false`, `refusedColumn` and one row-0 error, its rows unread (D4, D8) |
| `POST /api/org/:orgId/products/bulk/marker` | the same multipart as validate → `.xlsx`, `Content-Disposition` `<upload name>-problems-marked.xlsx` (own-store/bulk-sheet U4, D7): the shop's own file, checked again in full, each problem cell filled `FFFFC7CE` with a note and its row's `Problems` cell holding the row's messages joined by ` · `; last round's marks cleared, nothing else written. A `.csv` comes back as an `.xlsx` of its cells with `Problems` inserted as column A (Q30). Since U4 a blank price reads `Price missing`, and a row the shape refuses is still checked against the catalogue, so validate names all its problems at once (A4) |
| `POST /api/org/:orgId/products/bulk` | `{ rows: (BulkProductRow & { imageUrls: Record<filename, blobUrl>, rowNumber?, tab? })[] }` (`rowNumber`/`tab`: where validate found the row, for messages only; since bulk-sheet U2 `categorySlug` is the cell as typed, a path or a slug, and an optional `brandName` names one of the shop's brands) → `{ ok, created, updated }`, or 400 `{ ok: false, errors }`. Since own-store/bulk-sheet U5 every created or updated product names the member as its editor, clears `teamEditedAt`, and an update moves `version` (D10) |
| `GET /api/org/:orgId/products/bulk/sample` | `?categories=<id>,<id>` (the ticked category ids; was `?types=` before own-store/bulk-sheet U1) → `.xlsx`: an Instructions tab, then one tab per type those categories resolve to ("Other" for untyped ones; nothing ticked makes one Other tab over every category). Each tab: column A `Problems`, row 1 headings, row 2 hidden keys the upload reads, row 3 help, row 4 an example skipped while its name reads `EXAMPLE — this row is skipped` ([own-store/bulk-sheet](specs/own-store/bulk-sheet/trd.md) D1, D2). Since U2 every list column (category as a path, kind, family, brand, each answer, yes/no) is a dropdown of words from a `veryHidden` `Lists` tab, and Instructions carries the same lists as a visible guide (D3). Since U3 the `Lists` tab ends with a `__stamp` column — made-on ISO date, a SHA-256 fingerprint of every tab's column keys and every list's words, the ticked category ids — and Instructions reads "Made {date} · version {first six}" (D4, Q27) |
| `POST /api/org/:orgId/upload/token` | `{ pathname, contentType, size, contentHash?, derivedFrom? }` → `{ uploadUrl, publicUrl, assetId }`, or since PR-166 `{ duplicate: { assetId, ref, width, height } }` when this org already holds these bytes ([media-library](specs/media-library/) D11), in which case the browser uploads nothing and uses `ref`. Since PR-181 `contentType` may also be `video/mp4`, `video/quicktime` or `video/webm`, bounded by `VIDEO_LIMITS.maxUploadBytes` (200 MB) rather than the image ceiling, and the confirm response carries `state` — `READY` for a photograph, `PROCESSING` for a video until the worker has made it playable. Since PR-178 `derivedFrom: { assetId, transform }` registers the upload as a derived asset of one the caller owns — refused as not found when the source is another org's or not ready ([media-library](specs/media-library/) D6a) — and the crop's URL is what a gallery row carries while the original stays the source. A presigned S3 PUT, scoped to `products/<org-code>/` ([ADR-0028](adr/0028-images-live-in-cloudflare-r2.md)). The browser then PUTs the bytes to `uploadUrl` with exactly the `contentType` that was signed, and uses `publicUrl` thereafter. `size` is validated, **not signed** — `Content-Length` cannot be bound into a presigned PUT |
| `GET /api/admin/orgs/:id/products/bulk/sample` · `POST …/validate` · `POST …/marker` · `POST /api/admin/orgs/:id/products/bulk` | the team's twins of the four shop routes for the path's shop (own-store/bulk-sheet U5, D11), platform admin only, 404 for an unknown shop. Create takes the shop's body plus `reason` (required, 3–200 characters) and optional `fileName` → `{ ok, created, updated }` or 400 `{ ok: false, errors }`; 409 for a deactivated or blocked shop. One `PRODUCT_TEAM_BULK_UPLOADED` audit entry per create |
| `POST /api/admin/categories/bulk/validate` · `/bulk` · `/bulk/sample` | the same three shapes for categories |
| `POST /api/admin/upload/token` | The same presigned-PUT exchange, scoped to `categories/` |

`RowError` is `{ row, field, message, tab?, column? }` — `row` is the Excel row number the user
sees, `0` for sheet-level problems; since own-store/bulk-sheet U3 `tab` names the tab the row is on and
`column` the heading as the shop's file shows it (product validate only). Row shapes: `server/catalog/bulk/bulk.types.ts`,
validated by `src/lib/validation/schemas/bulk-product.schema.ts` and
`bulk-category.schema.ts`.

### Reviews

Since PR-124 a product's **`rating` and `reviewsCount` keep their place on the wire and change source**: the two columns behind them are dropped, and both numbers are computed from the published reviews on every read (`server/catalog/review-rating.ts`, [product-reviews](specs/product-reviews/) R6a). Same shape, different origin — the kind of change that passes review unnoticed, which is why it is written here, as the order line's `thumbnail` was in PR-63. They remain **read-only on the wire and never accepted**, as rule 7 already said. The admin product shape drops `rating` outright: nothing rendered it, and an aggregate nobody displays is a query nobody asked for.

Three new shapes, declared once in `server/catalog/review.types.ts`:

- **`ReviewDto`** — `{ id, rating, title, comment, authorName, isVerifiedPurchase, createdAt, isMine, media }`. **No `userId`**: a buyer-facing payload has no reason to carry who wrote a review beyond the display name the row froze (R11), and `isMine` is resolved server-side from the session so a client knows what it may edit without being handed anyone's id (R9). `createdAt` is an ISO string, per rule 3.
- **`ReviewSummaryDto`** — `{ average, count, histogram }`. The average is **per shopper** (one voice however many reviews they wrote, R10) while `count` and `histogram` are **per review**, so the bars sum to the count and to the length of the list below them. Two different weightings in one object, deliberately.
- **`ReviewMediaDto`** — `{ kind, ref }`, reusing `MediaKind`. `ref` is an object URL in our own bucket for `IMAGE` and a bare video id for `YOUTUBE`, the same two meanings `ProductMediaDto.ref` carries ([ADR-0017](adr/0017-video-is-embedded-not-hosted.md) decision 2).

Inbound, one schema serves create and edit symmetrically (`src/lib/validation/schemas/review.schema.ts`): `{ rating, title?, comment?, photos?, video? }` and nothing else. `rating` is required; `photos` are URLs the browser already uploaded and the **service** — not the schema — refuses any that is not ours, because that test needs `R2_PUBLIC_BASE_URL` and this schema is also the form's client-side validation; `video` accepts any YouTube link shape and is stored as the bare id. `isVerified`, `isApproved`, `userName` and `createdAt` have no field on either path (rule 7). Moderation's own schema now carries **`{ isApproved }`** alone — `isVerified` was accepted there and is gone, since the store awards the badge from order history (R4).

Handlers: `GET`/`POST /api/products/[id]/reviews`, `PATCH`/`DELETE /api/reviews/[id]`, and `POST /api/reviews/upload-token` answering `{ uploadUrl, publicUrl }` like the org and admin token routes. The first page of reviews is **not** fetched — it is a server read through `src/data-access-layer/reviews.dal.ts`.

Since PR-125 the review shapes change again, and the inbound one loses a field. **`reviewSubmissionSchema` no longer accepts `video`** — a review carries photographs only, which is a moderation decision rather than a storage one ([review-media](specs/product-reviews/review-media/spec.md) R5a); `ReviewMediaDto.kind` keeps `YOUTUBE` so re-adding it is a field, not a migration. `photos` are still URLs the browser uploaded, but the service now requires each to sit under `reviews/<the author's own id>/` rather than merely inside our bucket: bucket membership is not ownership, and accepting any object in it let a reviewer cite — and, by editing it back out, **delete** — a product's own photograph.

**`AdminReview` replaces `isApproved: boolean` with two nullable timestamps**, `withdrawnAt` (the platform took it down) and `deletedAt` (the author retracted it), and its `userId` is no longer nullable ([ADR-0032](adr/0032-records-people-authored-are-retired-not-deleted.md)). Moderation's inbound schema takes **`{ withdrawn: boolean }`** where it took `{ isApproved }`, and the queue's query string is parsed by `reviewQuerySchema` with **`state: "published" | "withdrawn" | "deleted"`** replacing `isApproved` — `sortBy`/`sortOrder` were `as any` off `searchParams` and reached Prisma's `orderBy` as keys. `GET /api/admin/reviews/[id]` is new and answers one `AdminReview`; **`DELETE /api/admin/reviews/[id]` is gone**, because a review is withdrawn and kept, never destroyed. `ReviewDto` is unchanged — a buyer never sees either timestamp, since a review they cannot see is a review they are not sent.

Since PR-144 **the moderation queue does not cross the boundary at all.** The page is a server
component reading through `src/data-access-layer/admin/reviews.dal.ts`, so `GET /api/admin/reviews`
and `GET /api/admin/reviews/[id]` are gone with the client methods that called them — the detail
panel renders from the row the list already carries. `PATCH /api/admin/reviews/[id]` is the one
handler left, and `{ withdrawn: boolean }` is unchanged. The same applies to the users, orders,
categories and abandoned-carts consoles: their listings are server reads, and the only shapes
still crossing for those screens are the writes.

**One cross-domain call**, not a wire DTO but recorded here for the same reason: `orderService.hasPurchased(userId, productIds)` is how `catalog` asks `checkout` whether to award **Verified purchase**. Catalog never joins `OrderItem` itself.

## Adding a DTO to this file
Record a shape when it crosses the boundary and either more than one route uses it, or getting it wrong would fail silently. A one-off response shape used by a single route does not need an entry — its Zod schema is its documentation.
