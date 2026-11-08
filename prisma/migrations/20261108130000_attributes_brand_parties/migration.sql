-- listing-model/attributes unit 2 (D6-D8, Q11, Q14, Q15): brand parties and each brand's Amazon flag, parent Q26's new
-- questions, and a product's type following its category. One new table and two new columns; nothing dropped.
-- Products whose type differed from their category's take the category's (parent Q9); their answers stay.

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "amazonRegistered" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "BbTypeAttribute" ADD COLUMN     "fromType" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "BrandParty" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "pincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandParty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandParty_brandId_role_key" ON "BrandParty"("brandId", "role");

-- AddForeignKey
ALTER TABLE "BrandParty" ADD CONSTRAINT "BrandParty_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Each brand's Amazon flag and parties (D6, parent Q10) ───────────────────────────────────────────────
UPDATE "Brand" b SET "amazonRegistered" = NOT COALESCE(d."amazonGeneric", false) FROM "OrgListingDefaults" d WHERE d."orgId" = b."orgId";
-- Parties are not copied from the brand's two lines: until the brand page writes parties, the value sync
-- falls back to those lines, so an edit on today's brand page keeps reaching products (review of unit 2).

-- ── Parent Q26's new questions, their options, and the types that ask them (D8, Q15) ────────────────────
INSERT INTO "Attribute" ("key", "label", "kind", "unitFamily", "scope") VALUES
  ('style', 'Style', 'choice', NULL, 'product'),
  ('innerMaterial', 'Lining material', 'choice', NULL, 'product'),
  ('pocketCount', 'Pockets', 'number', NULL, 'product'),
  ('strapType', 'Strap type', 'choice', NULL, 'product'),
  ('fabricType', 'Fabric type', 'text', NULL, 'product'),
  ('sizeSystem', 'Size system', 'choice', NULL, 'product'),
  ('sizeClass', 'Size type', 'choice', NULL, 'product'),
  ('itemForm', 'Form', 'text', NULL, 'product'),
  ('unitCount', 'Units in the pack', 'number', NULL, 'product'),
  ('stoneClarity', 'Stone clarity', 'text', NULL, 'product'),
  ('stoneCut', 'Stone cut', 'text', NULL, 'product'),
  ('metalWeight', 'Metal weight', 'measure', 'weight', 'product'),
  ('genericName', 'Generic name', 'text', NULL, 'product'),
  ('modelName', 'Model name', 'text', NULL, 'product')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order") VALUES
  ('ao_' || md5('style:bohemian:'), 'style', 'bohemian', 'Bohemian', 0),
  ('ao_' || md5('style:contemporary:'), 'style', 'contemporary', 'Contemporary', 1),
  ('ao_' || md5('style:deconstructed:'), 'style', 'deconstructed', 'Deconstructed', 2),
  ('ao_' || md5('style:formal:'), 'style', 'formal', 'Formal', 3),
  ('ao_' || md5('style:minimal:'), 'style', 'minimal', 'Minimal', 4),
  ('ao_' || md5('style:retro:'), 'style', 'retro', 'Retro', 5),
  ('ao_' || md5('style:utility:'), 'style', 'utility', 'Utility', 6),
  ('ao_' || md5('style:western:'), 'style', 'western', 'Western', 7)
ON CONFLICT DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'style'), t."key", 'style', 200 + 0, false FROM "ProductType" t WHERE t."key" IN ('bag', 'travel-pouch')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order", "orgId", "productTypes", "retiredAt")
SELECT 'ao_' || md5('innerMaterial' || ':' || o."key" || ':' || COALESCE(o."orgId", '')), 'innerMaterial', o."key", o."label", o."order", o."orgId", o."productTypes", o."retiredAt"
FROM "AttributeOption" o WHERE o."attributeKey" = 'material'
ON CONFLICT DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'innerMaterial'), t."key", 'innerMaterial', 200 + 1, false FROM "ProductType" t WHERE t."key" IN ('bag', 'travel-pouch')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'pocketCount'), t."key", 'pocketCount', 200 + 2, false FROM "ProductType" t WHERE t."key" IN ('bag', 'travel-pouch')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order") VALUES
  ('ao_' || md5('strapType:adjustable:'), 'strapType', 'adjustable', 'Adjustable', 0),
  ('ao_' || md5('strapType:cross-body:'), 'strapType', 'cross-body', 'Cross-Body', 1),
  ('ao_' || md5('strapType:hand-carry:'), 'strapType', 'hand-carry', 'Hand-Carry', 2),
  ('ao_' || md5('strapType:shoulder:'), 'strapType', 'shoulder', 'Shoulder', 3),
  ('ao_' || md5('strapType:waist-strap:'), 'strapType', 'waist-strap', 'Waist Strap', 4)
ON CONFLICT DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'strapType'), t."key", 'strapType', 200 + 3, false FROM "ProductType" t WHERE t."key" IN ('bag')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'fabricType'), t."key", 'fabricType', 200 + 4, false FROM "ProductType" t WHERE t."key" IN ('islamic-wear', 'trousers', 'socks')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order") VALUES
  ('ao_' || md5('sizeSystem:in:'), 'sizeSystem', 'in', 'IN', 0),
  ('ao_' || md5('sizeSystem:uk:'), 'sizeSystem', 'uk', 'UK', 1),
  ('ao_' || md5('sizeSystem:us:'), 'sizeSystem', 'us', 'US', 2),
  ('ao_' || md5('sizeSystem:eu:'), 'sizeSystem', 'eu', 'EU', 3)
ON CONFLICT DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'sizeSystem'), t."key", 'sizeSystem', 200 + 5, false FROM "ProductType" t WHERE t."key" IN ('islamic-wear', 'trousers', 'socks')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order") VALUES
  ('ao_' || md5('sizeClass:alpha:'), 'sizeClass', 'alpha', 'Alpha', 0),
  ('ao_' || md5('sizeClass:numeric:'), 'sizeClass', 'numeric', 'Numeric', 1),
  ('ao_' || md5('sizeClass:free-size:'), 'sizeClass', 'free-size', 'Free Size', 2)
ON CONFLICT DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'sizeClass'), t."key", 'sizeClass', 200 + 6, false FROM "ProductType" t WHERE t."key" IN ('islamic-wear', 'trousers', 'socks')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'itemForm'), t."key", 'itemForm', 200 + 7, false FROM "ProductType" t WHERE t."key" IN ('fragrance')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'unitCount'), t."key", 'unitCount', 200 + 8, false FROM "ProductType" t WHERE t."key" IN ('fragrance')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'stoneClarity'), t."key", 'stoneClarity', 200 + 9, false FROM "ProductType" t WHERE t."key" IN ('jewellery')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'stoneCut'), t."key", 'stoneCut', 200 + 10, false FROM "ProductType" t WHERE t."key" IN ('jewellery')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'metalWeight'), t."key", 'metalWeight', 200 + 11, false FROM "ProductType" t WHERE t."key" IN ('jewellery')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'genericName'), t."key", 'genericName', 200 + 12, false FROM "ProductType" t
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'modelName'), t."key", 'modelName', 200 + 13, false FROM "ProductType" t
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'capacity'), t."key", 'capacity', 300 + 0, false FROM "ProductType" t WHERE t."key" IN ('bag', 'travel-pouch')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'packQuantity'), t."key", 'packQuantity', 300 + 1, false FROM "ProductType" t
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || 'care'), t."key", 'care', 300 + 2, false FROM "ProductType" t WHERE t."key" IN ('islamic-wear', 'trousers', 'socks')
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;

-- A type's own facts and measures rebuild only the rows they derive; a question added by migration stays (Q12).
CREATE OR REPLACE FUNCTION bb_type_attributes_sync(type_key text) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  DELETE FROM "BbTypeAttribute" WHERE "productTypeKey" = type_key AND "fromType";
  INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "labelOverride", "requiredForBb", "fromType")
  SELECT 'bta_' || md5(t."key" || ':' || f.fact), t."key", f.fact, f.n::int, t."factLabels" ->> f.fact, false, true
  FROM "ProductType" t CROSS JOIN LATERAL unnest(t."facts") WITH ORDINALITY AS f(fact, n)
  WHERE t."key" = type_key AND EXISTS (SELECT 1 FROM "Attribute" a WHERE a."key" = f.fact)
  ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
  INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "labelOverride", "requiredForBb", "fromType")
  SELECT 'bta_' || md5(t."key" || ':' || (m.e ->> 'key')), t."key", m.e ->> 'key', 100 + m.n::int, m.e ->> 'label', COALESCE((m.e ->> 'required') = 'true', false), true
  FROM "ProductType" t CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t."measures") = 'array' THEN t."measures" ELSE '[]'::jsonb END) WITH ORDINALITY AS m(e, n)
  WHERE t."key" = type_key AND EXISTS (SELECT 1 FROM "Attribute" a WHERE a."key" = m.e ->> 'key')
  ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
END
$fn$;

-- ── Brand parties fill manufacturer, packer and importer (D6, Q11) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION bb_sync_product_values(pid text) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  p RECORD;
  brand RECORD;
  defaults RECORD;
BEGIN
  -- Serialise with any save of this product and read its newest row (review: a brand edit racing a save).
  SELECT "id", "orgId", "facts", "measurements", "weight", "brandId", "productType" INTO p FROM "Product" WHERE "id" = pid FOR NO KEY UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT "id", "manufacturer", "packerOrImporter", "countryOfOrigin" INTO brand FROM "Brand"
    WHERE ("id" = p."brandId") OR (p."brandId" IS NULL AND "orgId" = p."orgId" AND "isDefault" AND "retiredAt" IS NULL)
    ORDER BY ("id" = p."brandId") DESC LIMIT 1;
  SELECT "countryOfOrigin" INTO defaults FROM "OrgListingDefaults" WHERE "orgId" = p."orgId";

  DELETE FROM "ProductValue" WHERE "productId" = pid;

  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "optionKey", "text", "number", "bool", "source", "updatedAt")
  SELECT 'pv_' || md5(pid || ':' || x.key), pid, x.key,
    CASE WHEN x.kind = 'choice' AND NOT x.unlisted THEN x.raw END,
    CASE WHEN (x.kind = 'choice' AND x.unlisted) OR x.kind = 'text'
           OR (x.kind = 'number' AND NOT x.numeric_ok) OR (x.kind = 'boolean' AND x.raw NOT IN ('true', 'false')) THEN x.raw END,
    CASE WHEN x.kind = 'number' AND x.numeric_ok THEN trim_scale(x.raw::numeric) END,
    CASE WHEN x.kind = 'boolean' AND x.raw IN ('true', 'false') THEN x.raw::boolean END,
    x.src, now()
  FROM (
    SELECT f.key, a."kind" AS kind, f.value ->> 'value' AS raw,
      COALESCE((f.value ->> 'unlisted') = 'true', false) AS unlisted,
      ((f.value ->> 'value') ~ '^-?[0-9]{1,30}(\.[0-9]{1,20})?$') AS numeric_ok,
      CASE WHEN (f.value ->> 'origin') = 'defaults' THEN 'shop' WHEN (f.value ->> 'origin') IN ('product', 'family', 'brand', 'marketplace') THEN (f.value ->> 'origin') ELSE 'product' END AS src
    FROM jsonb_each(CASE WHEN jsonb_typeof(p."facts") = 'object' THEN p."facts" ELSE '{}'::jsonb END) AS f(key, value)
    JOIN "Attribute" a ON a."key" = f.key AND a."scope" = 'product' AND a."kind" IN ('choice', 'text', 'number', 'boolean')
    WHERE jsonb_typeof(f.value) = 'object' AND COALESCE(f.value ->> 'value', '') <> ''
  ) x;

  -- A measure in the unit its type declares, stored canonical; with no declared unit, or too large, as text.
  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "number", "text", "unit", "source", "updatedAt")
  SELECT 'pv_' || md5(pid || ':' || m.key), pid, m.key,
    CASE WHEN u.factor IS NOT NULL AND m.numeric_ok THEN trim_scale(m.raw::numeric * u.factor) END,
    CASE WHEN u.factor IS NULL OR NOT m.numeric_ok THEN m.raw END,
    u.unit, m.src, now()
  FROM (
    SELECT e.key, e.value ->> 'value' AS raw, ((e.value ->> 'value') ~ '^-?[0-9]{1,20}(\.[0-9]{1,20})?$') AS numeric_ok,
      CASE WHEN (e.value ->> 'origin') = 'defaults' THEN 'shop' WHEN (e.value ->> 'origin') IN ('product', 'family', 'brand', 'marketplace') THEN (e.value ->> 'origin') ELSE 'product' END AS src
    FROM jsonb_each(CASE WHEN jsonb_typeof(p."measurements") = 'object' THEN p."measurements" ELSE '{}'::jsonb END) AS e(key, value)
    JOIN "Attribute" a ON a."key" = e.key AND a."kind" = 'measure' AND a."key" <> 'weight'
    WHERE jsonb_typeof(e.value) = 'object' AND COALESCE(e.value ->> 'value', '') <> ''
  ) m
  LEFT JOIN LATERAL (
    SELECT d ->> 'unit' AS unit, CASE d ->> 'unit' WHEN 'in' THEN 25.4 WHEN 'cm' THEN 10 WHEN 'mm' THEN 1 WHEN 'ml' THEN 1 WHEN 'g' THEN 1 END AS factor
    FROM "ProductType" t, jsonb_array_elements(CASE WHEN jsonb_typeof(t."measures") = 'array' THEN t."measures" ELSE '[]'::jsonb END) d
    WHERE t."key" = p."productType" AND d ->> 'key' = m.key LIMIT 1
  ) u ON true;

  IF p."weight" IS NOT NULL THEN
    INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "number", "text", "unit", "source", "updatedAt")
    VALUES ('pv_' || md5(pid || ':weight'), pid, 'weight',
      CASE WHEN p."weight" BETWEEN 0 AND 1e15 THEN trim_scale(round(p."weight"::numeric * 1000, 3)) END,
      CASE WHEN NOT (p."weight" BETWEEN 0 AND 1e15) THEN p."weight"::text END,
      'kg', 'product', now());
  END IF;

  IF brand."id" IS NOT NULL THEN
    INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "refId", "source", "sourceId", "updatedAt")
    VALUES ('pv_' || md5(pid || ':brand'), pid, 'brand', brand."id", CASE WHEN p."brandId" IS NULL THEN 'shop' ELSE 'product' END, brand."id", now());
  END IF;
  -- Maker, packer and importer from the brand's parties, else its two lines; importer only from its own party
  -- (attributes Q11), so a domestic brand's packer is never recorded as an importer.
  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "text", "source", "sourceId", "updatedAt")
  SELECT 'pv_' || md5(pid || ':' || x.key), pid, x.key, x.v, x.src, x.sid, now()
  FROM (VALUES
    ('countryOfOrigin', COALESCE(brand."countryOfOrigin", defaults."countryOfOrigin"), CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN 'brand' ELSE 'shop' END, CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN brand."id" END),
    ('manufacturer', COALESCE((SELECT NULLIF(concat_ws(', ', NULLIF(bp."name", ''), NULLIF(bp."address", ''), NULLIF(bp."pincode", '')), '') FROM "BrandParty" bp WHERE bp."brandId" = brand."id" AND bp."role" = 'maker'), brand."manufacturer"), 'brand', brand."id"),
    ('packer', COALESCE((SELECT NULLIF(concat_ws(', ', NULLIF(bp."name", ''), NULLIF(bp."address", ''), NULLIF(bp."pincode", '')), '') FROM "BrandParty" bp WHERE bp."brandId" = brand."id" AND bp."role" = 'packer'), brand."packerOrImporter"), 'brand', brand."id"),
    ('importer', COALESCE((SELECT NULLIF(concat_ws(', ', NULLIF(bp."name", ''), NULLIF(bp."address", ''), NULLIF(bp."pincode", '')), '') FROM "BrandParty" bp WHERE bp."brandId" = brand."id" AND bp."role" = 'importer'), NULL), 'brand', brand."id")
  ) AS x(key, v, src, sid)
  WHERE COALESCE(x.v, '') <> ''
  ON CONFLICT ("productId", "attributeKey") DO NOTHING;

  INSERT INTO "ProductValueSet" ("productId", "values", "updatedAt")
  SELECT pid, COALESCE(jsonb_object_agg(v."attributeKey", jsonb_strip_nulls(jsonb_build_object(
    'v', COALESCE(to_jsonb(v."optionKey"), to_jsonb(v."text"), to_jsonb(trim_scale(v."number")), to_jsonb(v."bool"), to_jsonb(v."refId")),
    'unit', v."unit", 'src', v."source"))), '{}'::jsonb), now()
  FROM "ProductValue" v WHERE v."productId" = pid
  ON CONFLICT ("productId") DO UPDATE SET "values" = EXCLUDED."values", "updatedAt" = now();
END
$fn$;


CREATE OR REPLACE FUNCTION bb_product_values_on_brand_party() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  b text := COALESCE(NEW."brandId", OLD."brandId");
BEGIN
  PERFORM bb_sync_product_values(p."id") FROM "Product" p JOIN "Brand" br ON br."id" = b
  WHERE p."brandId" = b OR (p."brandId" IS NULL AND p."orgId" = br."orgId" AND br."isDefault");
  RETURN NULL;
END
$fn$;
CREATE TRIGGER "BrandParty_values_sync" AFTER INSERT OR UPDATE OR DELETE ON "BrandParty"
  FOR EACH ROW EXECUTE FUNCTION bb_product_values_on_brand_party();

-- Until the brand page asks it (dynamic-form), the shop's "list as Generic" switch still sets every brand (Q16).
CREATE OR REPLACE FUNCTION bb_brands_follow_generic() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE "Brand" SET "amazonRegistered" = NOT NEW."amazonGeneric" WHERE "orgId" = NEW."orgId";
  RETURN NULL;
END
$fn$;
CREATE TRIGGER "OrgListingDefaults_generic_to_brands" AFTER INSERT OR UPDATE OF "amazonGeneric" ON "OrgListingDefaults"
  FOR EACH ROW WHEN (NEW."amazonGeneric" IS NOT NULL) EXECUTE FUNCTION bb_brands_follow_generic();

-- ── A product's type follows its category (D7, parent Q9, Q14) ─────────────────────────────────────────
-- Set on every save from the category, and moved with it when a category changes type; the product keeps
-- its answers, and the value trigger re-derives it.
-- A category's type is its own, else the nearest ancestor's, as the category tree reads it (categories D1b).
CREATE OR REPLACE FUNCTION bb_category_type(cid text) RETURNS text LANGUAGE sql STABLE AS $fn$
  WITH RECURSIVE up AS (
    SELECT c."id", c."parentId", c."productType", 0 AS depth FROM "Category" c WHERE c."id" = cid
    UNION ALL
    SELECT c."id", c."parentId", c."productType", up.depth + 1 FROM "Category" c JOIN up ON c."id" = up."parentId"
    WHERE up."productType" IS NULL AND up.depth < 20
  )
  SELECT "productType" FROM up WHERE "productType" IS NOT NULL ORDER BY depth LIMIT 1
$fn$;

CREATE OR REPLACE FUNCTION bb_product_type_from_category() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  t text := bb_category_type(NEW."categoryId");
BEGIN
  IF t IS NOT NULL THEN NEW."productType" := t; END IF;
  -- A kind the new type does not hold is cleared, as a marketplace's type answer does (marketplace-facts Q25).
  IF NEW."kind" IS NOT NULL AND NEW."productType" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ProductType" pt, jsonb_array_elements(CASE WHEN jsonb_typeof(pt."kinds") = 'array' THEN pt."kinds" ELSE '[]'::jsonb END) k
    WHERE pt."key" = NEW."productType" AND k ->> 'key' = NEW."kind") THEN
    NEW."kind" := NULL;
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER "Product_type_follows_category" BEFORE INSERT OR UPDATE OF "categoryId", "productType" ON "Product"
  FOR EACH ROW EXECUTE FUNCTION bb_product_type_from_category();

-- A category's type or place moving re-types every product beneath it that reads its type through it.
CREATE OR REPLACE FUNCTION bb_products_follow_category() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  beneath text[];
BEGIN
  WITH RECURSIVE down AS (
    SELECT NEW."id" AS id, 0 AS depth
    UNION ALL
    SELECT c."id", down.depth + 1 FROM "Category" c JOIN down ON c."parentId" = down.id WHERE down.depth < 20
  )
  SELECT array_agg(id) INTO beneath FROM down;
  UPDATE "Product" p SET "productType" = bb_category_type(p."categoryId")
  WHERE p."categoryId" = ANY(beneath) AND bb_category_type(p."categoryId") IS NOT NULL
    AND p."productType" IS DISTINCT FROM bb_category_type(p."categoryId");
  -- A family whose members now all share one type takes it, so it still accepts them (Q17).
  UPDATE "ProductFamily" f SET "productType" = m.t
  FROM (SELECT "familyId", min("productType") AS t FROM "Product" WHERE "familyId" IN (
          SELECT DISTINCT p."familyId" FROM "Product" p WHERE p."familyId" IS NOT NULL AND p."categoryId" = ANY(beneath))
        GROUP BY "familyId" HAVING count(DISTINCT "productType") = 1) m
  WHERE f."id" = m."familyId" AND f."productType" IS DISTINCT FROM m.t;
  RETURN NULL;
END
$fn$;
CREATE TRIGGER "Category_type_moves_products" AFTER UPDATE OF "productType", "parentId" ON "Category"
  FOR EACH ROW WHEN (OLD."productType" IS DISTINCT FROM NEW."productType" OR OLD."parentId" IS DISTINCT FROM NEW."parentId")
  EXECUTE FUNCTION bb_products_follow_category();

-- ── The move: types aligned to their categories, every product re-derived with its brand's parties ──────
UPDATE "Product" p SET "productType" = bb_category_type(p."categoryId")
WHERE bb_category_type(p."categoryId") IS NOT NULL AND p."productType" IS DISTINCT FROM bb_category_type(p."categoryId");
SELECT bb_sync_product_values("id") FROM "Product";
