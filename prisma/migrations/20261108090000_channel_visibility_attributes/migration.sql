-- listing-model/channel-catalogue Q8: Google and Meta get every apparel attribute their filters and
-- matching read, so a product is found under "women's", a colour or a size, not only listed.
-- India enforces none of gender, age group or size, so they are asked only where the shop already
-- answers them: gender is the audience answer mapped, age group and size are derived by the adapter.
-- Reference data (CLAUDE.md invariant 7): inserts skip what exists; updates touch only these rows.

-- Google and Meta take Amazon's words for audience: male, female, unisex (Google `gender`, Meta `gender`).
INSERT INTO "ChannelValueMap" ("id", "channel", "list", "valueKey", "theirValue", "checkedOn", "checkedSource", "updatedAt")
SELECT 'cvm_' || md5(c.channel || ':audience:' || v.value_key), c.channel, 'audience', v.value_key, v.their_value,
       DATE '2026-11-08', c.source, now()
FROM (VALUES
  ('google', 'Google Merchant Center product data specification, gender (support.google.com/merchants/answer/6324479), read 2026-11-08'),
  ('meta', 'Meta catalog fields, gender (developers.facebook.com/docs/marketing-api/catalog/reference), read 2026-11-08')
) AS c(channel, source)
CROSS JOIN (VALUES
  ('baby-boys', 'male'), ('baby-boys-baby-girls', 'unisex'), ('baby-girls', 'female'), ('boys', 'male'),
  ('boys-girls', 'unisex'), ('girls', 'female'), ('kids', 'unisex'), ('kids-boys', 'male'), ('kids-girls', 'female'),
  ('men', 'male'), ('men-women', 'unisex'), ('unisex', 'unisex'), ('women', 'female')
) AS v(value_key, their_value)
ON CONFLICT ("channel", "list", "valueKey") DO NOTHING;

-- Gender is the audience answer on every apparel node both channels publish to: one question, asked once.
INSERT INTO "ChannelAttributeMap" ("id", "channel", "theirCategory", "fact", "theirAttribute", "required", "freeText", "checkedOn", "checkedSource", "updatedAt")
SELECT 'cam_' || md5(c.channel || ':' || n.node || ':audience'), c.channel, n.node, 'audience', 'gender', true, false,
       DATE '2026-11-08', 'listing-model/channel-catalogue Q8: sent for visibility in filters and matching; not enforced in India', now()
FROM (VALUES ('google'), ('meta')) AS c(channel)
CROSS JOIN (VALUES ('1604'), ('200'), ('204'), ('209'), ('3032'), ('543673')) AS n(node)
ON CONFLICT ("channel", "theirCategory", "fact") DO NOTHING;

-- Meta's colour on apparel is asked as Google's is: it drives its variant swatches and catalogue ads.
UPDATE "ChannelAttributeMap" SET "required" = true, "checkedOn" = DATE '2026-11-08', "updatedAt" = now()
WHERE "channel" = 'meta' AND "fact" = 'colour' AND "theirCategory" IN ('1604', '200', '204', '209', '3032', '543673');

-- The catalogue says the same: gender and colour required and mapped; age group and size required and derived.
UPDATE "ChannelField" f SET "requirement" = 'required', "adapterFills" = false, "updatedAt" = now()
FROM "ChannelType" t
WHERE f."channelTypeId" = t."id" AND t."channel" IN ('google', 'meta') AND f."key" IN ('gender', 'color')
  AND t."key" IN ('1604', '200', '204', '209', '3032', '543673');

UPDATE "ChannelField" f SET "requirement" = 'required', "adapterFills" = true, "updatedAt" = now()
FROM "ChannelType" t
WHERE f."channelTypeId" = t."id" AND t."channel" IN ('google', 'meta') AND f."key" = 'age_group'
  AND t."key" IN ('1604', '200', '204', '209', '3032', '543673');

UPDATE "ChannelField" f SET "requirement" = 'required', "adapterFills" = true, "updatedAt" = now()
FROM "ChannelType" t
WHERE f."channelTypeId" = t."id" AND t."channel" IN ('google', 'meta') AND f."key" = 'size'
  AND t."key" IN ('1604', '204', '209');
