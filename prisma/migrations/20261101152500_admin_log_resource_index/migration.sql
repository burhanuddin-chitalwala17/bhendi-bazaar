-- product-form unit 5: a product's team edits are read by (resource, resourceId) (docs/specs/own-store/product-form/trd.md, Data model).
-- Additive only: an index, no data moves.

CREATE INDEX "AdminLog_resource_resourceId_idx" ON "AdminLog"("resource", "resourceId");
