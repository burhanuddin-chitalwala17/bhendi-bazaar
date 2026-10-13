-- An attribute mapping is keyed by the channel's own category, not by our product type.
--
-- Found while seeding Flipkart's attributes, before any row existed. A required-field set is a
-- property of **their** node: Flipkart's `bag` asks Number of Compartments and Waterproof, while
-- `sling-bag` and `hand-messenger-bag` carry neither field — and all three are our `bag` type.
-- Keyed by our type, a sling bag would have been told to answer a question Flipkart never asks,
-- which is the readiness-that-disagrees-with-the-channel hazard the spec names second.
--
-- One template file per node is also how the data arrives, so this is the shape it already has.
-- The table is empty, so there is nothing to carry across.

DROP INDEX IF EXISTS "ChannelAttributeMap_channel_productType_fact_key";
DROP INDEX IF EXISTS "ChannelAttributeMap_channel_idx";

-- Guarded so a manual replay is a no-op, as the data migrations beside it are.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'ChannelAttributeMap' AND column_name = 'productType') THEN
    ALTER TABLE "ChannelAttributeMap" RENAME COLUMN "productType" TO "theirCategory";
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelAttributeMap_channel_theirCategory_fact_key"
  ON "ChannelAttributeMap" ("channel", "theirCategory", "fact");
CREATE INDEX IF NOT EXISTS "ChannelAttributeMap_channel_theirCategory_idx"
  ON "ChannelAttributeMap" ("channel", "theirCategory");
