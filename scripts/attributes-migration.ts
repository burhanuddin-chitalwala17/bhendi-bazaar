// Writes the reference data and the trigger of listing-model/attributes unit 1: the attribute dictionary
// from today's facts and measurements (Q3), options from today's lists (Q10), each type's questions (D2),
// and the trigger that keeps value rows in step with today's answers until dynamic-form (Q7).
//   npx tsx scripts/attributes-migration.ts >> prisma/migrations/<stamp>_attributes/migration.sql
import { ANSWER, FACTS, FACT_DECLARATIONS, MEASURES, UNITS } from "@server/listing/listing-facts";
import { ATTRIBUTE_KIND, ATTRIBUTE_SCOPE, BRAND_ATTRIBUTE, UNIT_FAMILY, VALUE_SOURCE } from "@server/listing/attribute.types";
import { canonicalOf, convert } from "@server/listing/units";

const q = (s: string | null | undefined) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const KIND = { [ANSWER.CHOICE]: ATTRIBUTE_KIND.CHOICE, [ANSWER.TEXT]: ATTRIBUTE_KIND.TEXT, [ANSWER.NUMBER]: ATTRIBUTE_KIND.NUMBER, [ANSWER.BOOLEAN]: ATTRIBUTE_KIND.BOOLEAN };
const title = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

const attributes: Array<[key: string, label: string, kind: string, unitFamily: string | null, scope: string]> = [
  ...FACTS.map((f) => [f, FACT_DECLARATIONS[f].label, KIND[FACT_DECLARATIONS[f].answer], null, ATTRIBUTE_SCOPE.PRODUCT] as [string, string, string, string | null, string]),
  ...MEASURES.map((m) => [m, title(m), ATTRIBUTE_KIND.MEASURE, m === "capacity" ? UNIT_FAMILY.VOLUME : UNIT_FAMILY.LENGTH, ATTRIBUTE_SCOPE.PRODUCT] as [string, string, string, string | null, string]),
  ["weight", "Weight", ATTRIBUTE_KIND.MEASURE, UNIT_FAMILY.WEIGHT, ATTRIBUTE_SCOPE.PRODUCT],
  [BRAND_ATTRIBUTE.BRAND, "Brand", ATTRIBUTE_KIND.REFERENCE, null, ATTRIBUTE_SCOPE.PRODUCT],
  [BRAND_ATTRIBUTE.COUNTRY_OF_ORIGIN, "Country of origin", ATTRIBUTE_KIND.TEXT, null, ATTRIBUTE_SCOPE.BRAND],
  [BRAND_ATTRIBUTE.MANUFACTURER, "Manufacturer", ATTRIBUTE_KIND.TEXT, null, ATTRIBUTE_SCOPE.BRAND],
  [BRAND_ATTRIBUTE.PACKER, "Packer", ATTRIBUTE_KIND.TEXT, null, ATTRIBUTE_SCOPE.BRAND],
  [BRAND_ATTRIBUTE.IMPORTER, "Importer", ATTRIBUTE_KIND.TEXT, null, ATTRIBUTE_SCOPE.BRAND],
];
const lists = FACTS.flatMap((f) => (FACT_DECLARATIONS[f].list ? [`(${q(f)}, ${q(FACT_DECLARATIONS[f].list!)})`] : []));

const SRC = VALUE_SOURCE;
const { CHOICE, TEXT, NUMBER, BOOLEAN, MEASURE } = { CHOICE: ATTRIBUTE_KIND.CHOICE, TEXT: ATTRIBUTE_KIND.TEXT, NUMBER: ATTRIBUTE_KIND.NUMBER, BOOLEAN: ATTRIBUTE_KIND.BOOLEAN, MEASURE: ATTRIBUTE_KIND.MEASURE };
const SCOPE_PRODUCT = ATTRIBUTE_SCOPE.PRODUCT;
const SRC_PRODUCT = SRC.PRODUCT, SRC_SHOP = SRC.SHOP, SRC_BRAND = SRC.BRAND;
// An origin we do not know is the product's own (review): the read copy only parses known sources.
const KNOWN = [SRC.PRODUCT, SRC.FAMILY, SRC.BRAND, SRC.MARKETPLACE].map((v) => `'${v}'`).join(", ");
const SOURCE_OF = (expr: string) => `CASE WHEN (${expr}) = 'defaults' THEN '${SRC.SHOP}' WHEN (${expr}) IN (${KNOWN}) THEN (${expr}) ELSE '${SRC.PRODUCT}' END`;
// Each declared unit's factor to its family's canonical one, from the same table the builder converts with.
const FACTORS = UNITS.map((u) => `WHEN '${u}' THEN ${convert(1, u, canonicalOf(u)!)}`).join(" ");
const LISTS = lists.join(", ");

const sql = `
-- ── Reference data (CLAUDE.md invariant 7): the dictionary, its options, each type's questions ──────────
ALTER TABLE "ProductValue" ADD CONSTRAINT "ProductValue_one_value" CHECK (num_nonnulls("optionKey", "text", "number", "bool", "refId") = 1);
CREATE UNIQUE INDEX "AttributeOption_attribute_key_platform_key" ON "AttributeOption" ("attributeKey", "key") WHERE "orgId" IS NULL;

INSERT INTO "Attribute" ("key", "label", "kind", "unitFamily", "scope") VALUES
${attributes.map(([k, l, kind, fam, scope]) => `  (${q(k)}, ${q(l)}, ${q(kind)}, ${q(fam)}, ${q(scope)})`).join(",\n")}
ON CONFLICT ("key") DO NOTHING;

-- Every list value becomes an option of each fact drawing on that list, shops' own values included (Q10).
INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order", "orgId", "productTypes", "retiredAt")
SELECT 'ao_' || md5(l.fact || ':' || v."key" || ':' || COALESCE(v."orgId", '')), l.fact, v."key", v."label", v."order", v."orgId", v."productTypes", v."retiredAt"
FROM (VALUES ${lists.join(", ")}) AS l(fact, list)
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
    CASE WHEN x.kind = '${CHOICE}' AND NOT x.unlisted THEN x.raw END,
    CASE WHEN (x.kind = '${CHOICE}' AND x.unlisted) OR x.kind = '${TEXT}'
           OR (x.kind = '${NUMBER}' AND NOT x.numeric_ok) OR (x.kind = '${BOOLEAN}' AND x.raw NOT IN ('true', 'false')) THEN x.raw END,
    CASE WHEN x.kind = '${NUMBER}' AND x.numeric_ok THEN trim_scale(x.raw::numeric) END,
    CASE WHEN x.kind = '${BOOLEAN}' AND x.raw IN ('true', 'false') THEN x.raw::boolean END,
    x.src, now()
  FROM (
    SELECT f.key, a."kind" AS kind, f.value ->> 'value' AS raw,
      COALESCE((f.value ->> 'unlisted') = 'true', false) AS unlisted,
      ((f.value ->> 'value') ~ '^-?[0-9]{1,30}(\\.[0-9]{1,20})?$') AS numeric_ok,
      ${SOURCE_OF("f.value ->> 'origin'")} AS src
    FROM jsonb_each(CASE WHEN jsonb_typeof(p."facts") = 'object' THEN p."facts" ELSE '{}'::jsonb END) AS f(key, value)
    JOIN "Attribute" a ON a."key" = f.key AND a."scope" = '${SCOPE_PRODUCT}' AND a."kind" IN ('${CHOICE}', '${TEXT}', '${NUMBER}', '${BOOLEAN}')
    WHERE jsonb_typeof(f.value) = 'object' AND COALESCE(f.value ->> 'value', '') <> ''
  ) x;

  -- A measure in the unit its type declares, stored canonical; with no declared unit, or too large, as text.
  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "number", "text", "unit", "source", "updatedAt")
  SELECT 'pv_' || md5(pid || ':' || m.key), pid, m.key,
    CASE WHEN u.factor IS NOT NULL AND m.numeric_ok THEN trim_scale(m.raw::numeric * u.factor) END,
    CASE WHEN u.factor IS NULL OR NOT m.numeric_ok THEN m.raw END,
    u.unit, m.src, now()
  FROM (
    SELECT e.key, e.value ->> 'value' AS raw, ((e.value ->> 'value') ~ '^-?[0-9]{1,20}(\\.[0-9]{1,20})?$') AS numeric_ok,
      ${SOURCE_OF("e.value ->> 'origin'")} AS src
    FROM jsonb_each(CASE WHEN jsonb_typeof(p."measurements") = 'object' THEN p."measurements" ELSE '{}'::jsonb END) AS e(key, value)
    JOIN "Attribute" a ON a."key" = e.key AND a."kind" = '${MEASURE}' AND a."key" <> 'weight'
    WHERE jsonb_typeof(e.value) = 'object' AND COALESCE(e.value ->> 'value', '') <> ''
  ) m
  LEFT JOIN LATERAL (
    SELECT d ->> 'unit' AS unit, CASE d ->> 'unit' ${FACTORS} END AS factor
    FROM "ProductType" t, jsonb_array_elements(CASE WHEN jsonb_typeof(t."measures") = 'array' THEN t."measures" ELSE '[]'::jsonb END) d
    WHERE t."key" = p."productType" AND d ->> 'key' = m.key LIMIT 1
  ) u ON true;

  IF p."weight" IS NOT NULL THEN
    INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "number", "text", "unit", "source", "updatedAt")
    VALUES ('pv_' || md5(pid || ':weight'), pid, 'weight',
      CASE WHEN p."weight" BETWEEN 0 AND 1e15 THEN trim_scale(round(p."weight"::numeric * 1000, 3)) END,
      CASE WHEN NOT (p."weight" BETWEEN 0 AND 1e15) THEN p."weight"::text END,
      'kg', '${SRC_PRODUCT}', now());
  END IF;

  IF brand."id" IS NOT NULL THEN
    INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "refId", "source", "sourceId", "updatedAt")
    VALUES ('pv_' || md5(pid || ':brand'), pid, 'brand', brand."id", CASE WHEN p."brandId" IS NULL THEN '${SRC_SHOP}' ELSE '${SRC_PRODUCT}' END, brand."id", now());
  END IF;
  -- Packer comes from the brand's one packer-or-importer line; importer waits for the brand's own parties
  -- (attributes Q11, unit 2), so a domestic brand's packer is never recorded as an importer.
  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "text", "source", "sourceId", "updatedAt")
  SELECT 'pv_' || md5(pid || ':' || x.key), pid, x.key, x.v, x.src, x.sid, now()
  FROM (VALUES
    ('countryOfOrigin', COALESCE(brand."countryOfOrigin", defaults."countryOfOrigin"), CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN '${SRC_BRAND}' ELSE '${SRC_SHOP}' END, CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN brand."id" END),
    ('manufacturer', brand."manufacturer", '${SRC_BRAND}', brand."id"),
    ('packer', brand."packerOrImporter", '${SRC_BRAND}', brand."id")
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
  FROM (VALUES ${LISTS}) AS l(fact, list)
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
`;
process.stdout.write(sql);
