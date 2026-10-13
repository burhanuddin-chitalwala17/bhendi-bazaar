-- What Google calls our facts, and which of them it actually requires of this shop
-- (channel-registry D3, D4, D8; ADR-0045, ADR-0046).
--
-- Read off Google's own product data specification, fetched 2026-10-04, not recalled. That
-- mattered: from memory this would have marked `gender`, `age_group` and `size` required for
-- apparel, and the specification says they are required only for products **targeted to Brazil,
-- France, Germany, Japan, the UK and the US**. This shop sells in India, so Google does not ask
-- for any of the three, and a gate built on memory would have told a seller to answer questions
-- nobody asked (ADR-0046 — check the field, not ourselves).
--
-- What it does require, country-independently, is `color` **for free listings on every Apparel &
-- Accessories (166) product**. Six of the eleven nodes this shop maps to sit under 166 — clothing,
-- pants, socks, scarves, rings and handbags — and five do not: perfume, incense, religious items,
-- backpacks and toiletry bags. Hence the same fact being required on some nodes and not others,
-- which is the per-node key doing its job.
--
-- `material` and `pattern` are required only where they distinguish one variant from another, and
-- optional otherwise. Readiness cannot know that from a single product, so they are seeded
-- optional: a warning the shop can act on, never a refusal it cannot (D10).
--
-- Absent on purpose: `condition`, which is a constant until this store sells anything used;
-- `item_group_id`, which is the family and is derived; `gender` and `age_group`, which the
-- audience fact answers in the adapter if a target country ever needs them (D11).
--
-- **Meta is seeded with the same field names and nothing required.** It accepts Google's RSS
-- namespace, so the names carry (docs/INTEGRATIONS.md) — but Meta's own specification has not
-- been read, and claiming to know what it refuses would be the thing the paragraph above exists
-- to avoid. Everything optional means Meta can warn and never reports a product as incomplete,
-- which is honest about what we have checked.

INSERT INTO "ChannelAttributeMap"
  ("id","channel","theirCategory","fact","theirAttribute","required","freeText","checkedOn","checkedSource","updatedAt")
SELECT
  'cam_' || md5(v.channel || ':' || v.their_cat || ':' || v.fact),
  v.channel, v.their_cat, v.fact, v.their_attr,
  -- Meta's requirement levels are unverified, so nothing it carries is marked required.
  v.required AND v.channel = 'google',
  -- All three are free text on Google, and Meta takes the same namespace: there is no list of
  -- theirs to map our answers onto, so an answer they have never seen is still a valid answer.
  true,
  DATE '2026-10-04',
  CASE v.channel
    WHEN 'google' THEN 'Google product data specification, support.google.com/merchants/answer/7052112, fetched 2026-10-04'
    ELSE 'Field names from Google''s RSS namespace, which Meta accepts. Meta''s own specification not yet read, so nothing is marked required.'
  END,
  now()
FROM (
  SELECT c.channel, n.their_cat, f.fact, f.their_attr,
         -- `color` is required for free listings on every Apparel & Accessories product, and on
         -- nothing else here.
         (f.fact = 'colour' AND n.under_apparel) AS required
    FROM (VALUES ('google'), ('meta')) AS c(channel)
   CROSS JOIN (VALUES
     ('1604', true), ('543673', true), ('204', true), ('209', true), ('200', true), ('3032', true),
     ('479', false), ('3686', false), ('97', false), ('100', false), ('108', false)
   ) AS n(their_cat, under_apparel)
   CROSS JOIN (VALUES
     ('colour','color'), ('material','material'), ('pattern','pattern')
   ) AS f(fact, their_attr)
) AS v
ON CONFLICT DO NOTHING;
