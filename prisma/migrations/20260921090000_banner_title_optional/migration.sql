-- A banner's heading becomes optional, on both the platform hero and an org's own
-- promotions. Artwork that already carries its own typography had a headline laid
-- over it with nothing to say.
--
-- Widening only: every existing row keeps its title, and nothing that reads one has
-- to be migrated ahead of this.

ALTER TABLE "Banner" ALTER COLUMN "title" DROP NOT NULL;
ALTER TABLE "OrgBanner" ALTER COLUMN "title" DROP NOT NULL;

-- A title that is only whitespace is the same absence as no title at all, and the
-- renderer branches on null. Normalise the rows that predate the rule.
UPDATE "Banner" SET "title" = NULL WHERE btrim("title") = '';
UPDATE "OrgBanner" SET "title" = NULL WHERE btrim("title") = '';
