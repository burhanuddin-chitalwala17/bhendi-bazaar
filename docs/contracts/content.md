# Contracts — content

- **Verified:** 2026-11-24
- **Covers:** `server/content/*.types.ts`

The content shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Image enhancement

Since PR-185 the org portal speaks **`EnhancementDto`** (`server/content/enhancement.types.ts`): `id`, `tool`, `preset`, `state`, `sourceAssetId`, `sourceRef`, `proposalUrl` (null unless the state is `PROPOSED`), `resultAssetId`, `resultRef`, `error`, `costPaise` (integer paise, [Invariant 3](../../CLAUDE.md)), `createdAt`, `proposedAt`, `decidedAt` — beside **`EnhancementUsage`** (`used`, `allowance`, `paused`, `pauseReason`), which every answer carries so the sheet can say where the shop stands. Four routes, all `withOrg` and parsed by `src/lib/validation/schemas/enhancement.schema.ts`: `POST /api/org/:orgId/enhancements` (`{ sourceAssetId? | sourceRef?, tool, preset?, slot?, slotRole? }`, exactly one of the first two: the library names a photo by its asset id, the gallery editor knows only the URL of one it has just put up, and a request carrying both or neither is a 400) → `{ enhancement, usage }`; `GET …/:id` → `{ enhancement }`, which the sheet polls while the worker runs; `POST …/:id/accept` → `{ enhancement }` with `resultRef`, the derived image's URL; `POST …/:id/discard` → `{ enhancement }`. A refusal is a `DomainError` with the reason the org member reads ([image-enhancement](../specs/image-enhancement) R7, R10). Since PR-198 `preset` is **not free text**: it is one of the keys in `server/content/scene-presets.ts`, required when `tool` is `SCENE` and refused on every other tool, so a request carrying a description nobody approved is a 400 rather than a row (R11).

Two admin routes since PR-190, both `requirePlatformAdminId` and parsed by the same schema module. `PUT /api/admin/enhancements/settings` takes `{ defaultMonthlyAllowance, dailyCapPaise }` — both positive integers, the cap in **paise** (Invariant 3), since the form shows rupees and converts before it sends — and answers `{ settings }`, an **`EnhancementSettingsDto`** of `defaultMonthlyAllowance`, `dailyCapPaise` and `configured` (false while those are the code's fallbacks and nothing has been saved). `PUT /api/admin/enhancements/orgs/:orgId` takes `{ monthlyAllowance, paused, pauseReason }` — `monthlyAllowance` is `number | null`, and **null is not a missing field**: it says the org defers to the platform, which is what lets its row be deleted rather than kept holding a copy — and answers `{ policy }`, an **`OrgEnhancementPolicyView`** of `monthlyAllowance` (resolved), `monthlyAllowanceOverride` (what the org's own row says, or null), `paused` and `pauseReason`. `EnhancementUsage.allowance` is likewise the **resolved** number — the org's override where it has one, else the platform's setting, else the fallback in `server/content/enhancement.types.ts` — so a refusal names the number that actually applied.

The editor's shape is `StorefrontSettingsInput` in `src/lib/validation/schemas/storefront.schema.ts`, parsed by the settings route and rendered by `useServerForm`; it too now reads and writes the profile. Since PR-162 the portal's listing-context screen speaks two private-face shapes, neither of which reaches a storefront payload: **`BrandDto`** (`server/catalog/brand.types.ts` — `id`, `name`, `manufacturer`, `packerOrImporter`, `countryOfOrigin`, `isDefault`, `retiredAt` as ISO or null) and **`OrgListingDefaultsDto`** (`server/listing/org-listing-defaults.types.ts` — `countryOfOrigin`, `taxRatePercent`, `taxCodes` as a list of `{ categoryId, taxCode }`). The write shapes are `brandSchema` / `updateBrandSchema` and `listingDefaultsSchema` in `src/lib/validation/schemas/`, two envelopes for the brand as for locations. **The wire talks percent and a list; the column holds basis points and a JSON map keyed by category id**, converted in one place, so a reader never divides. Only a brand's name is required anywhere here ([seller-profile](../specs/seller-profile) R5). **`countryOfOrigin` is an ISO 3166-1 alpha-2 code** on both shapes, since PR-164 — `COUNTRY_CODES` in `server/shared/countries.ts` is the closed set the schemas accept, and `countryName` is how a code is shown.

## ai-images (tags, credit, payment proof)

**`PUT /api/org/[orgId]/media/[assetId]/tags`** (`withOrg`) parses **`mediaTagSchema`**
(`src/lib/validation/schemas/media-library.schema.ts`): `{ tag: "PRODUCT" | "REFERENCE", on: boolean }`. It answers
the image's **`MediaAssetDto`**, which carries `tags` (`server/catalog/media-library.types.ts`); a video, a retired
image or another org's is `404` "Image not found". The library's filters accept `tag` with the same values.

**`GET /api/org/[orgId]/credits?page=`** (`withOrg`, free) answers **`CreditAccountDto`**
(`server/payouts/credit.types.ts`): `{ balancePaise, lines, hasMore, paymentDetails }`, each line a `CreditLineDto`
whose `providerCostPaise` and `marginBps` are null on the shop's own view. The admin's
**`GET`/`POST /api/admin/orgs/[id]/credits`** answer **`AdminCreditAccountDto`** (the same plus `marginOverrideBps`,
`platformMarginBps`, `spentThisMonthPaise`); the `POST` parses **`topUpSchema`** (`credit.schema.ts`):
`amountPaise` 1–100,000,000 and a payment proof. **`POST …/credits/[lineId]/reverse`** parses `{ reason }` (3–300
characters); only a starting credit or a top-up reverses, once (`409` otherwise). **`PUT …/credits/margin`** parses
`{ marginBps: 0–10,000 | null }`; **`PUT /api/admin/credits/settings`** `{ marginBps: 0–10,000 }`;
**`PUT /api/admin/payment-details`** parses **`paymentDetailsSchema`** and answers **`PaymentDetailsDto`**. No amount
in any of these is a price the platform charges: a top-up is money the admin saw arrive (Invariant 1).

**`POST /api/org/[orgId]/enhancements/styled`** (`withOrg`, Image enhancement) parses **`requestStyledSchema`**
(`enhancement.schema.ts`): the photo (`sourceAssetId` or `sourceRef`, not both), `brief` 1–300 characters, `referenceRefs`
(URLs of the shop's own ready images, at most 13 here; the first model's limit is the server's, a refusal otherwise),
`face` (`no-face` | `with-face`), **`aspect`** (`1:1` | `4:5` | `9:16` | `4:3`; absent is `1:1`, so a page opened before Q42 shipped still works —
the modal itself will not send without one; any other value is "Choose the picture's shape"), optional `previousId`, `slot`, `slotRole`. It answers `{ enhancement, usage }` like the six
tools; a shop short of credit is `409` "Not enough credit for this picture". **`GET …/enhancements/styled/quote?references=n&aspect=4:5`**
(`aspect` defaults to `1:1` when absent or unknown) answers **`StyledQuoteDto`** `{ chargePaise, heldPaise, balancePaise, maxExtraReferences }`. `EnhancementDto` gains `brief`,
`referenceRefs`, `aspect` (null for the six tools and for styled runs from before Q42, which were square) and `previousId`
(empty for the six tools). No amount crosses from the browser: every price is the server's.

**A payment proof** (**`paymentProofSchema`**) is `{ method: "UPI" | "BANK_TRANSFER" | "CASH" | "OTHER", reference
(1–120, "Add the transaction reference"), paidOn (a date, not in the future), receiptRef (a URL in our own store, or
null) }`. **`PATCH /api/admin/settlements/[id]`** now parses **`settlementStatusSchema`**: `{ status: "PAID", ...proof }`
or `{ status: "CANCELLED" }`. **Breaking:** `PAID` without `method` and `reference` is `400`; `paidAt` is replaced by
`paidOn` (ai-images Q18).
