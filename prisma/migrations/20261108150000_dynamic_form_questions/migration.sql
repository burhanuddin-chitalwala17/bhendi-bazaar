-- listing-model/dynamic-form unit 1 (Q5): parent Q26's questions asked through the form's own path. Their
-- lists as list values, each type's new questions, capacity on bags, and the list-sync trigger knowing the
-- new facts. Reference data: inserts and appends only; nothing dropped or overwritten.

-- Metal weight is asked in grams as a number, like every fact (attributes Q15).
UPDATE "Attribute" SET "kind" = 'number', "unitFamily" = NULL, "label" = 'Metal weight (g)' WHERE "key" = 'metalWeight';

-- A list value added later reaches every fact drawing on its list, the new ones included (attributes Q12).
CREATE OR REPLACE FUNCTION bb_attribute_options_on_listing_value() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order", "orgId", "productTypes", "retiredAt")
  SELECT 'ao_' || md5(l.fact || ':' || NEW."key" || ':' || COALESCE(NEW."orgId", '')), l.fact, NEW."key", NEW."label", NEW."order", NEW."orgId", NEW."productTypes", NEW."retiredAt"
  FROM (VALUES ('colour', 'colour'), ('pattern', 'pattern'), ('material', 'material'), ('audience', 'audience'), ('occasion', 'occasion'), ('sleeveLength', 'sleeveLength'), ('sleeveStyling', 'sleeveStyling'), ('stitchType', 'stitchType'), ('fit', 'fit'), ('waistRise', 'waistRise'), ('waistClosure', 'waistClosure'), ('surfaceStyling', 'surfaceStyling'), ('shape', 'shape'), ('care', 'care'), ('closure', 'closure'), ('strap', 'strap'), ('strapPadding', 'strapPadding'), ('scentFamily', 'scentFamily'), ('plating', 'plating'), ('baseMaterial', 'baseMaterial'), ('purity', 'purity'), ('certification', 'certification'), ('gemstone', 'gemstone'), ('style', 'style'), ('innerMaterial', 'material'), ('strapType', 'strapType'), ('sizeSystem', 'sizeSystem'), ('sizeClass', 'sizeClass')) AS l(fact, list)
  WHERE l.list = NEW."list" AND EXISTS (SELECT 1 FROM "Attribute" a WHERE a."key" = l.fact)
  ON CONFLICT ("id") DO UPDATE SET "label" = EXCLUDED."label", "order" = EXCLUDED."order", "productTypes" = EXCLUDED."productTypes", "retiredAt" = EXCLUDED."retiredAt";
  RETURN NULL;
END
$fn$;

INSERT INTO "ListingValue" ("id", "list", "key", "label", "order", "updatedAt") VALUES
  ('lv_' || md5('style:bohemian'), 'style', 'bohemian', 'Bohemian', 0, now()),
  ('lv_' || md5('style:contemporary'), 'style', 'contemporary', 'Contemporary', 1, now()),
  ('lv_' || md5('style:deconstructed'), 'style', 'deconstructed', 'Deconstructed', 2, now()),
  ('lv_' || md5('style:formal'), 'style', 'formal', 'Formal', 3, now()),
  ('lv_' || md5('style:minimal'), 'style', 'minimal', 'Minimal', 4, now()),
  ('lv_' || md5('style:retro'), 'style', 'retro', 'Retro', 5, now()),
  ('lv_' || md5('style:utility'), 'style', 'utility', 'Utility', 6, now()),
  ('lv_' || md5('style:western'), 'style', 'western', 'Western', 7, now()),
  ('lv_' || md5('strapType:adjustable'), 'strapType', 'adjustable', 'Adjustable', 0, now()),
  ('lv_' || md5('strapType:cross-body'), 'strapType', 'cross-body', 'Cross-Body', 1, now()),
  ('lv_' || md5('strapType:hand-carry'), 'strapType', 'hand-carry', 'Hand-Carry', 2, now()),
  ('lv_' || md5('strapType:shoulder'), 'strapType', 'shoulder', 'Shoulder', 3, now()),
  ('lv_' || md5('strapType:waist-strap'), 'strapType', 'waist-strap', 'Waist Strap', 4, now()),
  ('lv_' || md5('sizeSystem:in'), 'sizeSystem', 'in', 'IN', 0, now()),
  ('lv_' || md5('sizeSystem:uk'), 'sizeSystem', 'uk', 'UK', 1, now()),
  ('lv_' || md5('sizeSystem:us'), 'sizeSystem', 'us', 'US', 2, now()),
  ('lv_' || md5('sizeSystem:eu'), 'sizeSystem', 'eu', 'EU', 3, now()),
  ('lv_' || md5('sizeClass:alpha'), 'sizeClass', 'alpha', 'Alpha', 0, now()),
  ('lv_' || md5('sizeClass:numeric'), 'sizeClass', 'numeric', 'Numeric', 1, now()),
  ('lv_' || md5('sizeClass:free-size'), 'sizeClass', 'free-size', 'Free Size', 2, now())
ON CONFLICT DO NOTHING;

-- Lining draws on the materials list: every material is a lining option too.
INSERT INTO "AttributeOption" ("id", "attributeKey", "key", "label", "order", "orgId", "productTypes", "retiredAt")
SELECT 'ao_' || md5('innerMaterial:' || v."key" || ':' || COALESCE(v."orgId", '')), 'innerMaterial', v."key", v."label", v."order", v."orgId", v."productTypes", v."retiredAt"
FROM "ListingValue" v WHERE v."list" = 'material'
ON CONFLICT ("id") DO NOTHING;

-- Questions now in a type's own list are derived from it (attributes Q12), so the appends below rebuild
-- them in the list's order rather than keeping unit 2's migration-added rows beside it (review).
UPDATE "BbTypeAttribute" SET "fromType" = true WHERE NOT "fromType" AND ("productTypeKey", "attributeKey") IN (VALUES
  ('bag', 'style'),
  ('bag', 'innerMaterial'),
  ('bag', 'pocketCount'),
  ('bag', 'strapType'),
  ('bag', 'packQuantity'),
  ('bag', 'genericName'),
  ('bag', 'modelName'),
  ('bag', 'capacity'),
  ('travel-pouch', 'style'),
  ('travel-pouch', 'innerMaterial'),
  ('travel-pouch', 'pocketCount'),
  ('travel-pouch', 'genericName'),
  ('travel-pouch', 'modelName'),
  ('travel-pouch', 'capacity'),
  ('islamic-wear', 'fabricType'),
  ('islamic-wear', 'sizeSystem'),
  ('islamic-wear', 'sizeClass'),
  ('islamic-wear', 'packQuantity'),
  ('islamic-wear', 'genericName'),
  ('islamic-wear', 'modelName'),
  ('trousers', 'fabricType'),
  ('trousers', 'sizeSystem'),
  ('trousers', 'sizeClass'),
  ('trousers', 'packQuantity'),
  ('trousers', 'genericName'),
  ('trousers', 'modelName'),
  ('socks', 'fabricType'),
  ('socks', 'sizeSystem'),
  ('socks', 'sizeClass'),
  ('socks', 'care'),
  ('socks', 'genericName'),
  ('socks', 'modelName'),
  ('fragrance', 'itemForm'),
  ('fragrance', 'unitCount'),
  ('fragrance', 'genericName'),
  ('fragrance', 'modelName'),
  ('jewellery', 'stoneClarity'),
  ('jewellery', 'stoneCut'),
  ('jewellery', 'metalWeight'),
  ('jewellery', 'packQuantity'),
  ('jewellery', 'genericName'),
  ('jewellery', 'modelName'),
  ('combo', 'genericName'),
  ('combo', 'modelName'),
  ('prayer-mat', 'genericName'),
  ('prayer-mat', 'modelName'));

UPDATE "ProductType" SET "facts" = array_append("facts", 'style') WHERE "key" = 'bag' AND NOT ('style' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'innerMaterial') WHERE "key" = 'bag' AND NOT ('innerMaterial' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'pocketCount') WHERE "key" = 'bag' AND NOT ('pocketCount' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'strapType') WHERE "key" = 'bag' AND NOT ('strapType' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'packQuantity') WHERE "key" = 'bag' AND NOT ('packQuantity' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'genericName') WHERE "key" = 'bag' AND NOT ('genericName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'modelName') WHERE "key" = 'bag' AND NOT ('modelName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'style') WHERE "key" = 'travel-pouch' AND NOT ('style' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'innerMaterial') WHERE "key" = 'travel-pouch' AND NOT ('innerMaterial' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'pocketCount') WHERE "key" = 'travel-pouch' AND NOT ('pocketCount' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'genericName') WHERE "key" = 'travel-pouch' AND NOT ('genericName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'modelName') WHERE "key" = 'travel-pouch' AND NOT ('modelName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'fabricType') WHERE "key" = 'islamic-wear' AND NOT ('fabricType' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'sizeSystem') WHERE "key" = 'islamic-wear' AND NOT ('sizeSystem' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'sizeClass') WHERE "key" = 'islamic-wear' AND NOT ('sizeClass' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'packQuantity') WHERE "key" = 'islamic-wear' AND NOT ('packQuantity' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'genericName') WHERE "key" = 'islamic-wear' AND NOT ('genericName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'modelName') WHERE "key" = 'islamic-wear' AND NOT ('modelName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'fabricType') WHERE "key" = 'trousers' AND NOT ('fabricType' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'sizeSystem') WHERE "key" = 'trousers' AND NOT ('sizeSystem' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'sizeClass') WHERE "key" = 'trousers' AND NOT ('sizeClass' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'packQuantity') WHERE "key" = 'trousers' AND NOT ('packQuantity' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'genericName') WHERE "key" = 'trousers' AND NOT ('genericName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'modelName') WHERE "key" = 'trousers' AND NOT ('modelName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'fabricType') WHERE "key" = 'socks' AND NOT ('fabricType' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'sizeSystem') WHERE "key" = 'socks' AND NOT ('sizeSystem' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'sizeClass') WHERE "key" = 'socks' AND NOT ('sizeClass' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'care') WHERE "key" = 'socks' AND NOT ('care' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'genericName') WHERE "key" = 'socks' AND NOT ('genericName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'modelName') WHERE "key" = 'socks' AND NOT ('modelName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'itemForm') WHERE "key" = 'fragrance' AND NOT ('itemForm' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'unitCount') WHERE "key" = 'fragrance' AND NOT ('unitCount' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'genericName') WHERE "key" = 'fragrance' AND NOT ('genericName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'modelName') WHERE "key" = 'fragrance' AND NOT ('modelName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'stoneClarity') WHERE "key" = 'jewellery' AND NOT ('stoneClarity' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'stoneCut') WHERE "key" = 'jewellery' AND NOT ('stoneCut' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'metalWeight') WHERE "key" = 'jewellery' AND NOT ('metalWeight' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'packQuantity') WHERE "key" = 'jewellery' AND NOT ('packQuantity' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'genericName') WHERE "key" = 'jewellery' AND NOT ('genericName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'modelName') WHERE "key" = 'jewellery' AND NOT ('modelName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'genericName') WHERE "key" = 'combo' AND NOT ('genericName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'modelName') WHERE "key" = 'combo' AND NOT ('modelName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'genericName') WHERE "key" = 'prayer-mat' AND NOT ('genericName' = ANY("facts"));
UPDATE "ProductType" SET "facts" = array_append("facts", 'modelName') WHERE "key" = 'prayer-mat' AND NOT ('modelName' = ANY("facts"));

-- Capacity, measured in millilitres, on bags and pouches (parent Q26).
UPDATE "ProductType" SET "measures" = COALESCE(CASE WHEN jsonb_typeof("measures") = 'array' THEN "measures" END, '[]'::jsonb) || '[{"key": "capacity", "label": "Capacity", "unit": "ml", "required": false}]'::jsonb
WHERE "key" IN ('bag', 'travel-pouch') AND NOT (COALESCE(CASE WHEN jsonb_typeof("measures") = 'array' THEN "measures" END, '[]'::jsonb) @> '[{"key": "capacity"}]'::jsonb);
