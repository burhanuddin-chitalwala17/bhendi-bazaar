# Contracts — channels

- **Verified:** 2026-11-24
- **Covers:** `server/channels/*.types.ts`

The channels shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Channels

Three shapes cross the wire, all of them decisions rather than reads
([channel-registry](../specs/channel-registry)).

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
server and rendered there ([ADR-0034](../adr/0034-render-on-the-server-by-default.md)). The one
exception is the unsaved product form ([product-form](../specs/own-store/product-form) D4):
`POST /api/org/[orgId]/products/readiness` takes `productReadinessSchema`
(`src/lib/validation/schemas/product.schema.ts`) — `categoryId` (blank answers nothing), `kind`,
`familyId`, `brandId`, `facts` as bare answers — fills them as a save would and answers the
existing `ChannelVerdict[]` (`server/listing/channel-readiness.service.ts`). The org is the
membership's, never the body's; nothing is written, and nothing of the answer reaches the save.
The browser only words the verdict; the server still decides it.

## Channel connections

Since channel-connectors ([spec](../specs/marketplace-integration/channel-connectors)) the org portal
reads **`ChannelsOverviewDTO`** (`server/channels/channel-connection.types.ts`) on the server: `cards`
(one **`ChannelCardDTO`** per channel — `channel`, `label`, `state` from `CARD_STATE`, who connected
or disconnected and when, `lastCheckedAt`, `stale`, `reapproveBy`, `reason` from `CONNECTION_ERROR`)
and `attention` for the dashboard banner. Since inventory-sync Q27 a card also carries `stockSync`
(`STOCK_SYNC`, null unless connected). **No token, external account id or marketplace text is
in any of them** ([server/channels/CLAUDE.md](../../server/channels/CLAUDE.md)).

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

## Marketplace listings

Since channel-import ([spec](../specs/marketplace-integration/channel-import)) each `ChannelCardDTO`
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

## Settling marketplace listings

Since product-merge ([spec](../specs/marketplace-integration/product-merge)) `ChannelListingDTO` also
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

## Facts from a marketplace

Since marketplace-facts ([spec](../specs/marketplace-integration/marketplace-facts)) a stored fact or
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

## Families from marketplace listings

Since family-merge ([spec](../specs/marketplace-integration/family-merge)) the family page reads
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

## Stock sync and marketplace orders

Since inventory-sync ([spec](../specs/marketplace-integration/inventory-sync)) channels reads, on the
server, from `server/channels/channel-stock.types.ts`: **`StockSyncSectionDTO`** (the marketplace's
`state` from `STOCK_SYNC`, whether locations need matching and which one is new, last sent and checked
times, whether every listing is stocked by the marketplace, today's corrections), **`StockAttentionDTO`**
(Home's line, since Q27: `channel`, `label`, `kind` from `STOCK_ATTENTION` — match or outOfStock — and
`count`), **`LocationMatchDTO`** (each **`ChannelLocationDTO`** with its match, "not used", a
pincode suggestion, gone and closed flags, plus the shop's locations) and **`MarketplaceOrderDTO`**
(order and SKU, quantity, the amount in paise as reported, `state` from `ORDER_LINE_STATE`,
oversold, `locationGuessed`, `beforeSync`, `unlinked`). The section also carries `problem` (`STOCK_PROBLEM`: busy
or refused), `locationsRead`, `sending` (sent of total since sync went on) and `refused` (listings turned down). A product's marketplace link gains
`stock`: last sent, when, `heldByMarketplace`, and an oversold order still waiting to ship, or null
while sync is off.

Since marketplace-publish Q23 a `ChannelListingDTO` carries `problems` (`{ suppressed, first, count }`
or null: the daily look's complaint), `ChannelListingsPageDTO.counts` gains `problems` and the page
`showingProblems`; `ListingScreenDTO` gains `marketplaceProblems` (`{ suppressed }` or null, when its
`issues` came from the daily look); Home reads **`ListingProblemsAttentionDTO`** (`channel`, `label`,
`problems`, `suppressed`). No route changed.

Since marketplace-publish Q24 a `ListingIssue` may carry `attribute` (the marketplace's own name) and
`need` (`ISSUE_NEED`: brand or mrp, when its provider can tell; `barcode` since 2026-11-09, for a missing
barcode or exemption, which the listing's barcode card places and requests never raise); both are absent on
issues stored before. `ListingScreenDTO` gains `fixes` (`ListingFixDTO[]`: `kind` from `LISTING_FIX` (brand, mrp,
facts, admin) and the `names` to fill) and `otherIssues` (complaints neither a field nor a fix places).
No route changed.

Routes, both `withOrg`:
- `PUT /api/org/[orgId]/channels/[channel]/stock-sync` — body `stock-sync.schema.ts`
  (`stockSyncChangeSchema`): `{ action: "on" | "pause" }`, from the Channels card (Q27); "on" turns a
  paused sync back on and enqueues a send for every linked product. Sync starts by itself on connecting. Answers `{ ok: true }`; 409 when not connected.
- `PUT /api/org/[orgId]/channels/[channel]/locations` — `locationMatchSchema`: `matches`, each
  marketplace location to one of the shop's active locations or not used, never both. `{ ok: true }`;
  400 for a location not the shop's or closed.

## Platform listings and publishing

Since channel-listings and marketplace-publish ([specs](../specs/marketplace-integration/channel-listings))
channels reads, on the server, from `server/channels/platform-listing.types.ts`. **`ListingScreenDTO`**:
the listing's id and `version`, `values` (the six `LISTING_FIELD`s computed from the product with the
listing's own over it; price in paise, photos as media ids), `own` per field, the `product`'s values,
`theirs` (title, price, features, description as the marketplace showed them at the last read, with
`readAt`), the marketplace's `rules` (`ListingRules`: writable fields, limits, whole rupees, photo
rule, `canCreate`, `editIn`), the product's `photos` (each with a `warning`), `locked` (MRP, barcode,
brand, stock), `status` (**`ListingStatusDTO`**: `LISTING_STATUS`, waiting and issue counts, when),
`waitingFields`, `issues` (**`ListingIssue`**: code, message, severity, our field or null), `showing`
and `draft` (create mode, target page, marketplace type, facts still needed). **`ProductListingSummaryDTO`**
gives each connected marketplace's status for a product. **`ReviewDTO`** lists **`ReviewListingDTO`**s
(id, version, name, status, `creating`, and **`ReviewChangeDTO`**s: field, `from` or null, `to`, `big`)
and `sending`, how many listings were left out because their last send has no answer yet (2026-11-20);
**`PublishResultDTO`** is `{ sent, refused }`, each refused entry `{ id, reason }` with `reason` one of
`PUBLISH_REFUSAL`: `changed` (edited, removed or claimed since the review), `sending` (the last send is
still out) or `nothing` (nothing the marketplace takes differs) `[CONTRACT]` (2026-11-20). `server/channels/providers/publish.ts` holds `PageMatch`
(ASIN, title, image, matched by barcode or name).

Routes, all `withOrg`; bodies in `platform-listing.schema.ts`:
- `PUT /api/org/[orgId]/products/[id]/listings/[channel]` — `listingSaveSchema`: `{ seenVersion,
  overrides }`, only the six fields (price in rupees), `strict()` so a strict field is a 400. Answers
  `{ version, waiting }`; 409 when another save came first.
- `POST` the same path — `listingDraftSchema`: `{ mode: "offer" | "new", targetExternalId }`. `{ id }`;
  409 when the product is already on that marketplace or it cannot create.
- `GET /api/org/[orgId]/products/[id]/listings/[channel]/pages` — `{ pages: PageMatch[] }`.
- `POST /api/org/[orgId]/channels/[channel]/publish` — `listingPublishSchema`: `items`, each `{ id,
  version, fields }`. Answers `PublishResultDTO`; a listing that moved since the review is refused.
- `POST /api/org/[orgId]/channels/[channel]/families/[familyId]` — the family's page and member drafts.
  `{ id, members }`.

The product form gains `mrp` (rupees), `barcode` (8–14 digits or blank) and `keyFeatures` (up to five).

## Readiness gaps and fixing them

Since readiness-fix ([spec](../specs/channel-registry/readiness-fix)) the products card reads
`ChannelSummaryRow` from `server/listing/channel-readiness.service.ts`: per channel `ready`, `warned`,
`incomplete`, `noCategory` (products whose type has no category there) and `gaps` (each missing
compulsory fact: `fact`, `label`, `count`, `fixable` when a picker answers it), most common first. The
fix page reads **`FixPageDTO`** (`server/listing/readiness-fix.types.ts`): channel and fact with their
labels, the offered `options`, **`FixRowDTO`** rows (product, name, SKU, photo, a marketplace's `said`
word or null), and `wouldGo` of `total`.

- `PUT /api/org/[orgId]/products/facts` (`withOrg`) — `readinessFixSchema`: `{ fact, value, productIds
  (1–100), undo }`, strict. Answers **`FixAnswerResultDTO`** `{ set, skipped }`, or `{ undone }` for an
  undo (one product); 400 for an answer not offered.

## social-selling/meta-foundation (Meta's callbacks, the forget port)

Meta's two account callbacks post one form field, `signed_request` (`metaSignedRequestSchema`,
`src/lib/validation/schemas/meta-callback.schema.ts`), verified under the app secret in
`server/channels/providers/meta/signed-request.ts`; any other signature is 401 with no body.
`POST /api/channels/instagram/deauthorize` answers `{ received: true }`.
`POST /api/channels/meta/data-deletion` answers Meta's shape, `{ url, confirmation_code }`: the code
is twelve characters without 0/O/1/I/L, and the url is our `/data-deletion/<code>` page, which shows
only whether the request is done and by when (`DeletionStatus`: `done`, `doneBy`).
**`Forgetter`** (`server/shared/social-events/forget.ts`) is the one cross-domain port: a domain that
holds what a platform user wrote or is registers `{ name, forget(platform, platformUserId) }` when
the worker starts; `channels.delete-person` runs every one, and channels imports none of them.
