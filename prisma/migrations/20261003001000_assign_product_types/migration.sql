-- Point this store's existing categories at a product type, and copy the resolved type onto the
-- products under them ([listing-vocabulary/categories](../../docs/specs/listing-vocabulary/categories/) D1b).
--
-- Keyed by slug, so it is a no-op on any database that does not have these categories — the dev
-- and CI databases carry fixtures, not this catalogue. Every statement is guarded on the column
-- still being NULL, so it never overwrites a choice an admin made later and re-running changes
-- nothing.
--
-- The mapping, agreed with the owner on 2026-10-02 against a survey of the live catalogue:
--
--   hand-bags              22 products  → bag
--   ridas (+ its 4 children)  36       → islamic-wear, inherited by formal, semi-formal,
--                                        casual and ohbat, which stay categories because all
--                                        four hold the same kind
--   bottom-wear            10          → trousers
--   bukhoor-and-attar       3          → fragrance
--   jwellery                1          → jewellery
--   ladies-masalla-bag     18          → left NULL; it is a combo, and the owner points it there
--   beauty-health-products  2          → left NULL; no type fits yet
--   kitchen-and-dinning     2          → left NULL; no type fits yet
--
-- A category with no type is legitimate and its products still save and still sell. They are
-- simply not publishable to a marketplace, which is what the owner chose for all three.

UPDATE "Category" SET "productType" = 'bag'          WHERE "slug" = 'hand-bags'         AND "productType" IS NULL;
UPDATE "Category" SET "productType" = 'islamic-wear' WHERE "slug" = 'ridas'             AND "productType" IS NULL;
UPDATE "Category" SET "productType" = 'trousers'     WHERE "slug" = 'bottom-wear'       AND "productType" IS NULL;
UPDATE "Category" SET "productType" = 'fragrance'    WHERE "slug" = 'bukhoor-and-attar' AND "productType" IS NULL;
UPDATE "Category" SET "productType" = 'jewellery'    WHERE "slug" = 'jwellery'          AND "productType" IS NULL;

-- Copy the resolved type onto each product. The resolution is the same walk `resolveProductType`
-- does in code — a category's own type, else the nearest ancestor's — expressed here as a
-- recursive CTE so the four rida children inherit from their parent without being named.
--
-- Stored on the product rather than read through the category (D1b): merchandising moves
-- categories, and a product's questions and stored answers must not move with them.
WITH RECURSIVE resolved AS (
  -- A category that declares its own type resolves to it.
  SELECT c."id", c."productType"
    FROM "Category" c
   WHERE c."productType" IS NOT NULL
  UNION ALL
  -- One that does not takes its parent's answer.
  SELECT c."id", r."productType"
    FROM "Category" c
    JOIN resolved r ON c."parentId" = r."id"
   WHERE c."productType" IS NULL
)
UPDATE "Product" p
   SET "productType" = r."productType"
  FROM resolved r
 WHERE p."categoryId" = r."id"
   AND p."productType" IS NULL;
