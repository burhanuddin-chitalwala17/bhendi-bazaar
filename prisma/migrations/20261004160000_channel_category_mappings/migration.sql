-- Where each product type and kind is listed on Flipkart, Google and Meta
-- (channel-registry D3, D4, D12; ADR-0045).
--
-- Reference data, so a data migration rather than the seed, for the reason the listing values
-- give: `prisma/seed.ts` is dev-only and deletes every table, while `vercel.json` runs
-- `prisma migrate deploy` before every build (Invariant 7). Without these the register is empty
-- and every product reads as having nowhere to go.
--
-- Google and Meta carry the same values because Meta accepts `google_product_category`. They are
-- two sets of rows rather than one shared set because they are two channels that agree today and
-- already disagree elsewhere — Google writes `in_stock`, Meta `in stock` — so the duplication is
-- what lets one move without the other, with no code change (ADR-0045).
--
-- Combos are deliberately absent: the owner's call on 2026-10-04 is that gift, prayer and masalla
-- sets sell on this store only. A product type with no row reads as having nowhere to go, which
-- is the truth rather than a gap.
--
-- `fit` is EXACT only where the channel has its own word for the same thing. Everything else is
-- NEAREST with a note, shown on every product it affects rather than approved once (D6, D12).

WITH mapping(channel, ptype, kind, their_cat, their_label, fit, note, src) AS (VALUES
  -- ── Google, and Meta beneath it ────────────────────────────────────────────────────────────
  -- Node ids and paths from Google's published taxonomy, fetched 2026-10-04.
  ('google','islamic-wear',NULL::text,'1604','Apparel & Accessories > Clothing','NEAREST',
   'Google has no node for Islamic outerwear. Clothing is the nearest parent; Dresses (2271) is one level deeper if ad delivery suffers. Owner chose clothing over religious items on 2026-10-04.','google'),
  ('google','islamic-wear','hijab','543673','Apparel & Accessories > Clothing Accessories > Scarves & Shawls > Scarves','EXACT',NULL,'google'),
  ('google','fragrance','attar','479','Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne','EXACT',NULL,'google'),
  ('google','fragrance','bakhoor','3686','Home & Garden > Decor > Home Fragrances > Incense','NEAREST',
   'Bakhoor is burned like incense but bought as a fragrance, and Google has no node for it. Owner chose incense on 2026-10-04.','google'),
  ('google','fragrance','incense','3686','Home & Garden > Decor > Home Fragrances > Incense','EXACT',NULL,'google'),
  ('google','prayer-mat',NULL,'97','Religious & Ceremonial > Religious Items','NEAREST',
   'Religious Items has no prayer-mat child, so this is its generic parent; Rugs (598) is the specific alternative. Owner chose religious items on 2026-10-04.','google'),
  ('google','jewellery',NULL,'200','Apparel & Accessories > Jewelry > Rings','EXACT',NULL,'google'),
  ('google','socks',NULL,'209','Apparel & Accessories > Clothing > Underwear & Socks > Socks','EXACT',NULL,'google'),
  ('google','trousers',NULL,'204','Apparel & Accessories > Clothing > Pants','EXACT',NULL,'google'),
  ('google','bag',NULL,'3032','Apparel & Accessories > Handbags, Wallets & Cases > Handbags','EXACT',NULL,'google'),
  ('google','bag','backpack','100','Luggage & Bags > Backpacks','EXACT',NULL,'google'),
  ('google','travel-pouch',NULL,'108','Luggage & Bags > Cosmetic & Toiletry Bags','EXACT',NULL,'google'),

  -- ── Flipkart ───────────────────────────────────────────────────────────────────────────────
  -- Node slugs from the category template workbooks downloaded on 2026-10-01.
  ('flipkart','islamic-wear',NULL,'abaya-burqa','Abaya & Burqa','NEAREST',
   'Flipkart has one node for the whole type; its mandatory Type field carries Abaya, Burqa and Naqab.','flipkart'),
  ('flipkart','islamic-wear','abaya','abaya-burqa','Abaya & Burqa','EXACT',NULL,'flipkart'),
  ('flipkart','islamic-wear','burqa','abaya-burqa','Abaya & Burqa','EXACT',NULL,'flipkart'),
  ('flipkart','islamic-wear','rida','abaya-burqa','Abaya & Burqa','NEAREST',
   'Flipkart has no rida node. Listed as an abaya, which is where buyers look. Owner''s call, 2026-10-04.','flipkart'),
  ('flipkart','fragrance','attar','attar','Attar','NEAREST',
   'Node slug inferred: Flipkart has an attar category but its template was never downloaded, so neither the slug nor its required fields are verified. Replace when the sheet is obtained.','guess'),
  ('flipkart','fragrance','bakhoor','incense-stick','Incense Sticks','NEAREST',
   'Flipkart''s incense Type offers only Bricks, Sticks and Stones; bakhoor is listed as Incense Bricks.','flipkart'),
  ('flipkart','fragrance','incense','incense-stick','Incense Sticks','EXACT',NULL,'flipkart'),
  ('flipkart','prayer-mat',NULL,'mat','Mat','EXACT',NULL,'flipkart'),
  ('flipkart','jewellery',NULL,'ring','Ring','EXACT',NULL,'flipkart'),
  ('flipkart','socks',NULL,'sock','Socks','EXACT',NULL,'flipkart'),
  ('flipkart','trousers',NULL,'trouser','Trousers','EXACT',NULL,'flipkart'),
  ('flipkart','trousers','palazzo','trouser','Trousers','EXACT',NULL,'flipkart'),
  ('flipkart','trousers','salwar','salwar','Salwar','EXACT',NULL,'flipkart'),
  ('flipkart','bag',NULL,'bag','Bag','EXACT',NULL,'flipkart'),
  ('flipkart','bag','sling','sling-bag','Sling Bag','EXACT',NULL,'flipkart'),
  ('flipkart','bag','messenger','hand-messenger-bag','Hand & Messenger Bag','EXACT',NULL,'flipkart'),
  ('flipkart','bag','backpack','bag','Bag','NEAREST','No backpack node among the sheets obtained.','flipkart'),
  ('flipkart','bag','tote','bag','Bag','NEAREST','No tote node among the sheets obtained.','flipkart'),
  ('flipkart','travel-pouch',NULL,'travel-pouch','Travel Pouch','EXACT',NULL,'flipkart'),
  ('flipkart','travel-pouch','toiletry-kit','travel-toiletry-kit','Travel Toiletry Kit','EXACT',NULL,'flipkart')
),
-- Meta accepts `google_product_category`, so it carries Google's values. Two sets of rows rather
-- than one shared set: they are two channels that agree today and already disagree on values, so
-- the duplication is what lets one move without the other and without code (ADR-0045).
with_meta AS (
  SELECT * FROM mapping
  UNION ALL
  SELECT 'meta', ptype, kind, their_cat, their_label, fit, note, src
    FROM mapping WHERE channel = 'google'
)
INSERT INTO "ChannelCategoryMap"
  ("id","channel","productType","kind","theirCategory","theirLabel","fit","note","checkedOn","checkedSource","updatedAt")
SELECT
  'ccm_' || md5(channel || ':' || ptype || ':' || coalesce(kind, '*')),
  channel, ptype, kind, their_cat, their_label, fit::"ChannelMapFit", note,
  DATE '2026-10-04',
  CASE src
    WHEN 'google'   THEN 'Google product taxonomy, taxonomy-with-ids.en-US.txt, fetched 2026-10-04'
    WHEN 'flipkart' THEN 'Flipkart category templates, listing-node-templates/flipkart/, downloaded 2026-10-01'
    ELSE 'Inferred. No template obtained.'
  END,
  now()
FROM with_meta
-- No target: one clause then covers both the plain unique index and the partial one that carries
-- the catch-all rows, which NULLs keep out of the first.
ON CONFLICT DO NOTHING;
