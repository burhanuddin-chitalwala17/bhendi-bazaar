-- Money becomes integer paise (Invariant 3, ADR-0004).
--
-- A data migration, not a type change (trd.md D1): the cast multiplies and rounds
-- explicitly — a bare type change would truncate 1200.50 to 1200 and lose the paise.
-- The Q1 survey found zero rows with sub-paisa drift, so ROUND changes no value; it is
-- a guard, not a correction.
--
-- Verification (trd.md D7), captured before writing this file:
--   SELECT SUM("price") FROM "Product";        -- was 29899.00  → must read 2989900
--   SELECT SUM("grandTotal") FROM "Order";     -- was 40490.54  → must read 4049054

ALTER TABLE "Product"
  ALTER COLUMN "price"     TYPE INTEGER USING ROUND("price" * 100)::int,
  ALTER COLUMN "salePrice" TYPE INTEGER USING ROUND("salePrice" * 100)::int;

ALTER TABLE "Order"
  ALTER COLUMN "itemsTotal"    DROP DEFAULT,
  ALTER COLUMN "shippingTotal" DROP DEFAULT,
  ALTER COLUMN "discount"      DROP DEFAULT,
  ALTER COLUMN "grandTotal"    DROP DEFAULT;
ALTER TABLE "Order"
  ALTER COLUMN "itemsTotal"    TYPE INTEGER USING ROUND("itemsTotal" * 100)::int,
  ALTER COLUMN "shippingTotal" TYPE INTEGER USING ROUND("shippingTotal" * 100)::int,
  ALTER COLUMN "discount"      TYPE INTEGER USING ROUND("discount" * 100)::int,
  ALTER COLUMN "grandTotal"    TYPE INTEGER USING ROUND("grandTotal" * 100)::int;
ALTER TABLE "Order"
  ALTER COLUMN "itemsTotal"    SET DEFAULT 0,
  ALTER COLUMN "shippingTotal" SET DEFAULT 0,
  ALTER COLUMN "discount"      SET DEFAULT 0,
  ALTER COLUMN "grandTotal"    SET DEFAULT 0;

ALTER TABLE "Shipment"
  ALTER COLUMN "shippingCost" TYPE INTEGER USING ROUND("shippingCost" * 100)::int;

-- The rate cache is repriced rather than converted: entries are transient by design,
-- and a cache that cannot be mistrusted beats one whose unit depends on write date.
DELETE FROM "ShippingRateCache";
ALTER TABLE "ShippingRateCache"
  ALTER COLUMN "rate" TYPE INTEGER USING ROUND("rate" * 100)::int;
