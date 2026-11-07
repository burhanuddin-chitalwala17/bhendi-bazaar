// Writes dynamic-form unit 1's data: the new questions' lists as ListingValue rows (keys as attributes
// unit 2 gave their options), each type's new questions, capacity on bags, and the list-sync trigger with
// the new facts (dynamic-form Q5). Appended after any DDL.
//   npx tsx scripts/dynamic-form-migration.ts > prisma/migrations/<stamp>_dynamic_form_questions/migration.sql
import { readFileSync } from "node:fs";

import { FACTS, FACT_DECLARATIONS, LIST } from "@server/listing/listing-facts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const handbag = JSON.parse(readFileSync("tests/fixtures/amazon/HANDBAG.schema.json", "utf8"));
const schema = handbag.schema ?? handbag;
const enumOf = (prop: string) => {
  const v = schema.properties[prop].items.properties.value;
  return (v.anyOf?.find((a: { enum?: string[] }) => a.enum)?.enum ?? v.enum ?? []) as string[];
};
const LISTS: Record<string, string[]> = {
  [LIST.STYLE]: enumOf("style"),
  [LIST.STRAP_TYPE]: enumOf("strap_type"),
  [LIST.SIZE_SYSTEM]: ["IN", "UK", "US", "EU"],
  [LIST.SIZE_CLASS]: ["Alpha", "Numeric", "Free Size"],
};
const NEW: Record<string, string[]> = {
  bag: ["style", "innerMaterial", "pocketCount", "strapType", "packQuantity", "genericName", "modelName"],
  "travel-pouch": ["style", "innerMaterial", "pocketCount", "genericName", "modelName"],
  "islamic-wear": ["fabricType", "sizeSystem", "sizeClass", "packQuantity", "genericName", "modelName"],
  trousers: ["fabricType", "sizeSystem", "sizeClass", "packQuantity", "genericName", "modelName"],
  socks: ["fabricType", "sizeSystem", "sizeClass", "care", "genericName", "modelName"],
  fragrance: ["itemForm", "unitCount", "genericName", "modelName"],
  jewellery: ["stoneClarity", "stoneCut", "metalWeight", "packQuantity", "genericName", "modelName"],
  combo: ["genericName", "modelName"],
  "prayer-mat": ["genericName", "modelName"],
};
const lists = FACTS.flatMap((f) => (FACT_DECLARATIONS[f].list ? [`(${q(f)}, ${q(FACT_DECLARATIONS[f].list!)})`] : []));

process.stdout.write(`-- listing-model/dynamic-form unit 1 (Q5): parent Q26's questions asked through the form's own path. Their
-- lists as list values, each type's new questions, capacity on bags, and the list-sync trigger knowing the
-- new facts. Reference data: inserts and appends only; nothing dropped or overwritten.

-- Metal weight is asked in grams as a number, like every fact (attributes Q15).
UPDATE "Attribute" SET "kind" = 'number', "unitFamily" = NULL, "label" = 'Metal weight (g)' WHERE "key" = 'metalWeight';

-- A list value added later reaches every fact drawing on its list, the new ones included (attributes Q12).
CREATE OR REPLACE FUNCTION bb_attribute_options_on_listing_value() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order", "orgId", "productTypes", "retiredAt")
  SELECT 'ao_' || md5(l.fact || ':' || NEW."key" || ':' || COALESCE(NEW."orgId", '')), l.fact, NEW."key", NEW."label", NEW."order", NEW."orgId", NEW."productTypes", NEW."retiredAt"
  FROM (VALUES ${lists.join(", ")}) AS l(fact, list)
  WHERE l.list = NEW."list" AND EXISTS (SELECT 1 FROM "Attribute" a WHERE a."key" = l.fact)
  ON CONFLICT ("id") DO UPDATE SET "label" = EXCLUDED."label", "order" = EXCLUDED."order", "productTypes" = EXCLUDED."productTypes", "retiredAt" = EXCLUDED."retiredAt";
  RETURN NULL;
END
$fn$;

INSERT INTO "ListingValue" ("id", "list", "key", "label", "order", "updatedAt") VALUES
${Object.entries(LISTS).flatMap(([list, values]) => values.map((v, i) => `  ('lv_' || md5(${q(`${list}:${slug(v)}`)}), ${q(list)}, ${q(slug(v))}, ${q(v)}, ${i}, now())`)).join(",\n")}
ON CONFLICT DO NOTHING;

-- Lining draws on the materials list: every material is a lining option too.
INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order", "orgId", "productTypes", "retiredAt")
SELECT 'ao_' || md5('innerMaterial:' || v."key" || ':' || COALESCE(v."orgId", '')), 'innerMaterial', v."key", v."label", v."order", v."orgId", v."productTypes", v."retiredAt"
FROM "ListingValue" v WHERE v."list" = '${LIST.MATERIAL}'
ON CONFLICT ("id") DO NOTHING;

-- Questions now in a type's own list are derived from it (attributes Q12), so the appends below rebuild
-- them in the list's order rather than keeping unit 2's migration-added rows beside it (review).
UPDATE "BbTypeAttribute" SET "fromType" = true WHERE NOT "fromType" AND ("productTypeKey", "attributeKey") IN (VALUES
${Object.entries(NEW).flatMap(([type, facts]) => [...facts, ...(["bag", "travel-pouch"].includes(type) ? ["capacity"] : [])].map((f) => `  (${q(type)}, ${q(f)})`)).join(",\n")});

${Object.entries(NEW).map(([type, facts]) => facts.map((f) => `UPDATE "ProductType" SET "facts" = array_append("facts", ${q(f)}) WHERE "key" = ${q(type)} AND NOT (${q(f)} = ANY("facts"));`).join("\n")).join("\n")}

-- Capacity, measured in millilitres, on bags and pouches (parent Q26).
UPDATE "ProductType" SET "measures" = COALESCE(CASE WHEN jsonb_typeof("measures") = 'array' THEN "measures" END, '[]'::jsonb) || '[{"key": "capacity", "label": "Capacity", "unit": "ml", "required": false}]'::jsonb
WHERE "key" IN ('bag', 'travel-pouch') AND NOT (COALESCE(CASE WHEN jsonb_typeof("measures") = 'array' THEN "measures" END, '[]'::jsonb) @> '[{"key": "capacity"}]'::jsonb);
`);
