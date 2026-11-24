# Contracts — storefront

- **Verified:** 2026-11-24
- **Covers:** `server/catalog/org*.types.ts`, `server/catalog/storefront*.ts`

The storefront shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Banners
`BannerFormSchemaInput` (`src/lib/validation/schemas/banner.schema.ts`) is one declaration used by three things — `POST /api/admin/banners`, `PATCH /api/admin/banners/[id]`, and the admin form's resolver — so what an admin sees inline is what the route enforces (ADR-0013).

**`order` is absent from it deliberately, and that absence is the contract.** Display order is server-owned: a create appends to the end, and `PATCH /api/admin/banners/reorder` is the only thing that writes it. Accepting it here even optionally is Rule 7's case exactly — the field a form forgot to send would silently reset the hero's order, and nothing would fail to compile. `tests/unit/home-banners.test.ts` holds the line.

**Every field is optional, `title` included.** A banner may be artwork and nothing else, so the headline widened from required to nullable — an existing client sending one is unaffected, and one sending none now parses. The renderer branches on the absence: with no eyebrow, title, description or action, `HeroBanner` drops the reading scrim rather than fading it, because a phone has no hover to hide it behind. `""` and a whitespace-only title are the same absence as none and normalise to `null`, so the branch has one thing to test. `OrgBannerFormInput` (`src/lib/validation/schemas/org-banner.schema.ts`) widened the same way for an org's own promotions.

Two further shapes worth naming. Action `href` must be **relative** — the hero is the storefront's most prominent surface and an absolute URL sends a shopper off it — and `actions` is capped at two, which is what the banner lays out before a phone wraps a third onto its own line. Null and `""` are the same intent for every optional text column, and the schema normalises to `null` so only one of them reaches the database.

The read side does not cross this boundary: the storefront hero is a server component reading `bannersDAL.getActiveBanners()`, so there is no storefront route handler and no wire shape to keep in step.

Since image-slots (design-system Q24, 2026-11-04) a banner carries **a picture per form factor**. In `BannerFormSchemaInput` and `OrgBannerFormInput`, `imageUrl` is replaced by **`image: ImageSlotInput | null`** (`imageSlotInputSchema`, `src/lib/validation/schemas/image-slot.schema.ts`): `{ desktop: Side | null, phone: Side | null, phoneFocus: { x, y } }`, a `Side` being `{ url, fit: "crop" | "contain", crop: { x, y, width, height } | null, fill: "#rrggbb" | null }`. The crop travels as **fractions of the picture** (0–1), so it survives the upload's downscale; the server turns it into pixels with the asset's own size, refuses a crop outside the picture or off the slot's shape by more than 2%, and refuses "fit it in" without a fill. The picture must be a ready image in the owner's own library (the platform's for a home banner, the shop's for its banner), and a picture of anyone else is refused. Slot shapes are declared once in `server/catalog/image-slots.ts`. Stored as `imageFraming` (`server/catalog/image-framing.ts`, parsed on read, never cast; a missing or invalid value reads as centred cover) plus real `phoneImageAssetId` / `phoneImageUrl` columns, so the media library still knows a phone picture is in use. `AdminBanner` gains `imageAssetId`, `phoneImageUrl` and `imageFraming`. The server read `HeroBannerContent.image` changes from `{ src, alt }` to **`ResponsiveImageDto`** `{ alt, phone, desktop }`, each `{ src, fit, position, fill }`, both always filled: the phone falls back to the desktop picture around the chosen focus on the server.

## Seller profile

The storefront's public organisation shape is `Storefront` in `src/data-access-layer/storefront.dal.ts` — identity (`id`, `handle`, `name`) plus the public face (`about`, `tagline`, `logoUrl`, `heroUrl`, `accent`, `deliveryPolicy`, `returnsPolicy`). Since [seller-profile](../specs/seller-profile) PR 1 it is built from `OrgProfile` through `PUBLIC_PROFILE_SELECT` and `PUBLIC_ORG_IDENTITY_SELECT` in `server/catalog/org-profile.repository.ts`, and `tests/unit/storefront-public-dto.test.ts` holds both selects to an allowlist: a column added to `Org` cannot reach a buyer. The shape itself did not change in that PR, so the entry carries no `[CONTRACT]`.

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

Since [org-profile](../specs/own-store/org-profile) unit 1, `POST /api/orgs` parses **`openShopSchema`**
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

Since storefront-look units 2–4 `StorefrontPage` gains **`banners: HeroBannerContent[]`** (the shop's active banners, from
`storefrontDAL.promotionsFor`, links already held to the shop's own pages by storefront-branding R2c), which lead Daily's
hero and label Edge's photo. Read-only; no route handler or wire shape changes.

Since storefront-themes unit 5 a shop publishes its look through **`StorefrontLookInput`**
(`storefrontLookSchema` in `src/lib/validation/schemas/storefront.schema.ts`, `PUT /api/org/[orgId]/storefront/look`):
`{ theme, palette, lookVersion }`, strict, the palette one of its theme's three. **`StorefrontRevertInput`**
(`storefrontRevertSchema`, `POST …/storefront/look/revert`) is `{ lookVersion }` alone: what it restores is the
server's record. Both answer **`StorefrontLookState`** (`server/catalog/storefront-look.types.ts`): `orgId`, `handle`,
`name`, `live: { theme, palette }` (both null before any theme), `lookVersion`, `publishedAt` (ISO or null) and
`previous: { theme, palette, until } | null` while it is kept (30 days, Q4). A stale `lookVersion` is 409 with
"{Name} published {theme} {n} min ago." (Q31); a switch back after the 30 days is 410 "Your previous look is no
longer kept."; a member who is not the owner gets 403.

Since storefront-font unit 2 **`StorefrontLookInput`** gains **`font`**, required: a key from `FONT_KEYS` or null for the
template's own face (absent or any other value is refused, so an old client cannot clear a chosen face). **`LookKeys`** — `live` and `previous` in
`StorefrontLookState` — gains **`font`** the same way, so Switch back restores the face with the theme. `Storefront`
(`storefront.dal.ts`) and **`StorefrontPageDto`** gain **`fontKey`** (null unthemed, unchosen, or a key retired from
code); `storefrontService.storefrontPage` takes a `PreviewLook` whose `font` a preview passes. Stored as `OrgProfile.fontKey` and `previousFontKey`.

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
Since image-slots D10 (2026-11-04) a storefront photo has a phone and a desktop version: `StorefrontSettingsInput`
gains optional **`heroImages`** (≤3 `ImageSlotInput`, the banner shape in Banners below) and
**`collections[].image`** (`ImageSlotInput`); each is resolved through `resolveImageSlot`, org-scoped, and the
slot's own photo stays the desktop picture (else the phone one) so `heroPhotos` and `photoUrl` keep working.
`StorefrontSettingsDto` returns `heroImages: ImageSlotValue[]` and `collections[].image`; `StorefrontPageDto`
gains `heroImages: ResponsiveImageDto[]` and `collections[].image?: ResponsiveImageDto | null`. Additive.

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

Since design-system Q37 (2026-11-05) **`GET /api/admin/orders/export`** (platform admins) takes the orders list's
query (`adminOrderViewSchema`: `search`, `status`, `paymentStatus`, `sortBy`, `sortOrder`; unknown values ignored)
and answers `text/csv` as an attachment named `bhendi-bazaar-orders-YYYY-MM-DD.csv`, `no-store`. Columns, in
order: Order, Placed (India time, `YYYY-MM-DD HH:mm`), Status, Payment, Buyer, Email, Phone, City, Pincode, Items
(units), Total (₹, two decimals from paise), Shops (`; `-joined). Over 10,000 rows it answers `422` in the error
envelope. The rows are **`AdminOrderExportRow`** (`server/checkout/admin.order.types.ts`), built only for this export.
The list page's side panel is `?order=<id>` (`orderPeekSchema`, same file: an id's shape or nothing); it is a
page parameter, not a wire shape.

Since order-fulfilment unit 4 the courier webhook is **`POST /api/webhooks/shipping/courier`** (was
`/api/webhooks/shipping/shiprocket`, deleted; Shiprocket refuses a URL naming it). It requires the header **`x-api-key`** equal to
`SHIPROCKET_WEBHOOK_TOKEN`, compared in constant time before the body is read; missing, wrong or unconfigured is
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

## Shop setup list

Since seller-onboarding unit 3 **`OnboardingStatus`** (`server/catalog/org-onboarding.types.ts`) is
`{ steps: { key, done }[], doneCount, next, complete, hidden }`: five steps (`ONBOARDING_STEP`,
Q19's order), `next` the first not done or null. `readiness`, `READINESS_STATE`, `STORE_MISSING`
and the re-exported channel set are gone (Q4); channel readiness lives in `server/listing/`. Read on
the server only (Home), never sent by a route. Two routes, `withOrg`, no body, each answering
`{ ok: true }` and idempotent: `POST`/`DELETE /api/org/[orgId]/setup/hidden` (hide, unhide) and
`POST /api/org/[orgId]/setup/shared` (the first share). Caller: `src/components/org/home/setupApiClient.ts`.
Since dynamic-form unit 3b a product's answers live in `ProductValue` (`server/listing/product-value.repository.ts`, `ProductAnswers` `{ facts, measurements }`), read by every reader in the same shape as before; no wire shape changed. **`ProjectedValues`** and the attribute closed sets, `BRAND_PARTY_ROLE` among them (`server/listing/attribute.types.ts`, listing-model/attributes units 1–2), are server-only: a product's typed values as one read. No route sends them; dynamic-form's form will.
**`FieldMapRow`, `BuiltField`, `BuildGap`** (`server/listing/field-map.types.ts`, listing-model/field-maps unit 1) are server-only: a listing built from the field maps, handed by listing to channels' providers and to the Google/Meta feed. Since field-maps unit 2 the admin changes a map through `PUT /api/admin/field-maps` (`requirePlatformAdminId`, audited `channel.field-map.set`), (and, since 2026-11-20, `DELETE` with **`fieldMapRemoveSchema`** `{ channel, channelType, fieldPath, bbType }`, audited `channel.field-map.remove`, answering `{ removed: true }` or a 404 when already gone `[CONTRACT]`), parsing **`fieldMapSaveSchema`** (`src/lib/validation/schemas/field-map.schema.ts`): `{ channel, channelType, fieldPath, bbType, source, key, constant, unitTarget, reason, values }`, `source` from `FIELD_SOURCES`, `key` checked against the questions, rules, product columns or shop settings that exist, `unitTarget` a unit we can convert to, `values` the whole set of answer pairs. Since dynamic-form unit 1 the new questions are facts, so `key` accepts them as today's questions (`PLANNED_ATTRIBUTES` is empty); the accepted set is unchanged. It answers `{ id }`. Caller: `channelsApiClient.saveFieldMap`. The screens read **`AdminFieldMapsDTO`** and **`AdminChannelTypeDTO`** (`server/listing/admin.field-map.types.ts`) on the server only. Since 2026-11-20 (field-maps Q23) a row carries `parts` and a map `wholeOnParts`; the save refuses a whole-field map on a field in parts, and a part its type does not declare, with a 400 naming the parts, and a part's map replaces the field's whole-field map.
Since listing-model/dynamic-form unit 4 (2026-11-08) a **brand** is saved with its parties: `POST /api/org/[orgId]/brands` parses **`brandSchema`** and `PATCH …/brands/[brandId]` **`updateBrandSchema`** (`src/lib/validation/schemas/brand.schema.ts`): `{ name, countryOfOrigin, isDefault, amazonRegistered, parties: { maker, packer, importer } }`, each party `{ name, address, pincode }` (all optional, a pincode six digits); the update takes `parties` whole or not at all. `manufacturer` and `packerOrImporter` are no longer accepted (they follow the maker and packer). **`BrandDto`** (`server/catalog/brand.types.ts`) gains `amazonRegistered` and `parties`. The shop-wide Generic route and `amazonGenericSchema` are removed: each brand holds the choice.
**`HomeAttentionDto`** (`src/data-access-layer/org/home.dal.ts`) is a server read for Home's lines (since dynamic-form unit 2 also `channelNeeds`: per channel `{ channel, products, details }` from stored completeness),
each `{ ok: true, value } | { ok: false }`; no wire shape. Since design-system Q31 (2026-11-04) it carries
`toPack` (paid parcels still packing, with the oldest wait) and `lowStock` (products at or under their
threshold that sold in the last 30 days, with the days until the first runs out) in place of `parcels`,
`reviews` and `auction`; `HomeAuction` is gone. Since listing-model Q22 (2026-11-07) it carries `channelAsks`: **`CatalogueAttentionDTO`** `{ channel, label, typeLabel, added }` (`server/listing/channel-catalogue.service.ts`), or null, the newest required field a channel added in the last 14 days to a type the shop's products publish to. The admin dashboard's **`SalesOverview`**
(`server/analytics/sales.types.ts`: per-day paise for the period and the one before, totals, paid
orders, average order, platform kept, shops selling, each `{ current, previous, changeBps }`) and
**`AdminAttention`** (`server/analytics/attention.types.ts`: at most five `{ key, count, waiting, oldestAt,
href }`, keys from `ADMIN_ATTENTION`) are server reads through `src/data-access-layer/admin/dashboard.dal.ts`;
no wire shape. Since design-system Q34 (2026-11-04) **`ShopSalesOverview`** (same file: one shop's per-day
paise and the period before, total, paid orders, average order and `payable`, each `Compared`) is read
for the shop's Home through `src/data-access-layer/org/sales.dal.ts`; no wire shape. `HomeData.widgets` is gone.
