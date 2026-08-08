-- order-and-cart-lines PR 1: what a customer bought becomes a relation, not a blob.
-- OrderItem (order -> product, unitPrice paise from birth) + ShipmentItem (what one
-- parcel packs, pointing at the order line). Shipment."items" stays one release as
-- the audit copy of this lift (nullable, read by nothing).

CREATE TABLE "OrderItem" (
  "id"        TEXT NOT NULL,
  "orderId"   TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity"  INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "size"      TEXT,
  "color"     TEXT,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- A sold product cannot be deleted out from under its order history (R2).
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ShipmentItem" (
  "id"          TEXT NOT NULL,
  "shipmentId"  TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "quantity"    INTEGER NOT NULL,
  CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShipmentItem_shipmentId_idx" ON "ShipmentItem"("shipmentId");
CREATE INDEX "ShipmentItem_orderItemId_idx" ON "ShipmentItem"("orderItemId");
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The lift. One OrderItem + one ShipmentItem per JSON line (TRD D1).
--
-- Units (TRD D3): money-as-paise multiplied the Order total columns x100 but left
-- these blobs alone, so old blobs are rupee floats and post-PR-38 blobs are paise.
-- Self-consistent test, per order: if the blob lines sum x100 to the (paise)
-- itemsTotal, the blob is rupees. unitPrice applies the same sale-price rule
-- checkout charges (salePrice set, > 0, and below price — pricing.ts).
--
-- Lines whose product has been deleted cannot get a row under RESTRICT (TRD D4):
-- skipped, counted, and reported loudly below. The blob keeps the audit copy.
DO $$
DECLARE
  lifted integer;
  skipped integer;
BEGIN
  CREATE TEMP TABLE "_lift" ON COMMIT DROP AS
  WITH lines AS (
    -- One row per JSON line, keyed by position: the same product can appear twice
    -- in one shipment (old carts split sizes into separate lines), so the line's
    -- ordinality — not the product — is what identifies it.
    SELECT
      s."id"      AS shipment_id,
      s."orderId" AS order_id,
      e.ord       AS line_no,
      e.elem ->> 'productId' AS product_id,
      COALESCE((e.elem ->> 'quantity')::int, 1) AS quantity,
      CASE
        WHEN (e.elem ->> 'salePrice') IS NOT NULL
         AND (e.elem ->> 'salePrice')::numeric > 0
         AND (e.elem ->> 'salePrice')::numeric < COALESCE((e.elem ->> 'price')::numeric, 0)
        THEN (e.elem ->> 'salePrice')::numeric
        ELSE COALESCE((e.elem ->> 'price')::numeric, 0)
      END AS unit_price_raw
    FROM "Shipment" s
    CROSS JOIN LATERAL jsonb_array_elements(s."items"::jsonb) WITH ORDINALITY AS e(elem, ord)
    WHERE jsonb_typeof(s."items"::jsonb) = 'array'
  ),
  units AS (
    -- rupees iff the order's lines sum x100 to its already-paise itemsTotal
    SELECT l.order_id,
           (ROUND(SUM(l.unit_price_raw * l.quantity) * 100) = o."itemsTotal") AS is_rupees
    FROM lines l JOIN "Order" o ON o."id" = l.order_id
    GROUP BY l.order_id, o."itemsTotal"
  )
  SELECT
    l.shipment_id,
    l.order_id,
    l.line_no,
    l.product_id,
    l.quantity,
    CASE WHEN u.is_rupees THEN ROUND(l.unit_price_raw * 100)::int
         ELSE ROUND(l.unit_price_raw)::int END AS unit_price,
    (p."id" IS NOT NULL) AS product_exists
  FROM lines l
  JOIN units u ON u.order_id = l.order_id
  LEFT JOIN "Product" p ON p."id" = l.product_id;

  SELECT count(*) INTO skipped FROM "_lift" WHERE NOT product_exists;

  WITH inserted AS (
    INSERT INTO "OrderItem" ("id", "orderId", "productId", "quantity", "unitPrice")
    SELECT 'oi_' || md5(shipment_id || ':' || product_id || ':' || line_no),
           order_id, product_id, quantity, unit_price
    FROM "_lift" WHERE product_exists
    RETURNING 1
  )
  SELECT count(*) INTO lifted FROM inserted;

  INSERT INTO "ShipmentItem" ("id", "shipmentId", "orderItemId", "quantity")
  SELECT 'si_' || md5(shipment_id || ':' || product_id || ':' || line_no),
         shipment_id,
         'oi_' || md5(shipment_id || ':' || product_id || ':' || line_no),
         quantity
  FROM "_lift" WHERE product_exists;

  RAISE NOTICE 'order_lines lift: % lines lifted, % skipped (product deleted; blob keeps the audit copy)',
    lifted, skipped;
END $$;

-- The blob is now legacy: nullable so new shipments never write it.
ALTER TABLE "Shipment" ALTER COLUMN "items" DROP NOT NULL;
