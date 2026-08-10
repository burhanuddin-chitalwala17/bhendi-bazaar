-- Data-only. `thumbnail` is now derived from `images[0]` (server/catalog/admin.product.service.ts
-- deriveThumbnail), which is what the upload control's "Thumbnail" badge always claimed.
-- Products edited before that rule was enforced kept the thumbnail from creation time, so
-- their listing cards show a picture the gallery may no longer lead with.
--
-- Idempotent: re-running changes nothing once every row already agrees. Postgres arrays are
-- 1-indexed, so images[1] is the first image.
DO $$
DECLARE
  fixed INT;
BEGIN
  UPDATE "Product"
  SET "thumbnail" = "images"[1]
  WHERE array_length("images", 1) >= 1
    AND "thumbnail" <> "images"[1];

  GET DIAGNOSTICS fixed = ROW_COUNT;
  RAISE NOTICE 'thumbnail backfill: % product(s) realigned to their first image', fixed;
END $$;
