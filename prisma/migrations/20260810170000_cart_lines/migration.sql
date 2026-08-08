-- order-and-cart-lines PR 2: cart lines become rows. Only what the buyer chose is
-- stored (product, quantity, size, colour) — names, prices and images are derived
-- from the product at read time, so a cart can no longer hold a stale price.
-- Cart."items" stays one release as the audit copy (nullable, read by nothing).

CREATE TABLE "CartItem" (
  "id"        TEXT NOT NULL,
  "cartId"    TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity"  INTEGER NOT NULL,
  "size"      TEXT,
  "color"     TEXT,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Cascade, unlike OrderItem_productId: a cart line is a wish, not history.
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The lift: one row per blob line, keyed by position (the same product can sit in
-- two lines with different sizes). Lines whose product no longer exists are a wish
-- for something that is gone — skipped, but loudly.
DO $$
DECLARE
  lifted integer;
  skipped integer;
BEGIN
  CREATE TEMP TABLE "_cart_lift" ON COMMIT DROP AS
  SELECT
    c."id" AS cart_id,
    e.ord  AS line_no,
    e.elem ->> 'productId' AS product_id,
    COALESCE((e.elem ->> 'quantity')::int, 1) AS quantity,
    NULLIF(e.elem ->> 'size', '')  AS size,
    NULLIF(e.elem ->> 'color', '') AS color,
    (p."id" IS NOT NULL) AS product_exists
  FROM "Cart" c
  CROSS JOIN LATERAL jsonb_array_elements(c."items"::jsonb) WITH ORDINALITY AS e(elem, ord)
  LEFT JOIN "Product" p ON p."id" = e.elem ->> 'productId'
  WHERE jsonb_typeof(c."items"::jsonb) = 'array';

  SELECT count(*) INTO skipped FROM "_cart_lift" WHERE NOT product_exists;

  WITH inserted AS (
    INSERT INTO "CartItem" ("id", "cartId", "productId", "quantity", "size", "color")
    SELECT 'ci_' || md5(cart_id || ':' || product_id || ':' || line_no),
           cart_id, product_id, quantity, size, color
    FROM "_cart_lift" WHERE product_exists
    RETURNING 1
  )
  SELECT count(*) INTO lifted FROM inserted;

  RAISE NOTICE 'cart_lines lift: % lines lifted, % skipped (product deleted)', lifted, skipped;
END $$;

-- The blob is now legacy: nullable so new writes never touch it.
ALTER TABLE "Cart" ALTER COLUMN "items" DROP NOT NULL;
