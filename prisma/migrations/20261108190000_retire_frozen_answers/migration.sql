-- listing-model/retire-old-paths R1–R3: Product.facts and Product.measurements go. Since dynamic-form 3b
-- (20261108180000) every answer lives verbatim in ProductValue and nothing reads these columns.
-- Confirmed disposable 2026-11-08: the owner approved the full switch and the cleanup in the same release
-- ("complete the feature do the cleanup"), and the compare on a production copy that day found every answer
-- in the value rows (113 products, 413 answers, 0 mismatches). Nothing recorded is lost: the columns are
-- archived whole below first, and this migration fails, changing nothing, if any answer is not in a value row.

-- CreateTable
CREATE TABLE "ProductAnswersArchive" (
    "productId" TEXT NOT NULL,
    "facts" JSONB,
    "measurements" JSONB,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAnswersArchive_pkey" PRIMARY KEY ("productId")
);

-- Every product's columns, whole, before the drop.
INSERT INTO "ProductAnswersArchive" ("productId", "facts", "measurements")
SELECT "id", "facts", "measurements" FROM "Product"
WHERE "facts" IS NOT NULL OR "measurements" IS NOT NULL;

-- The gate: every key each product held is a value row holding exactly that answer, and the archive is whole.
DO $check$
DECLARE
  lost int;
  unarchived int;
BEGIN
  SELECT count(*) INTO lost FROM (
    SELECT p."id", f.key, f.value, false AS measured FROM "Product" p, jsonb_each(CASE WHEN jsonb_typeof(p."facts") = 'object' THEN p."facts" ELSE '{}'::jsonb END) f
    UNION ALL
    SELECT p."id", m.key, m.value, true FROM "Product" p, jsonb_each(CASE WHEN jsonb_typeof(p."measurements") = 'object' THEN p."measurements" ELSE '{}'::jsonb END) m
  ) held
  WHERE NOT EXISTS (SELECT 1 FROM "ProductValue" v WHERE v."productId" = held."id" AND v."attributeKey" = held.key AND v."measured" = held.measured AND v."answer" = held.value);
  IF lost > 0 THEN RAISE EXCEPTION 'retire would lose % answers; nothing changed', lost; END IF;
  SELECT count(*) INTO unarchived FROM "Product" p
  WHERE (p."facts" IS NOT NULL OR p."measurements" IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM "ProductAnswersArchive" a WHERE a."productId" = p."id" AND a."facts" IS NOT DISTINCT FROM p."facts" AND a."measurements" IS NOT DISTINCT FROM p."measurements");
  IF unarchived > 0 THEN RAISE EXCEPTION 'archive missing % products; nothing changed', unarchived; END IF;
END
$check$;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "facts",
DROP COLUMN "measurements";
