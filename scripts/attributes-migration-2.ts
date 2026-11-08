// Writes listing-model/attributes unit 2's data and triggers: each brand's Amazon flag and parties (D6),
// the new questions of parent Q26 with their options (D8, Q15), and a product's type following its
// category (D7, Q14). Appended after the unit's DDL.
//   npx tsx scripts/attributes-migration-2.ts >> prisma/migrations/<stamp>_attributes_brand_parties/migration.sql
import { readFileSync } from "node:fs";

import { ATTRIBUTE_KIND, ATTRIBUTE_SCOPE, BRAND_PARTY_ROLE, UNIT_FAMILY } from "@server/listing/attribute.types";
import { syncProductValuesSql } from "./attributes-sql";

const q = (s: string | null) => (s === null ? "NULL" : `'${s.replace(/'/g, "''")}'`);
const handbag = JSON.parse(readFileSync("tests/fixtures/amazon/HANDBAG.schema.json", "utf8"));
const enumOf = (prop: string, part = "value") => {
  const schema = handbag.schema ?? handbag;
  const value = schema.properties[prop].items.properties[part];
  return (value.anyOf?.find((a: { enum?: string[] }) => a.enum)?.enum ?? value.enum ?? []) as string[];
};

// Parent Q26's new questions, less those today's facts already ask (Q15: one question per fact).
const ATTRS: Array<{ key: string; label: string; kind: string; unitFamily?: string; options?: string[]; copyFrom?: string; types: string[] }> = [
  { key: "style", label: "Style", kind: ATTRIBUTE_KIND.CHOICE, options: enumOf("style"), types: ["bag", "travel-pouch"] },
  { key: "innerMaterial", label: "Lining material", kind: ATTRIBUTE_KIND.CHOICE, copyFrom: "material", types: ["bag", "travel-pouch"] },
  { key: "pocketCount", label: "Pockets", kind: ATTRIBUTE_KIND.NUMBER, types: ["bag", "travel-pouch"] },
  { key: "strapType", label: "Strap type", kind: ATTRIBUTE_KIND.CHOICE, options: enumOf("strap_type"), types: ["bag"] },
  { key: "fabricType", label: "Fabric type", kind: ATTRIBUTE_KIND.TEXT, types: ["islamic-wear", "trousers", "socks"] },
  { key: "sizeSystem", label: "Size system", kind: ATTRIBUTE_KIND.CHOICE, options: ["IN", "UK", "US", "EU"], types: ["islamic-wear", "trousers", "socks"] },
  { key: "sizeClass", label: "Size type", kind: ATTRIBUTE_KIND.CHOICE, options: ["Alpha", "Numeric", "Free Size"], types: ["islamic-wear", "trousers", "socks"] },
  { key: "itemForm", label: "Form", kind: ATTRIBUTE_KIND.TEXT, types: ["fragrance"] },
  { key: "unitCount", label: "Units in the pack", kind: ATTRIBUTE_KIND.NUMBER, types: ["fragrance"] },
  { key: "stoneClarity", label: "Stone clarity", kind: ATTRIBUTE_KIND.TEXT, types: ["jewellery"] },
  { key: "stoneCut", label: "Stone cut", kind: ATTRIBUTE_KIND.TEXT, types: ["jewellery"] },
  { key: "metalWeight", label: "Metal weight", kind: ATTRIBUTE_KIND.MEASURE, unitFamily: UNIT_FAMILY.WEIGHT, types: ["jewellery"] },
  { key: "genericName", label: "Generic name", kind: ATTRIBUTE_KIND.TEXT, types: ["*"] },
  { key: "modelName", label: "Model name", kind: ATTRIBUTE_KIND.TEXT, types: ["*"] },
];

// Questions today's facts already ask, attached where parent Q26 asks them and the type lacks them (Q15).
const REUSED: Array<{ key: string; types: string[] }> = [
  { key: "capacity", types: ["bag", "travel-pouch"] },
  { key: "packQuantity", types: ["*"] },
  { key: "care", types: ["islamic-wear", "trousers", "socks"] },
];

const out: string[] = [];
out.push(`
-- ── Each brand's Amazon flag and parties (D6, parent Q10) ───────────────────────────────────────────────
UPDATE "Brand" b SET "amazonRegistered" = NOT COALESCE(d."amazonGeneric", false) FROM "OrgListingDefaults" d WHERE d."orgId" = b."orgId";
-- Parties are not copied from the brand's two lines: until the brand page writes parties, the value sync
-- falls back to those lines, so an edit on today's brand page keeps reaching products (review of unit 2).

-- ── Parent Q26's new questions, their options, and the types that ask them (D8, Q15) ────────────────────
INSERT INTO "Attribute" ("key", "label", "kind", "unitFamily", "scope") VALUES
${ATTRS.map((a) => `  (${q(a.key)}, ${q(a.label)}, ${q(a.kind)}, ${q(a.unitFamily ?? null)}, '${ATTRIBUTE_SCOPE.PRODUCT}')`).join(",\n")}
ON CONFLICT ("key") DO NOTHING;
`);
for (const a of ATTRS) {
  if (a.options?.length) {
    out.push(`INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order") VALUES
${a.options.map((o, i) => `  ('ao_' || md5(${q(`${a.key}:${o.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:`)}), ${q(a.key)}, ${q(o.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}, ${q(o)}, ${i})`).join(",\n")}
ON CONFLICT DO NOTHING;`);
  }
  if (a.copyFrom) {
    out.push(`INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order", "orgId", "productTypes", "retiredAt")
SELECT 'ao_' || md5(${q(a.key)} || ':' || o."key" || ':' || COALESCE(o."orgId", '')), ${q(a.key)}, o."key", o."label", o."order", o."orgId", o."productTypes", o."retiredAt"
FROM "AttributeOption" o WHERE o."attributeKey" = ${q(a.copyFrom)}
ON CONFLICT DO NOTHING;`);
  }
  const where = a.types.includes("*") ? "" : ` WHERE t."key" IN (${a.types.map(q).join(", ")})`;
  out.push(`INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || ${q(a.key)}), t."key", ${q(a.key)}, 200 + ${ATTRS.indexOf(a)}, false FROM "ProductType" t${where}
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;`);
}

for (const r of REUSED) {
  const where = r.types.includes("*") ? "" : ` WHERE t."key" IN (${r.types.map(q).join(", ")})`;
  out.push(`INSERT INTO "BbTypeAttribute" ("id", "productTypeKey", "attributeKey", "order", "fromType")
SELECT 'bta_' || md5(t."key" || ':' || ${q(r.key)}), t."key", ${q(r.key)}, 300 + ${REUSED.indexOf(r)}, false FROM "ProductType" t${where}
ON CONFLICT ("productTypeKey", "attributeKey") DO NOTHING;`);
}

out.push(`
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
${syncProductValuesSql(true)}
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
`);
process.stdout.write(out.join("\n"));
