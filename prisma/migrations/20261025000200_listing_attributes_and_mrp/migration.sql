-- marketplace-facts D6, Q6, Q21: a listing keeps the marketplace's last read of its type, attributes
-- and details, the facts skipped on its card, and why it was left off; a product gains its MRP.
-- Adds columns only; drops nothing.

ALTER TABLE "ChannelListing"
    ADD COLUMN "leftOffReason" TEXT,
    ADD COLUMN "attributes" JSONB,
    ADD COLUMN "attributesReadAt" TIMESTAMP(3),
    ADD COLUMN "attributeSkips" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD CONSTRAINT "ChannelListing_left_off_reason_check"
        CHECK ("leftOffReason" IS NULL OR ("leftOffReason" = 'no_type' AND "leftOffAt" IS NOT NULL));

ALTER TABLE "Product"
    ADD COLUMN "mrpPaise" INTEGER,
    ADD CONSTRAINT "Product_mrp_check" CHECK ("mrpPaise" IS NULL OR "mrpPaise" >= 0);
