# CONTRACTS.md — client ↔ server DTO contracts

- **Verified:** 2026-09-27
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

**`salePrice` is no longer a column.** It survives as a field name on the product and cart wire shapes, where it now means *the offer-adjusted price*, resolved server-side through the one function checkout prices with (ADR-0018). The name is retained because every consumer already reads it as "the reduced price"; renaming it is a follow-up, and until then the comment on each producer says what it is. Nothing accepts it inbound except `ProductFormInput`, where it is the seller's markdown and is stored as an offer rather than on the product.

### Payments
- `POST /api/payments/create-order` takes `{ localOrderId, customer? }` and **derives the amount from the persisted order's `grandTotal`** (PR-38) — which was itself computed from the catalogue inside the creation transaction. An `amount` in the body is not read; the field no longer exists in the schema.
- `POST /api/payments/verify` **is the browser-return confirmation trigger** (PR-39): it takes `{ localOrderId, razorpay_* }`, verifies the signature against the persisted order, performs the paid transition, and returns `{ orderId, paymentStatus }`. `POST /api/payments/confirm-free` does the same for zero-total orders. `PATCH /api/orders/[id]` is **deleted** — nothing updates an order from the browser any more.
- Gateway webhook payloads are Razorpay's contract, not ours. See [INTEGRATIONS.md](INTEGRATIONS.md) for the `notes` round-trip.

`POST /api/payments/abandon` (PR-104) takes `{ localOrderId }` — an order reference and deliberately nothing else. It reports that the buyer left the payment window; it does **not** assert what happened to the money, which the server establishes by asking the gateway. Returns `{ orderId, outcome }`, where `outcome` is one of `released`, `confirmed`, `in-flight`, `already-paid`, `already-released`, `not-released`. Safe to call more than once, and safe never to call — the reconciliation sweep reaches the same answer later.

### Admin
`GET /api/admin/shipping/providers` returns `ShippingProvider` rows without a `select`, so credential and auth-error fields reach the browser. Rule 5 requires an explicit projection exposing only connection state.

### Banners
`BannerFormSchemaInput` (`src/lib/validation/schemas/banner.schema.ts`) is one declaration used by three things — `POST /api/admin/banners`, `PATCH /api/admin/banners/[id]`, and the admin form's resolver — so what an admin sees inline is what the route enforces (ADR-0013).

**`order` is absent from it deliberately, and that absence is the contract.** Display order is server-owned: a create appends to the end, and `PATCH /api/admin/banners/reorder` is the only thing that writes it. Accepting it here even optionally is Rule 7's case exactly — the field a form forgot to send would silently reset the hero's order, and nothing would fail to compile. `tests/unit/home-banners.test.ts` holds the line.

**Every field is optional, `title` included.** A banner may be artwork and nothing else, so the headline widened from required to nullable — an existing client sending one is unaffected, and one sending none now parses. The renderer branches on the absence: with no eyebrow, title, description or action, `HeroBanner` drops the reading scrim rather than fading it, because a phone has no hover to hide it behind. `""` and a whitespace-only title are the same absence as none and normalise to `null`, so the branch has one thing to test. `OrgBannerFormInput` (`src/lib/validation/schemas/org-banner.schema.ts`) widened the same way for an org's own promotions.

Two further shapes worth naming. Action `href` must be **relative** — the hero is the storefront's most prominent surface and an absolute URL sends a shopper off it — and `actions` is capped at two, which is what the banner lays out before a phone wraps a third onto its own line. Null and `""` are the same intent for every optional text column, and the schema normalises to `null` so only one of them reaches the database.

The read side does not cross this boundary: the storefront hero is a server component reading `bannersDAL.getActiveBanners()`, so there is no storefront route handler and no wire shape to keep in step.

### Seller profile

The storefront's public organisation shape is `Storefront` in `src/data-access-layer/storefront.dal.ts` — identity (`id`, `handle`, `name`) plus the public face (`about`, `tagline`, `logoUrl`, `heroUrl`, `accent`, `deliveryPolicy`, `returnsPolicy`). Since [seller-profile](specs/seller-profile/) PR 1 it is built from `OrgProfile` through `PUBLIC_PROFILE_SELECT` and `PUBLIC_ORG_IDENTITY_SELECT` in `server/catalog/org-profile.repository.ts`, and `tests/unit/storefront-public-dto.test.ts` holds both selects to an allowlist: a column added to `Org` cannot reach a buyer. The shape itself did not change in that PR, so the entry carries no `[CONTRACT]`.

Since PR-182 the about page speaks **`BrandPageDto`** (`server/catalog/storefront.types.ts`): identity (`id`, `handle`, `name`) plus the public face — `tagline`, `heroUrl` (the cover), `logoUrl` (the mark), `accent`, `location`, `since` (the year from `Org.joinedAt`), `about` (the introduction), `story`, `deliveryPolicy`, `returnsPolicy`, `brands` (names only, null unless two or more), `social` (links the platform composed from allowlisted handles — `network`, `label`, `handle`, `href`; `server/catalog/social-networks.ts`) and `proof` (null until brand-page part c). Blank text is null, never `""`. It is assembled by `storefrontService.brandPage` and widened once, in `src/data-access-layer/storefront.dal.ts`, to **`BrandPage`** with the marketplace's own `categories` and `newest` — the same priced, bidding-aware tiles the landing page renders, so nothing is priced twice. `PUBLIC_ORG_IDENTITY_SELECT` gained `joinedAt`. `tests/unit/storefront-public-dto.test.ts` holds the DTO's keys to a literal allowlist and checks the serialised payload for any brand's private value. Read-only: no route handler, no wire shape — the page is a server component.

The editor's shape is `StorefrontSettingsInput` in `src/lib/validation/schemas/storefront.schema.ts`, parsed by the settings route and rendered by `useServerForm`; it too now reads and writes the profile. Since PR-162 the portal's listing-context screen speaks two private-face shapes, neither of which reaches a storefront payload: **`BrandDto`** (`server/catalog/brand.types.ts` — `id`, `name`, `manufacturer`, `packerOrImporter`, `countryOfOrigin`, `isDefault`, `retiredAt` as ISO or null) and **`OrgListingDefaultsDto`** (`server/catalog/org-listing-defaults.types.ts` — `countryOfOrigin`, `taxRatePercent`, `taxCodes` as a list of `{ categoryId, taxCode }`). The write shapes are `brandSchema` / `updateBrandSchema` and `listingDefaultsSchema` in `src/lib/validation/schemas/`, two envelopes for the brand as for locations. **The wire talks percent and a list; the column holds basis points and a JSON map keyed by category id**, converted in one place, so a reader never divides. Only a brand's name is required anywhere here ([seller-profile](specs/seller-profile/) R5). **`countryOfOrigin` is an ISO 3166-1 alpha-2 code** on both shapes, since PR-164 — `COUNTRY_CODES` in `server/shared/countries.ts` is the closed set the schemas accept, and `countryName` is how a code is shown.

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

Since PR-163 the org portal's library speaks **`MediaAssetDto`** (`server/catalog/media-library.types.ts` — `id`, `kind`, `ref`, `width`, `height`, `bytes`, `mimeType`, `source`, `state`, `uses`, `createdAt`, `retiredAt`) and **`MediaUseDto`** (`{ kind, id, label, slot }`, one per place an asset is used). `uses` is derived at read time from the referencing relations, never stored ([media-library](specs/media-library/) D7). Since PR-181 `MediaAssetDto` also carries `poster` (a hosted video's poster URL), `durationMs` and `failureReason`; `kind` may be `VIDEO` and `state` may be `PROCESSING` or `FAILED`, and the library lists those two states beside `READY`. Since PR-183 it also carries `renditions` (`{ key, url, width, height }`, largest first, empty for anything but a ready hosted video) so the library sheet can play, its `poster` resolves the chosen photograph over the frame, and `MediaUseKind` gains `video-poster`: a photograph chosen as a video's poster is listed among its uses and cannot be retired while it stands in. Private to the portal: a buyer-facing payload carries `ProductMediaDto`, never an asset's owner, byte size or state. The library's filters are `mediaLibraryFilterSchema` in `src/lib/validation/schemas/media-library.schema.ts`, the same parse for the page's query string and the picker's fetch.

The order line's `thumbnail` did not change shape in PR-63 but changed *source*: it is now the snapshot persisted on `OrderItem` at creation rather than a live read through the product join, so a cover change no longer alters a completed order. A same-shape change of source is the kind that passes review unnoticed, which is why it is written here.

Since PR-97 the product wire shape carries **`biddingSlug?: string`** — the public link of the bidding event holding the item out of normal sale, absent when it can be bought as usual. It is **read-only on the wire and never accepted**: `productFormSchema` has no field for it, like `thumbnail` and `slug`. It is told to the client rather than inferred because nothing on the product itself changes when an event opens ([bidding](specs/bidding/) R32), and the storefront has to disable its buy actions and point at the event without a second round trip. Purely a display state — the refusal lives in the cart service and the order transaction, so a client ignoring the field gains nothing (R31). Declared once in `src/domain/product.ts`, populated in `src/data-access-layer/products.dal.ts` from one request-memoised lookup.

Since PR-113 the **org-facing** product shape carries **`archivedAt: Date | null`** — set when the org has archived the product ([ADR-0029](adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md)). The **buyer-facing shape does not carry it**, and deliberately never will: a buyer is never handed an archived product at all, so a field saying "this one is not for sale" would have no true value to hold. It is **read-only on the wire and never accepted**, like `thumbnail`, `slug` and `biddingSlug` — the server sets the clock, and `productFormSchema` has no field for it. Declared once in `server/catalog/admin.product.types.ts`, re-exported through `src/components/product/console/types.ts`; `ProductShelf` (`available` | `archived` | `all`) is the matching read filter, declared once in `server/catalog/product.visibility.ts`.

One handler is new: `PATCH /api/org/[orgId]/products/[id]/archive` takes **`{ archived: boolean }`** and answers `{ id, archivedAt }` — a parsed body rather than two verbs, so the intent is explicit and idempotent, and `archivedAt` itself is never an input. `DELETE /api/org/[orgId]/products/[id]` keeps answering `{ success: true }`: it briefly answered `{ outcome }` while one control did both jobs, and PR-115 gave archiving its own button and put that back (see the CHANGELOG for why a discriminated response was the wrong shape for two different acts). `ProductStats` gains **`archivedProducts`**, and its `totalProducts` now counts only what is available; every other figure on that row excludes archived stock, which is why the label reads "Available".

The three shipping-origin fields — `shippingFromPincode`, `shippingFromCity`, `shippingFromLocation` — are an all-or-none group: either all three are present or all three are absent. Enforced in `productFormSchema`, so both the form and the route apply it. Absent is spelled `NULL`, never `''`; readers treat absence as "fall back to the org's default address". That fallback is evaluated on four separate read paths, and one of them mixes a product's pincode with its org's city; [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) replaces all three fields with a foreign key and removes the fallback.

---

## Bulk catalogue upload

Two-step by design: validate writes nothing, create writes everything or nothing
([bulk-catalog-upload](specs/bulk-catalog-upload/spec.md)). Both steps re-run the
same checks — the second request is as untrusted as the first.

| Endpoint | Shape |
|---|---|
| `POST /api/org/:orgId/products/bulk/validate` | multipart `sheet` (.xlsx/.csv) + `filenames` (JSON array of dropped image names) → `{ ok, errors: RowError[], rows, orgCode, summary }` |
| `POST /api/org/:orgId/products/bulk` | `{ rows: (BulkProductRow & { imageUrls: Record<filename, blobUrl> })[] }` → `{ ok, created }`, or 400 `{ ok: false, errors }` |
| `GET /api/org/:orgId/products/bulk/sample` | `.xlsx`, generated from the org's live locations and current category slugs |
| `POST /api/org/:orgId/upload/token` | `{ pathname, contentType, size, contentHash?, derivedFrom? }` → `{ uploadUrl, publicUrl, assetId }`, or since PR-166 `{ duplicate: { assetId, ref, width, height } }` when this org already holds these bytes ([media-library](specs/media-library/) D11), in which case the browser uploads nothing and uses `ref`. Since PR-181 `contentType` may also be `video/mp4`, `video/quicktime` or `video/webm`, bounded by `VIDEO_LIMITS.maxUploadBytes` (200 MB) rather than the image ceiling, and the confirm response carries `state` — `READY` for a photograph, `PROCESSING` for a video until the worker has made it playable. Since PR-178 `derivedFrom: { assetId, transform }` registers the upload as a derived asset of one the caller owns — refused as not found when the source is another org's or not ready ([media-library](specs/media-library/) D6a) — and the crop's URL is what a gallery row carries while the original stays the source. A presigned S3 PUT, scoped to `products/<org-code>/` ([ADR-0028](adr/0028-images-live-in-cloudflare-r2.md)). The browser then PUTs the bytes to `uploadUrl` with exactly the `contentType` that was signed, and uses `publicUrl` thereafter. `size` is validated, **not signed** — `Content-Length` cannot be bound into a presigned PUT |
| `POST /api/admin/categories/bulk/validate` · `/bulk` · `/bulk/sample` | the same three shapes for categories |
| `POST /api/admin/upload/token` | The same presigned-PUT exchange, scoped to `categories/` |

`RowError` is `{ row, field, message }` — `row` is the Excel row number the user
sees, `0` for sheet-level problems. Row shapes: `server/catalog/bulk/bulk.types.ts`,
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
