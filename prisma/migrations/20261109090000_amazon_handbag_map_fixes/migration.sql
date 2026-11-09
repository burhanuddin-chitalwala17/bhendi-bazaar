-- Amazon refused the first HANDBAG send on 2026-11-09 (production listing check): Item Weight invalid and no
-- unit, Water Resistance Level not an approved value, and inner, item_dimensions and size_info "not applicable".
-- Causes: a setup request applied on 2026-11-06/08 mapped whole objects to text answers (inner → What is in the
-- set, item_dimensions and item_weight → Form, size_info → What is in the set), overwriting the product's weight
-- in grams; and water resistance sent Amazon's display words where its schema takes the codes.
-- Reference data only: field maps are rebuilt here, no shop's product data is touched.

-- The four wrong maps: their sub-field maps (inner.material, item_dimensions.length/width/height,
-- size_info.display_name) already send what Amazon asks.
DELETE FROM "FieldMap"
WHERE "channel" = 'amazon' AND "attributeKey" IN ('contents', 'itemForm')
  AND "fieldPath" IN ('inner', 'item_dimensions', 'item_weight', 'size_info');

-- Item weight is the product's weight, in grams (as the default maps set it).
INSERT INTO "FieldMap" ("id", "channel", "channelType", "fieldPath", "bbType", "source", "coreKey", "unitTarget", "checkedSource", "checkedOn", "reason", "updatedAt")
VALUES ('fm_' || md5('amazon:HANDBAG:item_weight:'), 'amazon', 'HANDBAG', 'item_weight', '', 'core', 'weight', 'grams',
  'Amazon listing check 2026-11-09 (HANDBAG schema: item_weight takes value and unit grams/kilograms/…)', DATE '2026-11-09',
  'The product''s weight, sent in grams as Amazon''s unit list allows', now())
ON CONFLICT ("channel", "channelType", "fieldPath", "bbType") DO UPDATE SET
  "source" = 'core', "attributeKey" = NULL, "ruleKey" = NULL, "constant" = NULL, "coreKey" = 'weight', "unitTarget" = 'grams',
  "checkedSource" = EXCLUDED."checkedSource", "checkedOn" = EXCLUDED."checkedOn", "reason" = EXCLUDED."reason", "updatedAt" = now();

-- Water resistance: Amazon's schema takes the code (enum), its words are only the label (enumNames).
UPDATE "FieldValueMap" v SET "channelValue" = CASE v."optionKey" WHEN 'true' THEN 'water_resistant' WHEN 'false' THEN 'not_water_resistant' END
FROM "FieldMap" f
WHERE v."fieldMapId" = f."id" AND f."channel" = 'amazon' AND f."fieldPath" = 'water_resistance_level' AND v."optionKey" IN ('true', 'false');
