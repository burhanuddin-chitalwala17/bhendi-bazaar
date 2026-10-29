-- offers-hardening D10 (R8): the database refuses an impossible offer or line discount.
--
-- Already enforced since 20260816000000_promotions_and_payouts, so not repeated here:
--   percent 1..10000 and amount off > 0 (Promotion_value_matches_type), OrderItem
--   0 <= orgFunded <= discount (OrderItem_discount_split_sane), OrderDiscount parts >= 0
--   (OrderDiscount_funding_non_negative). This adds what was missing, and tightens a fixed
--   sale price from >= 0 to > 0: every writer (offer form, product sale price, sheet) already
--   requires > 0, and a ₹0 sale price is giving the item away.
--
-- Run these against production before deploying. Each must return no rows, or the
-- ALTER fails and the deploy stops:
--
--   SELECT id, "fixedPricePaise", "maxDiscountPaise", "minSubtotalPaise",
--          "usageCount", "usageLimit", "perUserLimit"
--   FROM "Promotion"
--   WHERE "fixedPricePaise" <= 0 OR "maxDiscountPaise" <= 0 OR "minSubtotalPaise" < 0
--      OR "usageCount" < 0 OR "usageLimit" <= 0 OR "perUserLimit" <= 0;
--
--   SELECT id, "orderId", "unitPrice", quantity, "discountPaise"
--   FROM "OrderItem"
--   WHERE "discountPaise" > "unitPrice"::bigint * quantity;

ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_fixed_price_positive"
  CHECK ("fixedPricePaise" IS NULL OR "fixedPricePaise" > 0);

ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_cap_positive"
  CHECK ("maxDiscountPaise" IS NULL OR "maxDiscountPaise" > 0);

ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_min_subtotal_non_negative"
  CHECK ("minSubtotalPaise" >= 0);

-- A limit of zero is an offer nobody can use; switching it off is what isActive is for.
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_usage_sane"
  CHECK ("usageCount" >= 0
     AND ("usageLimit" IS NULL OR "usageLimit" > 0)
     AND ("perUserLimit" IS NULL OR "perUserLimit" > 0));

-- A line cannot be discounted below free. bigint, so a large line cannot overflow int4.
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_discount_within_line"
  CHECK ("discountPaise" <= "unitPrice"::bigint * "quantity");
