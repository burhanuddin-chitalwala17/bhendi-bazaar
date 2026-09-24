-- A product's rating and review count are derived from the published reviews, never
-- stored (product-reviews R6a, trd.md D9).
--
-- Subtractive and backfill-free: nothing has written either column since the catalogue
-- existed, so every row already holds the default. The numbers now come from
-- server/catalog/review-rating.ts, which is the only place they are computed.
ALTER TABLE "Product" DROP COLUMN "rating";
ALTER TABLE "Product" DROP COLUMN "reviewsCount";

-- Indexes follow the queries (trd.md D10). The composite serves both the product
-- page's newest-first list and the rating projection; the two it replaces cannot be
-- used selectively — a boolean and a 1-5 integer — and cost every write.
DROP INDEX "Review_productId_idx";
DROP INDEX "Review_isApproved_idx";
DROP INDEX "Review_rating_idx";
CREATE INDEX "Review_productId_isApproved_createdAt_idx" ON "Review"("productId", "isApproved", "createdAt");
