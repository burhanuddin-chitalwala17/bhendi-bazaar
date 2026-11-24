# Contracts — subscriptions

- **Verified:** 2026-11-24
- **Covers:** `server/subscriptions/*.types.ts`

The subscriptions shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## subscriptions/feature-access

What a shop may use of the paid features (`server/subscriptions/feature-access.types.ts`, D2–D4, D12).
**`FeatureAccessDTO`** (`channels`, `storefront`, `imageEnhancement`, `socialSelling`: booleans; `socialSelling` added by social-selling connect-instagram) is what a page hands
the leaves that draw paid actions; the home brand's is all true. **`OrgPlanDTO`** (`homeBrand`,
`switches`) is the admin's Plan tab; each **`FeatureSwitchDTO`** is `feature`, `enabled`, `changedAt`
(null when never switched, which is off) and `changedBy` (`name`, `email`, or null).
`PUT /api/admin/orgs/{id}/features/{feature}` takes `orgFeatureSwitchSchema` (`{ enabled }`,
`src/lib/validation/schemas/org-feature.schema.ts`) and answers `{ switch: FeatureSwitchDTO }`; an
unknown feature is 404, the home brand 409.
