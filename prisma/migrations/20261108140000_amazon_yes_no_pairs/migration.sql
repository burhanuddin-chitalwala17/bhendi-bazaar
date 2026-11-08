-- listing-model/field-maps, found by the proof run on a production copy (2026-11-08): Amazon refused
-- "false" for Water Resistance Level, a closed list (HANDBAG schema: Not Water Resistant, Water Resistant,
-- Water Repellent, Waterproof, Moisture Resistant). Our yes/no answer is paired to its words on every Amazon
-- map that reads it. Reference data: inserts only, nothing dropped.
INSERT INTO "FieldValueMap" ("id", "fieldMapId", "optionKey", "channelValue")
SELECT 'fv_' || md5(f."id" || ':' || v.k), f."id", v.k, v.word
FROM "FieldMap" f
CROSS JOIN (VALUES ('true', 'Water Resistant'), ('false', 'Not Water Resistant')) AS v(k, word)
WHERE f."channel" = 'amazon' AND f."fieldPath" = 'water_resistance_level' AND f."attributeKey" = 'waterResistant'
ON CONFLICT ("fieldMapId", "optionKey") DO UPDATE SET "channelValue" = EXCLUDED."channelValue";
