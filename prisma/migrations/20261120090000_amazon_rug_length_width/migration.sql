-- Amazon RUG asks Item Dimensions L x W (item_length_width), one attribute of two measures. The admin screen
-- maps a whole field to one answer, so it was mapped to a size word, which Amazon cannot take as a measure
-- (2026-11-20). Its parts are mapped here as the default maps do item_dimensions: our length and width, in cm.
-- Reference data only: field maps, no shop's product data is touched.

DELETE FROM "FieldMap"
WHERE "channel" = 'amazon' AND "channelType" = 'RUG' AND "fieldPath" = 'item_length_width';

INSERT INTO "FieldMap" ("id", "channel", "channelType", "fieldPath", "bbType", "source", "attributeKey", "unitTarget", "checkedSource", "checkedOn", "reason", "updatedAt")
VALUES
  ('fm_' || md5('amazon:RUG:item_length_width.length:'), 'amazon', 'RUG', 'item_length_width.length', '', 'attribute', 'length', 'centimeters',
   'Amazon listing check 2026-11-20 (RUG: item_length_width takes length and width, each a value and unit)', DATE '2026-11-20',
   'The product''s length, in centimetres', now()),
  ('fm_' || md5('amazon:RUG:item_length_width.width:'), 'amazon', 'RUG', 'item_length_width.width', '', 'attribute', 'width', 'centimeters',
   'Amazon listing check 2026-11-20 (RUG: item_length_width takes length and width, each a value and unit)', DATE '2026-11-20',
   'The product''s width, in centimetres', now())
ON CONFLICT ("channel", "channelType", "fieldPath", "bbType") DO UPDATE SET
  "source" = 'attribute', "attributeKey" = EXCLUDED."attributeKey", "ruleKey" = NULL, "coreKey" = NULL, "shopKey" = NULL, "constant" = NULL,
  "unitTarget" = 'centimeters', "checkedSource" = EXCLUDED."checkedSource", "checkedOn" = EXCLUDED."checkedOn", "reason" = EXCLUDED."reason", "updatedAt" = now();
