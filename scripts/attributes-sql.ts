// The value-sync function of listing-model/attributes (Q7), shared by the unit 1 and unit 2 migrations so
// unit 2 changes only what it adds: the brand's own parties (D6, Q11).
import { ATTRIBUTE_KIND, ATTRIBUTE_SCOPE, BRAND_PARTY_ROLE, VALUE_SOURCE } from "@server/listing/attribute.types";
import { UNITS } from "@server/listing/listing-facts";
import { canonicalOf, convert } from "@server/listing/units";

const SRC = VALUE_SOURCE;
const { CHOICE, TEXT, NUMBER, BOOLEAN, MEASURE } = { CHOICE: ATTRIBUTE_KIND.CHOICE, TEXT: ATTRIBUTE_KIND.TEXT, NUMBER: ATTRIBUTE_KIND.NUMBER, BOOLEAN: ATTRIBUTE_KIND.BOOLEAN, MEASURE: ATTRIBUTE_KIND.MEASURE };
const SCOPE_PRODUCT = ATTRIBUTE_SCOPE.PRODUCT;
const SRC_PRODUCT = SRC.PRODUCT, SRC_SHOP = SRC.SHOP, SRC_BRAND = SRC.BRAND;
// An origin we do not know is the product's own (review): the read copy only parses known sources.
const KNOWN = [SRC.PRODUCT, SRC.FAMILY, SRC.BRAND, SRC.MARKETPLACE].map((v) => `'${v}'`).join(", ");
const SOURCE_OF = (expr: string) => `CASE WHEN (${expr}) = 'defaults' THEN '${SRC.SHOP}' WHEN (${expr}) IN (${KNOWN}) THEN (${expr}) ELSE '${SRC.PRODUCT}' END`;
// Each declared unit's factor to its family's canonical one, from the same table the builder converts with.
const FACTORS = UNITS.map((u) => `WHEN '${u}' THEN ${convert(1, u, canonicalOf(u)!)}`).join(" ");

/** A brand party as one line a channel takes: name, address and pincode, comma-joined (D6). */
const PARTY = (role: string, legacy: string) =>
  `COALESCE((SELECT NULLIF(concat_ws(', ', NULLIF(bp."name", ''), NULLIF(bp."address", ''), NULLIF(bp."pincode", '')), '') FROM "BrandParty" bp WHERE bp."brandId" = brand."id" AND bp."role" = '${role}'), ${legacy})`;

export function syncProductValuesSql(parties: boolean): string {
  const maker = parties ? PARTY(BRAND_PARTY_ROLE.MAKER, 'brand."manufacturer"') : 'brand."manufacturer"';
  const packer = parties ? PARTY(BRAND_PARTY_ROLE.PACKER, 'brand."packerOrImporter"') : 'brand."packerOrImporter"';
  const importer = parties ? `,\n    ('importer', ${PARTY(BRAND_PARTY_ROLE.IMPORTER, "NULL")}, '${SRC_BRAND}', brand."id")` : "";
  const partyNote = parties
    ? "  -- Maker, packer and importer from the brand's parties, else its two lines; importer only from its own party\n  -- (attributes Q11), so a domestic brand's packer is never recorded as an importer."
    : "  -- Packer comes from the brand's one packer-or-importer line; importer waits for the brand's own parties\n  -- (attributes Q11, unit 2), so a domestic brand's packer is never recorded as an importer.";
  return `CREATE OR REPLACE FUNCTION bb_sync_product_values(pid text) RETURNS void LANGUAGE plpgsql AS $fn$
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
${partyNote}
  INSERT INTO "ProductValue" ("id", "productId", "attributeKey", "text", "source", "sourceId", "updatedAt")
  SELECT 'pv_' || md5(pid || ':' || x.key), pid, x.key, x.v, x.src, x.sid, now()
  FROM (VALUES
    ('countryOfOrigin', COALESCE(brand."countryOfOrigin", defaults."countryOfOrigin"), CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN '${SRC_BRAND}' ELSE '${SRC_SHOP}' END, CASE WHEN brand."countryOfOrigin" IS NOT NULL THEN brand."id" END),
    ('manufacturer', ${maker}, '${SRC_BRAND}', brand."id"),
    ('packer', ${packer}, '${SRC_BRAND}', brand."id")${importer}
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

`;
}
