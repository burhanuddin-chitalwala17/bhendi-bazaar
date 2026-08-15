-- Markdowns become offers (promotions D9, ADR-0018 decision 4, ADR-0019).
--
-- `Product.salePrice` was the one price reduction that lived outside the offer model:
-- untimed, unattributed, and — fatally — not comparable against a platform offer. A
-- markdown is an organisation's own offer, and one that sits outside the comparison
-- can be neither weighed against a platform campaign nor charged to whoever paid for
-- it. So each becomes an org-funded, automatic, product-targeted offer at a fixed
-- selling price, which is exactly what a markdown means.
--
-- Ids are derived from the product rather than generated, so the backfill is
-- idempotent and each offer is traceable to the row it came from.

INSERT INTO "Promotion" (
  id, label, scope, "orgId", trigger, "valueType", "fixedPricePaise",
  "startsAt", "endsAt", "isActive", "minSubtotalPaise", "usageCount",
  "createdAt", "updatedAt"
)
SELECT
  'mkdn_' || p.id,
  'Markdown — ' || p.name,
  'ORG',
  p."orgId",
  'AUTOMATIC',
  'FIXED_PRICE',
  p."salePrice",
  now(),
  -- A migration cannot invent a business decision. These markdowns never had an end
  -- date, so they get a far one and are findable by their label prefix for review —
  -- better a visible list than a deadline nobody chose.
  TIMESTAMP '2099-12-31 00:00:00',
  true, 0, 0, now(), now()
FROM "Product" p
WHERE p."salePrice" IS NOT NULL
  AND p."salePrice" > 0
  AND p."salePrice" < p.price
ON CONFLICT (id) DO NOTHING;

INSERT INTO "PromotionTarget" (id, "promotionId", "productId")
SELECT 'mkdntgt_' || p.id, 'mkdn_' || p.id, p.id
FROM "Product" p
WHERE p."salePrice" IS NOT NULL
  AND p."salePrice" > 0
  AND p."salePrice" < p.price
ON CONFLICT (id) DO NOTHING;
