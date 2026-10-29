-- offers-hardening U1 (D1): a reversal belongs to a parcel. Adds two nullable columns and replaces
-- one unique index with three partial ones; drops no data. Existing order-wide reversals keep a
-- null shipmentId and stand (Q6). The old index held one row per (orderId, orgId, kind), so the
-- three new ones cannot fail on existing rows.

DROP INDEX "OrgLedgerEntry_orderId_orgId_kind_key";

ALTER TABLE "OrgLedgerEntry" ADD COLUMN "shipmentId" TEXT;
ALTER TABLE "OrgLedgerEntryLine" ADD COLUMN "quantity" INTEGER;

CREATE INDEX "OrgLedgerEntry_shipmentId_idx" ON "OrgLedgerEntry"("shipmentId");
CREATE INDEX "OrgLedgerEntry_orderId_orgId_idx" ON "OrgLedgerEntry"("orderId", "orgId");

ALTER TABLE "OrgLedgerEntry" ADD CONSTRAINT "OrgLedgerEntry_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique indexes Prisma's schema language cannot express. Named `<Model>_…_key` so
-- `uniqueViolationFields` reads the columns back from the name.
-- One sale per order and org: a replayed payment confirmation cannot pay twice.
CREATE UNIQUE INDEX "OrgLedgerEntry_sale_orderId_orgId_key" ON "OrgLedgerEntry"("orderId", "orgId") WHERE "kind" = 'SALE';
-- One order-wide reversal per order and org: the shape written before parcels carried their own.
CREATE UNIQUE INDEX "OrgLedgerEntry_legacy_orderId_orgId_key" ON "OrgLedgerEntry"("orderId", "orgId") WHERE "kind" = 'REVERSAL' AND "shipmentId" IS NULL;
-- One reversal per parcel: a courier repeating a terminal event, or two racing, writes it once.
CREATE UNIQUE INDEX "OrgLedgerEntry_reversal_shipmentId_key" ON "OrgLedgerEntry"("shipmentId") WHERE "kind" = 'REVERSAL' AND "shipmentId" IS NOT NULL;
