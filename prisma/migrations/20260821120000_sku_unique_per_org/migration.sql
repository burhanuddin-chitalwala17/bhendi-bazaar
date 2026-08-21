-- A SKU identifies a product within its organisation, not across the platform
-- (bulk-catalog-upload R4). The old global unique meant org B's upload could fail
-- because org A had used the code first. Loosening global -> (orgId, sku) cannot
-- collide on existing data: anything valid under the stricter rule stays valid.
DROP INDEX "Product_sku_key";
CREATE UNIQUE INDEX "Product_orgId_sku_key" ON "Product"("orgId", "sku");
