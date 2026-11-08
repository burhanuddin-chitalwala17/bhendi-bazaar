// The value functions of the switch (listing-model/dynamic-form Q16): what product-value.repository calls in
// the caller's transaction once the sync triggers are gone. Written as SQL so a product's typed rows, its
// inherited brand rows and its read copy are derived exactly as the attributes migrations derived them.
import { ATTRIBUTE_KIND, ATTRIBUTE_SCOPE, BRAND_PARTY_ROLE, VALUE_SOURCE } from "@server/listing/attribute.types";
import { UNITS } from "@server/listing/listing-facts";
import { canonicalOf, convert } from "@server/listing/units";

const SRC = VALUE_SOURCE;
const { CHOICE, TEXT, NUMBER, BOOLEAN, MEASURE } = ATTRIBUTE_KIND;
const KNOWN = [SRC.PRODUCT, SRC.FAMILY, SRC.BRAND, SRC.MARKETPLACE].map((v) => `'${v}'`).join(", ");
const SOURCE_OF = (expr: string) => `CASE WHEN (${expr}) = 'defaults' THEN '${SRC.SHOP}' WHEN (${expr}) IN (${KNOWN}) THEN (${expr}) ELSE '${SRC.PRODUCT}' END`;
const FACTORS = UNITS.map((u) => `WHEN '${u}' THEN ${convert(1, u, canonicalOf(u)!)}`).join(" ");
const PARTY = (role: string, legacy: string) =>
  `COALESCE((SELECT NULLIF(concat_ws(', ', NULLIF(bp."name", ''), NULLIF(bp."address", ''), NULLIF(bp."pincode", '')), '') FROM "BrandParty" bp WHERE bp."brandId" = brand."id" AND bp."role" = '${role}'), ${legacy})`;

export function valueSwitchSql(): string {
  return `
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
    CASE WHEN x.kind = '${CHOICE}' AND NOT x.unlisted AND x.raw IS NOT NULL THEN x.raw END,
    CASE WHEN x.raw IS NULL THEN x.value::text
         WHEN x.kind IS NULL OR (x.kind = '${CHOICE}' AND x.unlisted) OR x.kind IN ('${TEXT}', '${MEASURE}', 'reference')
           OR (x.kind = '${NUMBER}' AND NOT x.numeric_ok) OR (x.kind = '${BOOLEAN}' AND x.raw NOT IN ('true', 'false')) THEN x.raw END,
    CASE WHEN x.kind = '${NUMBER}' AND x.numeric_ok THEN trim_scale(x.raw::numeric) END,
    CASE WHEN x.kind = '${BOOLEAN}' AND x.raw IN ('true', 'false') THEN x.raw::boolean END,
    x.src, x.value, false, now()
  FROM (
    SELECT f.key, f.value, a."kind" AS kind,
      CASE WHEN jsonb_typeof(f.value) = 'object' THEN NULLIF(f.value ->> 'value', '') END AS raw,
      COALESCE((f.value ->> 'unlisted') = 'true', false) AS unlisted,
      COALESCE((f.value ->> 'value') ~ '^-?[0-9]{1,30}(\\.[0-9]{1,20})?$', false) AS numeric_ok,
      ${SOURCE_OF("f.value ->> 'origin'")} AS src
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
      COALESCE((e.value ->> 'value') ~ '^-?[0-9]{1,20}(\\.[0-9]{1,20})?$', false) AS numeric_ok,
      ${SOURCE_OF("e.value ->> 'origin'")} AS src
    FROM jsonb_each(CASE WHEN jsonb_typeof(measurements) = 'object' THEN measurements ELSE '{}'::jsonb END) AS e(key, value)
  ) m
  LEFT JOIN LATERAL (
    SELECT d ->> 'unit' AS unit, CASE d ->> 'unit' ${FACTORS} END AS factor
    FROM "ProductType" t, jsonb_array_elements(CASE WHEN jsonb_typeof(t."measures") = 'array' THEN t."measures" ELSE '[]'::jsonb END) d
    WHERE t."key" = ptype AND d ->> 'key' = m.key LIMIT 1
  ) u ON true;

  IF weight IS NOT NULL THEN
    INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "number", "text", "unit", "source", "updatedAt")
    VALUES ('pv_' || md5(pid || ':w'), pid, 'weight',
      CASE WHEN weight BETWEEN 0 AND 1e15 THEN trim_scale(round(weight::numeric * 1000, 3)) END,
      CASE WHEN NOT (weight BETWEEN 0 AND 1e15) THEN weight::text END, 'kg', '${SRC.PRODUCT}', now())
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
    VALUES ('pv_' || md5(pid || ':i:brand'), pid, 'brand', brand."id", CASE WHEN p."brandId" IS NULL THEN '${SRC.SHOP}' ELSE '${SRC.PRODUCT}' END, brand."id", now())
    ON CONFLICT ("productId", "attributeKey", "measured") DO NOTHING;
  END IF;
  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "text", "source", "sourceId", "updatedAt")
  SELECT 'pv_' || md5(pid || ':i:' || x.key), pid, x.key, x.v, x.src, x.sid, now()
  FROM (VALUES
    ('countryOfOrigin', COALESCE(brand."countryOfOrigin", defaults."countryOfOrigin"), CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN '${SRC.BRAND}' ELSE '${SRC.SHOP}' END, CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN brand."id" END),
    ('manufacturer', ${PARTY(BRAND_PARTY_ROLE.MAKER, 'brand."manufacturer"')}, '${SRC.BRAND}', brand."id"),
    ('packer', ${PARTY(BRAND_PARTY_ROLE.PACKER, 'brand."packerOrImporter"')}, '${SRC.BRAND}', brand."id"),
    ('importer', ${PARTY(BRAND_PARTY_ROLE.IMPORTER, "NULL")}, '${SRC.BRAND}', brand."id")
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
`;
}

void ATTRIBUTE_SCOPE;
