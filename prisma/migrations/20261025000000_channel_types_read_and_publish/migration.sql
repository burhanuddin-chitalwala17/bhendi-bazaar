-- marketplace-facts Q18, D3: several marketplace types may point to one of our types and kinds when
-- filling, and exactly one of them publishes. Adds a column and replaces two indexes; drops no data.
-- Every existing row becomes the publishing one, so readiness and the register read what they did.

ALTER TABLE "ChannelCategoryMap" ADD COLUMN "publishes" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX IF EXISTS "ChannelCategoryMap_channel_productType_kind_key";
DROP INDEX IF EXISTS "ChannelCategoryMap_channel_productType_allkinds_key";

-- One publishing row per type and kind, and one per type for "every kind" (a null kind).
CREATE UNIQUE INDEX "ChannelCategoryMap_publishing_kind_key"
  ON "ChannelCategoryMap" ("channel", "productType", "kind")
  WHERE "publishes" AND "kind" IS NOT NULL;
CREATE UNIQUE INDEX "ChannelCategoryMap_publishing_allkinds_key"
  ON "ChannelCategoryMap" ("channel", "productType")
  WHERE "publishes" AND "kind" IS NULL;

-- A marketplace type is listed once per type and kind.
CREATE UNIQUE INDEX "ChannelCategoryMap_reading_key"
  ON "ChannelCategoryMap" ("channel", "productType", COALESCE("kind", ''), "theirCategory")
  WHERE "theirCategory" IS NOT NULL;
