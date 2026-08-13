-- product-video: a product's gallery becomes an ordered relation that can hold video,
-- and the cover becomes an explicit choice rather than "whatever is first".
--
-- Additive only. "Product"."images" still exists and still holds the truth after this
-- runs, so the cutover build can be rolled back by redeploying the previous one; the
-- column is dropped in a separate later migration, the way the stock-locations cutover
-- was (20260810220000_drop_legacy_stock_and_origin).

CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'YOUTUBE');

CREATE TABLE "ProductMedia" (
  "id"          TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "kind"        "MediaKind" NOT NULL,
  "ref"         TEXT NOT NULL,
  "position"    INTEGER NOT NULL,
  "description" TEXT,
  "isThumbnail" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductMedia_productId_idx" ON "ProductMedia"("productId");
CREATE UNIQUE INDEX "ProductMedia_productId_position_key" ON "ProductMedia"("productId", "position");
-- Media belongs to its product and dies with it (R10).
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The lift: one IMAGE row per existing gallery entry, in the array's own order.
-- Postgres arrays are 1-indexed and `position` is 0-based.
INSERT INTO "ProductMedia" ("id", "productId", "kind", "ref", "position", "isThumbnail")
SELECT
  gen_random_uuid()::text,
  p."id",
  'IMAGE'::"MediaKind",
  img.ref,
  (img.ord - 1)::int,
  false
FROM "Product" p
CROSS JOIN LATERAL unnest(p."images") WITH ORDINALITY AS img(ref, ord);

-- A product whose gallery array was empty still has a NOT NULL thumbnail, and must end
-- up with exactly one cover like every other row. Defensive: the Zod schema has
-- required at least one image for as long as it has existed, so this should match
-- nothing.
INSERT INTO "ProductMedia" ("id", "productId", "kind", "ref", "position", "isThumbnail")
SELECT gen_random_uuid()::text, p."id", 'IMAGE'::"MediaKind", p."thumbnail", 0, false
FROM "Product" p
WHERE NOT EXISTS (SELECT 1 FROM "ProductMedia" m WHERE m."productId" = p."id");

-- Flag one cover per product: the row matching the product's current thumbnail, so no
-- seller's card changes appearance across this migration. Where none matches — a
-- thumbnail pointing at something no longer in the gallery — the lowest position wins.
-- This "where none matches" branch exists only here; there is deliberately no runtime
-- fallback (TRD D4a).
UPDATE "ProductMedia" SET "isThumbnail" = true
WHERE "id" IN (
  SELECT DISTINCT ON (m."productId") m."id"
  FROM "ProductMedia" m
  JOIN "Product" p ON p."id" = m."productId"
  ORDER BY m."productId", (m."ref" = p."thumbnail") DESC, m."position" ASC
);

-- Constraints go on after the backfill, so a backfill that failed to produce exactly
-- one photograph cover per product aborts the migration rather than committing a state
-- the application believes is impossible.
--
-- Neither is expressible in Prisma's schema language, so both live here and are
-- re-stated in prisma/schema.prisma's doc comment on ProductMedia. What they cannot
-- express is "at least one row" — a count across rows is not a row-level check — which
-- is why that stays a boundary rule backed by "Product"."thumbnail" being NOT NULL.
CREATE UNIQUE INDEX "ProductMedia_one_thumbnail_per_product"
  ON "ProductMedia"("productId") WHERE "isThumbnail";
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_thumbnail_is_image"
  CHECK (NOT "isThumbnail" OR "kind" = 'IMAGE');

-- What the buyer saw, frozen (R17). Same kind of fact as "unitPrice" beside it.
ALTER TABLE "OrderItem" ADD COLUMN "thumbnail" TEXT;

-- Backfilled from each product's cover as it stands today. This is not what those
-- buyers saw — nothing recorded that — so it freezes the present rather than
-- recovering the past. Stated here because the column will later look as though it was
-- always authoritative.
UPDATE "OrderItem" oi
SET "thumbnail" = p."thumbnail"
FROM "Product" p
WHERE p."id" = oi."productId" AND oi."thumbnail" IS NULL;

DO $$
DECLARE
  media_rows INT;
  covers     INT;
  products   INT;
BEGIN
  SELECT COUNT(*) INTO media_rows FROM "ProductMedia";
  SELECT COUNT(*) INTO covers FROM "ProductMedia" WHERE "isThumbnail";
  SELECT COUNT(*) INTO products FROM "Product";
  RAISE NOTICE 'product-video: % media row(s) for % product(s), % cover(s)', media_rows, products, covers;
  IF covers <> products THEN
    RAISE EXCEPTION 'every product must have exactly one cover: % product(s) but % cover(s)', products, covers;
  END IF;
END $$;
