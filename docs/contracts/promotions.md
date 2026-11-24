# Contracts — promotions

- **Verified:** 2026-11-24
- **Covers:** `server/promotions/*.types.ts`

The promotions shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Offers
`POST /api/checkout/promotions/quote` takes `{ items[], code? }` and returns `{ lineDiscounts, applied[], couponCoveredKeys, totalDiscountPaise, rejection }`. Every eligibility rule stays server-side: the response carries **per-line amounts** so the browser can badge covered items without re-deriving one, which is the same reason a discount amount is never accepted inbound.

`rejection` is a shape, not a string — `{ code, reason, message, shortfallPaise? }` — because the four reasons a code does nothing are acted on differently by the UI. **A code that would take nothing off is a rejection, never a success**: reporting one as applied means the buyer only finds out on the payment screen.

Order creation gains an optional **`couponCode`** — a string, normalised to upper case, and the only promotional input a request may carry (PR-67). Discount amounts, percentages and promotion ids are server-owned in exactly the way `paymentStatus` is; the amount is computed inside the order transaction from the persisted offer.

**A platform offer carries a budget and a loss confirmation (offers-hardening U5, 2026-10-29) `[CONTRACT]`.** `PlatformPromotionFormInput` (`platformPromotionSchema` in `src/lib/validation/schemas/promotion.schema.ts`, used by `POST /api/admin/promotions` and `PATCH /api/admin/promotions/[id]`) adds `budget?` (rupees, > 0) and `confirmLoss?` (empty, or exactly `"CONFIRM LOSS"`). When the offer could cost more than the lowest commission in force, both are required and refused on their fields otherwise. A shop's `PromotionFormInput` has neither and strips them. `platformSpentPaise`, `lossConfirmedAt` and `lossConfirmedByUserId` are never input: the spend is moved by the order transaction, the confirmer is the session's admin. The offer list (`GET /api/admin/promotions`, `OfferRow`) gains `platformBudgetPaise` (null = no budget), `platformSpentPaise`, `lossConfirmedAt` and `lossConfirmedBy: { name } | null`. A budgeted offer that cannot cover a basket's share is left out of the quote, so preview and charge agree; order creation is refused with a 409 "That offer has just ended. Please review your total." only when another order took the budget in between.

**Shipping is a signed quote, not a figure.** Each rate from `POST /api/shipping/rates` carries `quote`, a server signature over the courier, the charge in paise, the origin and destination pincodes, the billable weight and a 30-minute expiry. Order creation's `shippingGroups[].selectedRate` is `{ quote }` and nothing else (2026-10-14): the charge, courier and provider are read from the signature and checked against the parcel the server allocated, so an edited price, a quote for another address or weight, or an expired one is refused with a 409.

**`salePrice` is no longer a column.** It survives as a field name on the product and cart wire shapes, where it now means *the offer-adjusted price*, resolved server-side through the one function checkout prices with (ADR-0018). The name is retained because every consumer already reads it as "the reduced price"; renaming it is a follow-up, and until then the comment on each producer says what it is. Nothing accepts it inbound except `ProductFormInput`, where it is the seller's markdown and is stored as an offer rather than on the product.
