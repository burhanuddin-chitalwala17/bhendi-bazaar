-- order-fulfilment unit 2: ready, nudges and notices (docs/specs/own-store/order-fulfilment/trd.md D8, D18).
-- Additive. Drops nothing; rewrites only the new `paidAt` and the parcels of orders already packed.

-- D18: the clock the 12 h and 24 h nudges and the 36 h flag run on. Old paid orders take their
-- creation time: the payment window is fifteen minutes, so it is the closest fact we hold.
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMP(3);
UPDATE "Order" SET "paidAt" = "createdAt" WHERE "paymentStatus" = 'paid';

-- D8: one row per email per parcel; the unique key makes a repeated move or sweep send once.
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notice_shipmentId_kind_audience_key" ON "Notice"("shipmentId", "kind", "audience");

ALTER TABLE "Notice" ADD CONSTRAINT "Notice_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Before this unit the shop marked a whole order `packed` and its parcels stayed `packing`; the
-- tracking route now refuses a `packing` parcel, so those parcels move to where the shop left them.
INSERT INTO "ParcelEvent" ("id", "shipmentId", "kind", "fromStatus", "toStatus", "actor", "reason", "createdAt")
SELECT 'pe_' || md5(s."id" || 'ready_for_pickup'), s."id", 'move', 'packing', 'ready_for_pickup', 'system',
       'The shop marked the order packed before parcels were marked ready', CURRENT_TIMESTAMP
FROM "Shipment" s
JOIN "Order" o ON o."id" = s."orderId"
WHERE s."status" = 'packing' AND o."paymentStatus" = 'paid' AND o."status" = 'packed';

UPDATE "Shipment" s SET "status" = 'ready_for_pickup', "updatedAt" = CURRENT_TIMESTAMP
FROM "Order" o
WHERE o."id" = s."orderId" AND s."status" = 'packing' AND o."paymentStatus" = 'paid' AND o."status" = 'packed';

-- D18: parcels already waiting when this deploys are marked as already told, so the first sweep
-- emails no one about a backlog. Kinds and audiences repeat NOTICE_KIND / NOTICE_AUDIENCE.
INSERT INTO "Notice" ("id", "shipmentId", "kind", "audience", "recipient", "data", "sentAt")
SELECT 'nt_' || md5(s."id" || k.kind), s."id", k.kind, 'shop', g."email", '{}'::jsonb, CURRENT_TIMESTAMP
FROM "Shipment" s
JOIN "Order" o ON o."id" = s."orderId"
JOIN "Org" g ON g."id" = s."orgId"
CROSS JOIN (VALUES ('not_ready_12h'), ('not_ready_24h')) AS k(kind)
WHERE s."status" = 'packing' AND o."paymentStatus" = 'paid';

INSERT INTO "Notice" ("id", "shipmentId", "kind", "audience", "recipient", "data", "sentAt")
SELECT 'nt_' || md5(s."id" || k.kind), s."id", k.kind, 'admin', 'support@bhendibazaar.com', '{}'::jsonb, CURRENT_TIMESTAMP
FROM "Shipment" s
CROSS JOIN (VALUES ('ready'), ('ready_24h')) AS k(kind)
WHERE s."status" = 'ready_for_pickup';
