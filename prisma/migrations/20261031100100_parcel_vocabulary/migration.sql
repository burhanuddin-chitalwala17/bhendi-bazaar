-- order-fulfilment unit 1: one parcel vocabulary (docs/specs/own-store/order-fulfilment/trd.md D1-D5).
-- A data migration, not a seed: production needs these rows (CLAUDE.md Invariant 7). Drops nothing.

-- D5: the timeline. One row per parcel move; it goes with its parcel, as ShippingEvent does.
CREATE TABLE "ParcelEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'move',
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "courierWording" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParcelEvent_shipmentId_createdAt_idx" ON "ParcelEvent"("shipmentId", "createdAt");

ALTER TABLE "ParcelEvent" ADD CONSTRAINT "ParcelEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- D3 (Q3): any status outside the vocabulary (`pending`, `confirmed`, `failed`, old `shipped`,
-- `processing`, …) was never in the transition table, so no move on it ever applied. The
-- vocabulary is server/shipping/domain/shipping.types.ts SHIPMENT_STATUS; this list repeats it.
--
-- 1. Ops advanced some orders by hand while their parcels stayed behind. Those parcels follow the
--    order forward — delivered, or shipped (`in_transit`, as 20260924031148 read `shipped`) — so
--    deriving the order below can never lower it. Off-list and still-`packing` parcels alike.
UPDATE "Shipment" s SET "status" = CASE o."status" WHEN 'delivered' THEN 'delivered' ELSE 'in_transit' END,
  "deliveredAt" = CASE WHEN o."status" = 'delivered' THEN COALESCE(s."deliveredAt", o."updatedAt") ELSE s."deliveredAt" END
FROM "Order" o
WHERE o."id" = s."orderId"
  AND o."paymentStatus" = 'paid'
  AND o."status" IN ('delivered', 'shipped')
  AND (s."status" = 'packing' OR s."status" NOT IN (
    'packing', 'ready_for_pickup', 'pickup_booked', 'picked_up', 'in_transit', 'out_for_delivery',
    'delivery_failed', 'delivered', 'rto_in_transit', 'rto_delivered', 'cancelled', 'lost', 'damaged'));

-- 2. A parcel with an AWB and a courier event really left the shop.
UPDATE "Shipment" s SET "status" = 'picked_up'
WHERE s."status" NOT IN (
    'packing', 'ready_for_pickup', 'pickup_booked', 'picked_up', 'in_transit', 'out_for_delivery',
    'delivery_failed', 'delivered', 'rto_in_transit', 'rto_delivered', 'cancelled', 'lost', 'damaged')
  AND s."trackingNumber" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "ShippingEvent" e WHERE e."shipmentId" = s."id" AND e."eventType" = 'webhook_received');

-- 3. Every other off-list parcel is still with the shop.
UPDATE "Shipment" SET "status" = 'packing'
WHERE "status" NOT IN (
    'packing', 'ready_for_pickup', 'pickup_booked', 'picked_up', 'in_transit', 'out_for_delivery',
    'delivery_failed', 'delivered', 'rto_in_transit', 'rto_delivered', 'cancelled', 'lost', 'damaged');

-- D5 "seeded": every existing parcel starts its timeline where it stands, so no screen opens empty.
INSERT INTO "ParcelEvent" ("id", "shipmentId", "kind", "fromStatus", "toStatus", "actor", "reason", "createdAt")
SELECT 'pe_' || md5(s."id"), s."id", 'move', NULL, s."status", 'system', 'Recorded when the timeline began', s."updatedAt"
FROM "Shipment" s;

-- D4 (Q5): a paid order's status is a summary of its parcels — the SQL twin of
-- `summariseParcels` (server/checkout/parcel-summary.ts) — written only over a lower rank, the
-- twin of ORDER_STATUS_RANK (server/checkout/order.types.ts). Never lowers an order; unpaid,
-- expired and unranked orders are untouched.
-- fulfillOrder (deleted in this unit) once wrote two paid statuses the vocabulary no longer has.
-- A paid order left at either is "with its shop": confirmed, so the summary below can move it on.
UPDATE "Order" SET "status" = 'confirmed'
WHERE "paymentStatus" = 'paid' AND "status" IN ('partially_fulfilled', 'fulfillment_failed');

WITH summary AS (
  SELECT s."orderId",
    CASE
      WHEN bool_and(s."status" = 'cancelled') THEN 'cancelled'
      WHEN bool_and(s."status" IN ('delivered', 'cancelled')) THEN 'delivered'
      WHEN bool_or(s."status" NOT IN ('packing', 'ready_for_pickup', 'pickup_booked', 'cancelled')) THEN 'shipped'
      ELSE 'confirmed'
    END AS status
  FROM "Shipment" s
  GROUP BY s."orderId"
), ranked AS (
  SELECT "orderId", status,
    CASE status WHEN 'confirmed' THEN 1 WHEN 'shipped' THEN 4 ELSE 5 END AS rank
  FROM summary
)
UPDATE "Order" o SET "status" = ranked.status
FROM ranked
WHERE ranked."orderId" = o."id"
  AND o."paymentStatus" = 'paid'
  AND (CASE o."status"
         WHEN 'pending_payment' THEN 0 WHEN 'failed' THEN 0 WHEN 'confirmed' THEN 1
         WHEN 'processing' THEN 2 WHEN 'packed' THEN 3 WHEN 'shipped' THEN 4
         WHEN 'delivered' THEN 5 WHEN 'cancelled' THEN 5
       END) < ranked.rank;
