-- offers-hardening U6 (D7, R5, own-store Q21): every list price a product has had, so the
-- platform's share of a discount can be worked out on the lowest price in the last 30 days.
-- Additive; drops nothing. Written by a trigger rather than by the repository, because a price
-- has many writers (product form, bulk sheet, marketplace import and merge, seed) and none of
-- them may skip it. Backfilled with today's prices, so the window starts filling from now.

CREATE TABLE "ProductPriceHistory" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductPriceHistory_productId_recordedAt_idx" ON "ProductPriceHistory"("productId", "recordedAt");

-- Cascade: history carries no money, and a product any money row references is Restrict-held
-- by OrderItem. Restrict here would refuse every delete path a sold-nothing product has today.
ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- clock_timestamp, not now(): a product created and repriced in one transaction gets two
-- ordered rows rather than two at the same instant.
CREATE FUNCTION "record_product_price"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."price" IS DISTINCT FROM OLD."price" THEN
    INSERT INTO "ProductPriceHistory" ("productId", "pricePaise", "recordedAt")
    VALUES (NEW."id", NEW."price", clock_timestamp());
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Product_price_history"
  AFTER INSERT OR UPDATE OF "price" ON "Product"
  FOR EACH ROW EXECUTE FUNCTION "record_product_price"();

INSERT INTO "ProductPriceHistory" ("productId", "pricePaise", "recordedAt")
SELECT "id", "price", now() FROM "Product";
