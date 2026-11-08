// Writes the reference data and the trigger of listing-model/attributes unit 1: the attribute dictionary
// from today's facts and measurements (Q3), options from today's lists (Q10), each type's questions (D2),
// and the trigger that keeps value rows in step with today's answers until dynamic-form (Q7).
//   npx tsx scripts/attributes-migration.ts >> prisma/migrations/<stamp>_attributes/migration.sql
import { ANSWER, FACTS, FACT_DECLARATIONS, MEASURES, UNITS } from "@server/listing/listing-facts";
import { ATTRIBUTE_KIND, ATTRIBUTE_SCOPE, BRAND_ATTRIBUTE, UNIT_FAMILY, VALUE_SOURCE } from "@server/listing/attribute.types";
import { syncProductValuesSql } from "./attributes-sql";

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
${syncProductValuesSql(false)}CREATE OR REPLACE FUNCTION bb_product_values_on_product() RETURNS trigger LANGUAGE plpgsql AS $fn$
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
