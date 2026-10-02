-- AlterTable
ALTER TABLE "ProductType" ADD COLUMN     "factLabels" JSONB;

-- Carry across the per-type relabelling that the first migration dropped. Flipkart asks cloth
-- "Fabric" and everything else "Material"; it is one question with two labels, not two facts, so
-- the label belongs to the type rather than to the fact (listing-facts FACT.MATERIAL).
UPDATE "ProductType"
   SET "factLabels" = '{"material":"Fabric"}'::jsonb
 WHERE "key" IN ('islamic-wear', 'trousers', 'socks');

-- Everything else relabels nothing, and an absent map reads the same as an empty one.
UPDATE "ProductType" SET "factLabels" = '{}'::jsonb WHERE "factLabels" IS NULL;
