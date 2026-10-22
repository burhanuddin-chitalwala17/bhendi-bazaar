-- product-merge: leave a listing off Bhendi Bazaar, count the photos copied from it, and allow one
-- listing per marketplace connection per product (D7, D6, D8). Adds columns and an index; drops nothing.

ALTER TABLE "ChannelListing"
    ADD COLUMN "leftOffAt" TIMESTAMP(3),
    ADD COLUMN "leftOffById" TEXT,
    ADD COLUMN "photoMode" TEXT,
    ADD COLUMN "photoTotal" INTEGER,
    ADD COLUMN "photoDone" INTEGER,
    ADD COLUMN "photoFailed" INTEGER,
    ADD COLUMN "photoUpdatedAt" TIMESTAMP(3),
    -- A listing is linked or left off, never both.
    ADD CONSTRAINT "ChannelListing_left_off_check" CHECK ("leftOffAt" IS NULL OR "productId" IS NULL),
    ADD CONSTRAINT "ChannelListing_photo_mode_check" CHECK ("photoMode" IS NULL OR "photoMode" IN ('append', 'replace')),
    ADD CONSTRAINT "ChannelListing_photo_counts_check" CHECK (
        ("photoTotal" IS NULL OR "photoTotal" >= 0) AND ("photoDone" IS NULL OR "photoDone" >= 0) AND ("photoFailed" IS NULL OR "photoFailed" >= 0)
    );

-- One listing per marketplace connection per product (Q22). Fails loudly if a shop already has two
-- listings on one marketplace linked to the same product. Possible only where two listing SKUs
-- differ by case or spaces and both linked by SKU; check production before deploying:
--   SELECT "connectionId", "productId", count(*) FROM "ChannelListing"
--   WHERE "productId" IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;
CREATE UNIQUE INDEX "ChannelListing_connection_product_key" ON "ChannelListing"("connectionId", "productId") WHERE "productId" IS NOT NULL;
