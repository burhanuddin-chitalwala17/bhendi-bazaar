-- Handbag silhouette (Amazon's quality warning on the same listing, "missing key attribute"): from the bag's
-- kind, each paired to Amazon's nearest shape (its closed list: baguette … wristlet). A handbag carried by its
-- handles is a satchel and an open tote a bucket in Amazon's words; a backpack never lists as HANDBAG.
INSERT INTO "FieldMap" ("id", "channel", "channelType", "fieldPath", "bbType", "source", "coreKey", "checkedSource", "checkedOn", "reason", "updatedAt")
VALUES ('fm_' || md5('amazon:HANDBAG:handbag_silhouette:'), 'amazon', 'HANDBAG', 'handbag_silhouette', '', 'core', 'kind',
  'Amazon listing check 2026-11-09 (HANDBAG schema: handbag_silhouette enum baguette…wristlet)', DATE '2026-11-09',
  'The bag''s kind, as Amazon''s nearest silhouette', now())
ON CONFLICT ("channel", "channelType", "fieldPath", "bbType") DO NOTHING;
INSERT INTO "FieldValueMap" ("id", "fieldMapId", "optionKey", "channelValue")
SELECT 'fv_' || md5(f."id" || ':' || v.k), f."id", v.k, v.code
FROM "FieldMap" f CROSS JOIN (VALUES ('handbag', 'satchel'), ('tote', 'bucket'), ('sling', 'sling'), ('messenger', 'messenger')) AS v(k, code)
WHERE f."channel" = 'amazon' AND f."channelType" = 'HANDBAG' AND f."fieldPath" = 'handbag_silhouette'
ON CONFLICT ("fieldMapId", "optionKey") DO NOTHING;
