-- listing-model/dynamic-form unit 3b (owner, Q16): a product's answers live in ProductValue, kept verbatim, written by
-- product-value.repository in each write's transaction; the sync triggers are dropped. Product.facts and
-- measurements are not dropped: they stay as the frozen pre-switch copy until retire-old-paths, behind the
-- backup and the compare gate. The migration fails, changing nothing, if any answer would be lost.
-- DropIndex
DROP INDEX "ProductValue_productId_attributeKey_key";

-- AlterTable
ALTER TABLE "ProductValue" ADD COLUMN     "answer" JSONB,
ADD COLUMN     "measured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "ProductValue_productId_attributeKey_measured_key" ON "ProductValue"("productId", "attributeKey", "measured");


-- ── The sync triggers go: from here product-value.repository writes values in each write's transaction ────
DROP TRIGGER IF EXISTS "Product_values_sync" ON "Product";
DROP TRIGGER IF EXISTS "Brand_values_sync" ON "Brand";
DROP TRIGGER IF EXISTS "Brand_values_insert" ON "Brand";
DROP TRIGGER IF EXISTS "BrandParty_values_sync" ON "BrandParty";
DROP TRIGGER IF EXISTS "OrgListingDefaults_values_sync" ON "OrgListingDefaults";
DROP TRIGGER IF EXISTS "OrgListingDefaults_values_insert" ON "OrgListingDefaults";
DROP FUNCTION IF EXISTS bb_product_values_on_product(), bb_product_values_on_brand(), bb_product_values_on_brand_party(), bb_product_values_on_defaults();
-- A type's measure unit moving no longer re-derives its products' rows here: the type save asks (Q16).
CREATE OR REPLACE FUNCTION bb_type_attributes_on_type() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM bb_type_attributes_sync(NEW."key");
  RETURN NULL;
END
$fn$;
DROP FUNCTION IF EXISTS bb_sync_product_values(text);

-- A product's answers replaced by what it holds now, each kept verbatim beside its typed columns (Q16).
CREATE OR REPLACE FUNCTION bb_write_answers(pid text, facts jsonb, measurements jsonb, weight double precision) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  ptype text;
BEGIN
  SELECT "productType" INTO ptype FROM "Product" WHERE "id" = pid FOR NO KEY UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  -- Every row replaced: the product's own here, the derived (brand, inherited) by bb_write_inherited below, so
  -- no row of one kind can block another's insert (review B1).
  DELETE FROM "ProductValue" WHERE "productId" = pid;

  -- Every fact, verbatim; typed where the dictionary knows its kind, else kept as text (R7).
  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "optionKey", "text", "number", "bool", "source", "answer", "measured", "updatedAt")
  SELECT 'pv_' || md5(pid || ':f:' || x.key), pid, x.key,
    CASE WHEN x.kind = 'choice' AND NOT x.unlisted AND x.raw IS NOT NULL THEN x.raw END,
    CASE WHEN x.raw IS NULL THEN x.value::text
         WHEN x.kind IS NULL OR (x.kind = 'choice' AND x.unlisted) OR x.kind IN ('text', 'measure', 'reference')
           OR (x.kind = 'number' AND NOT x.numeric_ok) OR (x.kind = 'boolean' AND x.raw NOT IN ('true', 'false')) THEN x.raw END,
    CASE WHEN x.kind = 'number' AND x.numeric_ok THEN trim_scale(x.raw::numeric) END,
    CASE WHEN x.kind = 'boolean' AND x.raw IN ('true', 'false') THEN x.raw::boolean END,
    x.src, x.value, false, now()
  FROM (
    SELECT f.key, f.value, a."kind" AS kind,
      CASE WHEN jsonb_typeof(f.value) = 'object' THEN NULLIF(f.value ->> 'value', '') END AS raw,
      COALESCE((f.value ->> 'unlisted') = 'true', false) AS unlisted,
      COALESCE((f.value ->> 'value') ~ '^-?[0-9]{1,30}(\.[0-9]{1,20})?$', false) AS numeric_ok,
      CASE WHEN (f.value ->> 'origin') = 'defaults' THEN 'shop' WHEN (f.value ->> 'origin') IN ('product', 'family', 'brand', 'marketplace') THEN (f.value ->> 'origin') ELSE 'product' END AS src
    FROM jsonb_each(CASE WHEN jsonb_typeof(facts) = 'object' THEN facts ELSE '{}'::jsonb END) AS f(key, value)
    LEFT JOIN "Attribute" a ON a."key" = f.key
  ) x;

  -- Every measurement, verbatim; canonical in the unit its type declares, else kept as text.
  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "number", "text", "unit", "source", "answer", "measured", "updatedAt")
  SELECT 'pv_' || md5(pid || ':m:' || m.key), pid, m.key,
    CASE WHEN u.factor IS NOT NULL AND m.numeric_ok THEN trim_scale(m.raw::numeric * u.factor) END,
    CASE WHEN u.factor IS NULL OR NOT m.numeric_ok THEN COALESCE(m.raw, m.value::text) END,
    u.unit, m.src, m.value, true, now()
  FROM (
    SELECT e.key, e.value,
      CASE WHEN jsonb_typeof(e.value) = 'object' THEN NULLIF(e.value ->> 'value', '') END AS raw,
      COALESCE((e.value ->> 'value') ~ '^-?[0-9]{1,20}(\.[0-9]{1,20})?$', false) AS numeric_ok,
      CASE WHEN (e.value ->> 'origin') = 'defaults' THEN 'shop' WHEN (e.value ->> 'origin') IN ('product', 'family', 'brand', 'marketplace') THEN (e.value ->> 'origin') ELSE 'product' END AS src
    FROM jsonb_each(CASE WHEN jsonb_typeof(measurements) = 'object' THEN measurements ELSE '{}'::jsonb END) AS e(key, value)
  ) m
  LEFT JOIN LATERAL (
    SELECT d ->> 'unit' AS unit, CASE d ->> 'unit' WHEN 'in' THEN 25.4 WHEN 'cm' THEN 10 WHEN 'mm' THEN 1 WHEN 'ml' THEN 1 WHEN 'g' THEN 1 END AS factor
    FROM "ProductType" t, jsonb_array_elements(CASE WHEN jsonb_typeof(t."measures") = 'array' THEN t."measures" ELSE '[]'::jsonb END) d
    WHERE t."key" = ptype AND d ->> 'key' = m.key LIMIT 1
  ) u ON true;

  IF weight IS NOT NULL THEN
    INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "number", "text", "unit", "source", "updatedAt")
    VALUES ('pv_' || md5(pid || ':w'), pid, 'weight',
      CASE WHEN weight BETWEEN 0 AND 1e15 THEN trim_scale(round(weight::numeric * 1000, 3)) END,
      CASE WHEN NOT (weight BETWEEN 0 AND 1e15) THEN weight::text END, 'kg', 'product', now())
    ON CONFLICT ("productId", "attributeKey", "measured") DO NOTHING;
  END IF;
  PERFORM bb_write_inherited(pid);
END
$fn$;

-- A product's typed rows derived again from the answers it already holds, after its type or its type's
-- units move (review S1): the verbatim answers are the input, so nothing is lost.
CREATE OR REPLACE FUNCTION bb_rederive_answers(pid text) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM bb_write_answers(pid,
    (SELECT COALESCE(jsonb_object_agg("attributeKey", "answer"), '{}'::jsonb) FROM "ProductValue" WHERE "productId" = pid AND NOT "measured" AND "answer" IS NOT NULL),
    (SELECT COALESCE(jsonb_object_agg("attributeKey", "answer"), '{}'::jsonb) FROM "ProductValue" WHERE "productId" = pid AND "measured" AND "answer" IS NOT NULL),
    (SELECT "weight" FROM "Product" WHERE "id" = pid));
END
$fn$;

-- What the brand and the shop fill for a product: brand, country, maker, packer, importer, never over the
-- product's own answer to one (A4), then its read copy (Q8).
CREATE OR REPLACE FUNCTION bb_write_inherited(pid text) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  p RECORD;
  brand RECORD;
  defaults RECORD;
BEGIN
  SELECT "id", "orgId", "brandId" INTO p FROM "Product" WHERE "id" = pid FOR NO KEY UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT "id", "manufacturer", "packerOrImporter", "countryOfOrigin" INTO brand FROM "Brand"
    WHERE ("id" = p."brandId") OR (p."brandId" IS NULL AND "orgId" = p."orgId" AND "isDefault" AND "retiredAt" IS NULL)
    ORDER BY ("id" = p."brandId") DESC LIMIT 1;
  SELECT "countryOfOrigin" INTO defaults FROM "OrgListingDefaults" WHERE "orgId" = p."orgId";

  -- Derived rows only: no verbatim answer, not weight. A product's own answer to an inherited key stays (A4).
  DELETE FROM "ProductValue" WHERE "productId" = pid AND "answer" IS NULL AND "attributeKey" <> 'weight';
  IF brand."id" IS NOT NULL THEN
    INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "refId", "source", "sourceId", "updatedAt")
    VALUES ('pv_' || md5(pid || ':i:brand'), pid, 'brand', brand."id", CASE WHEN p."brandId" IS NULL THEN 'shop' ELSE 'product' END, brand."id", now())
    ON CONFLICT ("productId", "attributeKey", "measured") DO NOTHING;
  END IF;
  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "text", "source", "sourceId", "updatedAt")
  SELECT 'pv_' || md5(pid || ':i:' || x.key), pid, x.key, x.v, x.src, x.sid, now()
  FROM (VALUES
    ('countryOfOrigin', COALESCE(brand."countryOfOrigin", defaults."countryOfOrigin"), CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN 'brand' ELSE 'shop' END, CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN brand."id" END),
    ('manufacturer', COALESCE((SELECT NULLIF(concat_ws(', ', NULLIF(bp."name", ''), NULLIF(bp."address", ''), NULLIF(bp."pincode", '')), '') FROM "BrandParty" bp WHERE bp."brandId" = brand."id" AND bp."role" = 'maker'), brand."manufacturer"), 'brand', brand."id"),
    ('packer', COALESCE((SELECT NULLIF(concat_ws(', ', NULLIF(bp."name", ''), NULLIF(bp."address", ''), NULLIF(bp."pincode", '')), '') FROM "BrandParty" bp WHERE bp."brandId" = brand."id" AND bp."role" = 'packer'), brand."packerOrImporter"), 'brand', brand."id"),
    ('importer', COALESCE((SELECT NULLIF(concat_ws(', ', NULLIF(bp."name", ''), NULLIF(bp."address", ''), NULLIF(bp."pincode", '')), '') FROM "BrandParty" bp WHERE bp."brandId" = brand."id" AND bp."role" = 'importer'), NULL), 'brand', brand."id")
  ) AS x(key, v, src, sid)
  WHERE COALESCE(x.v, '') <> ''
    AND NOT EXISTS (SELECT 1 FROM "ProductValue" own WHERE own."productId" = pid AND own."attributeKey" = x.key AND NOT own."measured")
  ON CONFLICT ("productId", "attributeKey", "measured") DO NOTHING;

  INSERT INTO "ProductValueSet" ("productId", "values", "updatedAt")
  SELECT pid, COALESCE(jsonb_object_agg(v."attributeKey", jsonb_strip_nulls(jsonb_build_object(
    'v', COALESCE(to_jsonb(v."optionKey"), to_jsonb(v."text"), to_jsonb(trim_scale(v."number")), to_jsonb(v."bool"), to_jsonb(v."refId")),
    'unit', v."unit", 'src', v."source"))) FILTER (WHERE NOT v."measured" OR NOT EXISTS (
      SELECT 1 FROM "ProductValue" w WHERE w."productId" = pid AND w."attributeKey" = v."attributeKey" AND NOT w."measured")), '{}'::jsonb), now()
  FROM "ProductValue" v WHERE v."productId" = pid
  ON CONFLICT ("productId") DO UPDATE SET "values" = EXCLUDED."values", "updatedAt" = now();
END
$fn$;

-- ── Every product moves: its facts and measurements, verbatim ──────────────────────────────────────────
DELETE FROM "ProductValue";
SELECT bb_write_answers(p."id", p."facts", p."measurements", p."weight") FROM "Product" p;

-- Nothing lost: every key each product held is a row holding exactly that answer, or the migration fails.
DO $check$
DECLARE
  lost int;
BEGIN
  SELECT count(*) INTO lost FROM (
    SELECT p."id", f.key, f.value, false AS measured FROM "Product" p, jsonb_each(CASE WHEN jsonb_typeof(p."facts") = 'object' THEN p."facts" ELSE '{}'::jsonb END) f
    UNION ALL
    SELECT p."id", m.key, m.value, true FROM "Product" p, jsonb_each(CASE WHEN jsonb_typeof(p."measurements") = 'object' THEN p."measurements" ELSE '{}'::jsonb END) m
  ) held
  WHERE NOT EXISTS (SELECT 1 FROM "ProductValue" v WHERE v."productId" = held."id" AND v."attributeKey" = held.key AND v."measured" = held.measured AND v."answer" = held.value);
  IF lost > 0 THEN RAISE EXCEPTION 'switch would lose % answers; nothing changed', lost; END IF;
END
$check$;
