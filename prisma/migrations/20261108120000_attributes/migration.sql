-- listing-model/attributes unit 1 (D1-D3, Q7-Q10): the attribute dictionary, typed product values and their read
-- copy, kept in step with today's answers by a trigger until dynamic-form. Five new tables; nothing existing
-- changes or is dropped.

-- CreateTable
CREATE TABLE "Attribute" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "unitFamily" TEXT,
    "multi" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT NOT NULL DEFAULT 'product',
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AttributeOption" (
    "id" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "orgId" TEXT,
    "productTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BbTypeAttribute" (
    "id" TEXT NOT NULL,
    "productTypeKey" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "group" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "labelOverride" TEXT,
    "requiredForBb" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BbTypeAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductValue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "optionKey" TEXT,
    "text" TEXT,
    "number" DECIMAL(65,30),
    "unit" TEXT,
    "bool" BOOLEAN,
    "refId" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductValueSet" (
    "productId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductValueSet_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "AttributeOption_attributeKey_idx" ON "AttributeOption"("attributeKey");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeOption_attributeKey_key_orgId_key" ON "AttributeOption"("attributeKey", "key", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "BbTypeAttribute_productTypeKey_attributeKey_key" ON "BbTypeAttribute"("productTypeKey", "attributeKey");

-- CreateIndex
CREATE INDEX "ProductValue_attributeKey_optionKey_idx" ON "ProductValue"("attributeKey", "optionKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductValue_productId_attributeKey_key" ON "ProductValue"("productId", "attributeKey");

-- AddForeignKey
ALTER TABLE "AttributeOption" ADD CONSTRAINT "AttributeOption_attributeKey_fkey" FOREIGN KEY ("attributeKey") REFERENCES "Attribute"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductValue" ADD CONSTRAINT "ProductValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductValueSet" ADD CONSTRAINT "ProductValueSet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Reference data (CLAUDE.md invariant 7): the dictionary, its options, each type's questions ──────────
ALTER TABLE "ProductValue" ADD CONSTRAINT "ProductValue_one_value" CHECK (num_nonnulls("optionKey", "text", "number", "bool", "refId") = 1);
CREATE UNIQUE INDEX "AttributeOption_attribute_key_platform_key" ON "AttributeOption" ("attributeKey", "key") WHERE "orgId" IS NULL;

INSERT INTO "Attribute" ("key", "label", "kind", "unitFamily", "scope") VALUES
  ('colour', 'Colour', 'choice', NULL, 'product'),
  ('pattern', 'Pattern', 'choice', NULL, 'product'),
  ('material', 'Material', 'choice', NULL, 'product'),
  ('packQuantity', 'Pack of', 'number', NULL, 'product'),
  ('audience', 'Ideal for', 'choice', NULL, 'product'),
  ('occasion', 'Occasion', 'choice', NULL, 'product'),
  ('sleeveLength', 'Sleeve length', 'choice', NULL, 'product'),
  ('sleeveStyling', 'Sleeve styling', 'choice', NULL, 'product'),
  ('stitchType', 'Stitch', 'choice', NULL, 'product'),
  ('fit', 'Fit', 'choice', NULL, 'product'),
  ('waistRise', 'Waist rise', 'choice', NULL, 'product'),
  ('waistClosure', 'Waist closure', 'choice', NULL, 'product'),
  ('surfaceStyling', 'Surface styling', 'choice', NULL, 'product'),
  ('shape', 'Shape', 'choice', NULL, 'product'),
  ('care', 'Care', 'choice', NULL, 'product'),
  ('closure', 'Closure', 'choice', NULL, 'product'),
  ('compartments', 'Compartments', 'number', NULL, 'product'),
  ('waterResistant', 'Water resistant', 'boolean', NULL, 'product'),
  ('strap', 'Strap', 'choice', NULL, 'product'),
  ('strapPadding', 'Strap padding', 'choice', NULL, 'product'),
  ('scentFamily', 'Scent family', 'choice', NULL, 'product'),
  ('shelfLifeMonths', 'Shelf life', 'number', NULL, 'product'),
  ('plating', 'Plating', 'choice', NULL, 'product'),
  ('baseMaterial', 'Base metal', 'choice', NULL, 'product'),
  ('purity', 'Purity', 'choice', NULL, 'product'),
  ('certification', 'Certification', 'choice', NULL, 'product'),
  ('gemstone', 'Gemstone', 'choice', NULL, 'product'),
  ('contents', 'What is in the set', 'text', NULL, 'product'),
  ('length', 'Length', 'measure', 'length', 'product'),
  ('width', 'Width', 'measure', 'length', 'product'),
  ('height', 'Height', 'measure', 'length', 'product'),
  ('bust', 'Bust', 'measure', 'length', 'product'),
  ('waist', 'Waist', 'measure', 'length', 'product'),
  ('hip', 'Hip', 'measure', 'length', 'product'),
  ('shoulder', 'Shoulder', 'measure', 'length', 'product'),
  ('sleeve', 'Sleeve', 'measure', 'length', 'product'),
  ('diameter', 'Diameter', 'measure', 'length', 'product'),
  ('capacity', 'Capacity', 'measure', 'volume', 'product'),
  ('weight', 'Weight', 'measure', 'weight', 'product'),
  ('brand', 'Brand', 'reference', NULL, 'product'),
  ('countryOfOrigin', 'Country of origin', 'text', NULL, 'brand'),
  ('manufacturer', 'Manufacturer', 'text', NULL, 'brand'),
  ('packer', 'Packer', 'text', NULL, 'brand'),
  ('importer', 'Importer', 'text', NULL, 'brand')
ON CONFLICT ("key") DO NOTHING;

-- Every list value becomes an option of each fact drawing on that list, shops' own values included (Q10).
INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order", "orgId", "productTypes", "retiredAt")
SELECT 'ao_' || md5(l.fact || ':' || v."key" || ':' || COALESCE(v."orgId", '')), l.fact, v."key", v."label", v."order", v."orgId", v."productTypes", v."retiredAt"
FROM (VALUES ('colour', 'colour'), ('pattern', 'pattern'), ('material', 'material'), ('audience', 'audience'), ('occasion', 'occasion'), ('sleeveLength', 'sleeveLength'), ('sleeveStyling', 'sleeveStyling'), ('stitchType', 'stitchType'), ('fit', 'fit'), ('waistRise', 'waistRise'), ('waistClosure', 'waistClosure'), ('surfaceStyling', 'surfaceStyling'), ('shape', 'shape'), ('care', 'care'), ('closure', 'closure'), ('strap', 'strap'), ('strapPadding', 'strapPadding'), ('scentFamily', 'scentFamily'), ('plating', 'plating'), ('baseMaterial', 'baseMaterial'), ('purity', 'purity'), ('certification', 'certification'), ('gemstone', 'gemstone')) AS l(fact, list)
JOIN "ListingValue" v ON v."list" = l.list
ON CONFLICT DO NOTHING;

-- Each type's questions are built by bb_type_attributes_sync below, which also keeps them in step (Q12).

-- ── Keeping value rows in step with today's answers until dynamic-form switches the writes (Q7) ────────
-- A product's rows re-derived from its facts, measurements, weight, brand and shop settings, in one call.
-- It never raises on a stored shape: a value that does not fit its kind, overflows, or has no declared unit
-- is kept as text (R7); a key the brand or the shop fills is never read from facts.
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
  -- Packer comes from the brand's one packer-or-importer line; importer waits for the brand's own parties
  -- (attributes Q11, unit 2), so a domestic brand's packer is never recorded as an importer.
  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "text", "source", "sourceId", "updatedAt")
  SELECT 'pv_' || md5(pid || ':' || x.key), pid, x.key, x.v, x.src, x.sid, now()
  FROM (VALUES
    ('countryOfOrigin', COALESCE(brand."countryOfOrigin", defaults."countryOfOrigin"), CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN 'brand' ELSE 'shop' END, CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN brand."id" END),
    ('manufacturer', brand."manufacturer", 'brand', brand."id"),
    ('packer', brand."packerOrImporter", 'brand', brand."id")
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

CREATE OR REPLACE FUNCTION bb_product_values_on_product() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM bb_sync_product_values(NEW."id");
  RETURN NULL;
END
$fn$;
CREATE TRIGGER "Product_values_sync" AFTER INSERT OR UPDATE OF "facts", "measurements", "weight", "brandId", "productType", "orgId" ON "Product"
  FOR EACH ROW EXECUTE FUNCTION bb_product_values_on_product();

-- A brand edit re-derives the products it fills, and the shop's brandless ones when it is the default (Q9).
CREATE OR REPLACE FUNCTION bb_product_values_on_brand() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  was_default boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN was_default := OLD."isDefault"; END IF;
  PERFORM bb_sync_product_values(p."id") FROM "Product" p
  WHERE p."brandId" = NEW."id" OR (p."brandId" IS NULL AND p."orgId" = NEW."orgId" AND (NEW."isDefault" OR was_default));
  RETURN NULL;
END
$fn$;
CREATE TRIGGER "Brand_values_insert" AFTER INSERT ON "Brand"
  FOR EACH ROW WHEN (NEW."isDefault") EXECUTE FUNCTION bb_product_values_on_brand();
CREATE TRIGGER "Brand_values_sync" AFTER UPDATE OF "manufacturer", "packerOrImporter", "countryOfOrigin", "isDefault", "retiredAt" ON "Brand"
  FOR EACH ROW WHEN (OLD."manufacturer" IS DISTINCT FROM NEW."manufacturer" OR OLD."packerOrImporter" IS DISTINCT FROM NEW."packerOrImporter"
    OR OLD."countryOfOrigin" IS DISTINCT FROM NEW."countryOfOrigin" OR OLD."isDefault" IS DISTINCT FROM NEW."isDefault" OR OLD."retiredAt" IS DISTINCT FROM NEW."retiredAt")
  EXECUTE FUNCTION bb_product_values_on_brand();

CREATE OR REPLACE FUNCTION bb_product_values_on_defaults() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM bb_sync_product_values(p."id") FROM "Product" p WHERE p."orgId" = NEW."orgId";
  RETURN NULL;
END
$fn$;
CREATE TRIGGER "OrgListingDefaults_values_insert" AFTER INSERT ON "OrgListingDefaults"
  FOR EACH ROW EXECUTE FUNCTION bb_product_values_on_defaults();
CREATE TRIGGER "OrgListingDefaults_values_sync" AFTER UPDATE OF "countryOfOrigin" ON "OrgListingDefaults"
  FOR EACH ROW WHEN (OLD."countryOfOrigin" IS DISTINCT FROM NEW."countryOfOrigin") EXECUTE FUNCTION bb_product_values_on_defaults();

-- A list value added or changed later reaches the options of every fact drawing on that list (Q10, Q12).
CREATE OR REPLACE FUNCTION bb_attribute_options_on_listing_value() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order", "orgId", "productTypes", "retiredAt")
  SELECT 'ao_' || md5(l.fact || ':' || NEW."key" || ':' || COALESCE(NEW."orgId", '')), l.fact, NEW."key", NEW."label", NEW."order", NEW."orgId", NEW."productTypes", NEW."retiredAt"
  FROM (VALUES ('colour', 'colour'), ('pattern', 'pattern'), ('material', 'material'), ('audience', 'audience'), ('occasion', 'occasion'), ('sleeveLength', 'sleeveLength'), ('sleeveStyling', 'sleeveStyling'), ('stitchType', 'stitchType'), ('fit', 'fit'), ('waistRise', 'waistRise'), ('waistClosure', 'waistClosure'), ('surfaceStyling', 'surfaceStyling'), ('shape', 'shape'), ('care', 'care'), ('closure', 'closure'), ('strap', 'strap'), ('strapPadding', 'strapPadding'), ('scentFamily', 'scentFamily'), ('plating', 'plating'), ('baseMaterial', 'baseMaterial'), ('purity', 'purity'), ('certification', 'certification'), ('gemstone', 'gemstone')) AS l(fact, list)
  WHERE l.list = NEW."list" AND EXISTS (SELECT 1 FROM "Attribute" a WHERE a."key" = l.fact)
  ON CONFLICT ("id") DO UPDATE SET "label" = EXCLUDED."label", "order" = EXCLUDED."order", "productTypes" = EXCLUDED."productTypes", "retiredAt" = EXCLUDED."retiredAt";
  RETURN NULL;
END
$fn$;
CREATE TRIGGER "ListingValue_options_sync" AFTER INSERT OR UPDATE ON "ListingValue"
  FOR EACH ROW EXECUTE FUNCTION bb_attribute_options_on_listing_value();

-- A type's questions rebuilt when it is made or edited; its products re-derived when a measure's unit moves (Q12).
CREATE OR REPLACE FUNCTION bb_type_attributes_sync(type_key text) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  DELETE FROM "BbTypeAttribute" WHERE "productTypeKey" = type_key;
  INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "labelOverride", "requiredForBb")
  SELECT 'bta_' || md5(t."key" || ':' || f.fact), t."key", f.fact, f.n::int, t."factLabels" ->> f.fact, false
  FROM "ProductType" t CROSS JOIN LATERAL unnest(t."facts") WITH ORDINALITY AS f(fact, n)
  WHERE t."key" = type_key AND EXISTS (SELECT 1 FROM "Attribute" a WHERE a."key" = f.fact)
  ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
  INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "labelOverride", "requiredForBb")
  SELECT 'bta_' || md5(t."key" || ':' || (m.e ->> 'key')), t."key", m.e ->> 'key', 100 + m.n::int, m.e ->> 'label', COALESCE((m.e ->> 'required') = 'true', false)
  FROM "ProductType" t CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t."measures") = 'array' THEN t."measures" ELSE '[]'::jsonb END) WITH ORDINALITY AS m(e, n)
  WHERE t."key" = type_key AND EXISTS (SELECT 1 FROM "Attribute" a WHERE a."key" = m.e ->> 'key')
  ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;
END
$fn$;
CREATE OR REPLACE FUNCTION bb_type_attributes_on_type() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM bb_type_attributes_sync(NEW."key");
  IF TG_OP = 'UPDATE' AND OLD."measures" IS DISTINCT FROM NEW."measures" THEN
    PERFORM bb_sync_product_values(p."id") FROM "Product" p WHERE p."productType" = NEW."key";
  END IF;
  RETURN NULL;
END
$fn$;
CREATE TRIGGER "ProductType_attributes_sync" AFTER INSERT OR UPDATE OF "facts", "measures", "factLabels" ON "ProductType"
  FOR EACH ROW EXECUTE FUNCTION bb_type_attributes_on_type();
SELECT bb_type_attributes_sync("key") FROM "ProductType";

-- ── The move (R7): every product's answers as value rows now; the compare script checks them (D9) ──────
SELECT bb_sync_product_values("id") FROM "Product";
