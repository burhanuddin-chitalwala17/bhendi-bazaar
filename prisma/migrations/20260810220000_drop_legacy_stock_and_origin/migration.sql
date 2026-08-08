-- stock-locations PR 6 (destructive): the columns the cutover stopped reading.
-- Origin has one home (OrgAddress), a quantity has one home (ProductStock.quantity).
-- Deliberately a separate migration from the cutover, so the cutover was reversible
-- by redeploying the dual-write build.

DROP INDEX IF EXISTS "Product_shippingFromPincode_idx";
DROP INDEX IF EXISTS "Product_stock_idx";
ALTER TABLE "Product"
  DROP COLUMN IF EXISTS "stock",
  DROP COLUMN IF EXISTS "shippingFromPincode",
  DROP COLUMN IF EXISTS "shippingFromCity",
  DROP COLUMN IF EXISTS "shippingFromLocation";

DROP INDEX IF EXISTS "Org_defaultPincode_idx";
ALTER TABLE "Org"
  DROP COLUMN IF EXISTS "defaultPincode",
  DROP COLUMN IF EXISTS "defaultCity",
  DROP COLUMN IF EXISTS "defaultState",
  DROP COLUMN IF EXISTS "defaultAddress";
