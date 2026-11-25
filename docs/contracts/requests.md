# Contracts — requests

- **Verified:** 2026-11-25
- **Covers:** `server/requests/*.types.ts`

The requests shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## setup-requests

Tickets for what a shop cannot fix itself (`server/requests/request.types.ts`, setup-requests D2, D11).
**`ShopTicketDTO`** (`id`, `type`, `kind`, `state`: with_us · ready · not_supported, `title`,
`category` (an issue's; null for a requirement, Q23), `names`, `productId`, `raisedAt`) is all a shop sees: never a plan or a step. **`AdminRequirementDTO`** (`id`,
`kind`, `status`, `title`, `shopsWaiting` (null for one, Q4), `reopened`, `openedAt`) never carries a
shop, product or words; **`AdminIssueDTO`** carries each report's shop, product and words (Q22).
**`RequirementPlanDTO`** is a fields plan (each attribute's solution: reuse, add, from_product, fixed,
not_possible, or since 2026-11-20 `map_parts` for a field in parts, which Apply skips and the admin maps per part
on the type's field maps `[CONTRACT]`) or a category plan (Amazon's options), with a `hash` Apply must echo (D7).

**`requestService.isOpenForShop(orgId, requestId)`** answers whether a request is the shop's own and still open: what
the inbox lets a chat be shared with support for (inbox-core D9).

Channels hands complaints to requests through the shared job `requests.listing-complaints`
(`server/shared/jobs/listing-complaints.job.ts`): per product, its marketplace type when known and its
errors with `attribute`, `field` and `need`. `MarketplaceProvider` gains `typeDefinition` and
`searchTypes`. Routes: `POST /api/org/{orgId}/requests` (a report), `GET|POST /api/admin/requests/{id}`
(preview; apply, not now, mark fixed). Bodies are `src/lib/validation/schemas/requests.schema.ts`:
`reportIssueSchema` (`category`, `words` ≤1,000, `productId`, the marketplace `error` or null) and
`requestActionSchema`, a union on `action` where only `apply` carries the plan's `hash` and the admin's
choices; a stale hash writes nothing and answers `{ stale: plan }`.

Since setup-requests Q33–Q35: `ShopTicketDTO` is read on the shop's own Requests page; `ISSUE_CATEGORY`
gains products, shop and payments. `OrgListingDefaultsDto` gains `amazonGeneric` (its own PUT, removed
by listing-model/dynamic-form unit 4, which moves the choice onto each brand). `CreateListingInput` gains `generic`;
`ListingRules` gains `genericBrand`; `ListingScreenDTO` gains `generic`; `ISSUE_NEED` gains
`brand_name`. A product's detail (`ProductDetails`) gains `brandId`, and each stock location its
`city`, `pincode` and `isActive`.

Since setup-requests D4 (decoupled): `TicketSubject`, a plan (`PlanBase`) and `ApplyChoice` are a kind's
own shape; `NeedDetail` (`source`, `context`, `code`, `subject`, `message`) replaces the marketplace-shaped
error on `ReportInput` and `AdminIssueDTO`; `AdminRequirementDTO` gains `mode`. Marketplace plan shapes
(`FieldsPlanDTO`, `CategoryPlanDTO`) live in `server/requests/marketplace/marketplace.types.ts`. The admin
apply body is `{ action: "apply", hash, choice }`, the choice parsed by its kind.
