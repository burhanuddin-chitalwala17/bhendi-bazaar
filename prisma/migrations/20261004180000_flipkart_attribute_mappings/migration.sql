-- What Flipkart calls each of our facts, per node, and which it refuses a listing without
-- (channel-registry D3, D4, D8; ADR-0045).
--
-- Derived from the twelve category template workbooks downloaded on 2026-10-01, not typed: the
-- field name and its requirement level are read off each node's own sheet, so a mapping cannot
-- say Flipkart asks something it does not. `required` is true where the workbook marks the field
-- mandatory — which Flipkart encodes as a cell colour, decoded against the legend each workbook
-- carries (docs/INTEGRATIONS.md).
--
-- Keyed by **their** node rather than our product type, because the field set belongs to the
-- node: `bag` asks Number of Compartments and Waterproof, `sling-bag` has neither field, and
-- both are our `bag` type.
--
-- `material` is one question they ask cloth as "Fabric" and everything else as "Material" — the
-- split the templates showed and the reason a fact can carry a different name per node.
--
-- **What is deliberately absent.** Thirty-three fields Flipkart marks mandatory have no fact of
-- ours, and none of them belongs here:
--   * Derived by the adapter, never asked of a shop (D11) — `Type` in eleven nodes, which the
--     product's kind already answers; `Size` and `Brand Size`, which come from the stored
--     measurements; every Height, Width, Depth and Measuring Unit companion.
--   * Channel extras the shop cannot answer by looking at the product (ADR-0042) — `With Hijab`,
--     `Features`, `Suitable For`, `Brand Color`, the five Diamond grades, `Pearl Type`,
--     `Silver Weight`, the kids' age bands. These belong to the Flipkart adapter's own schema.
-- Neither group is a gap. A fact is admitted because a shop can answer it, never because a
-- platform asks ([ADR-0047](../../docs/adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)).

INSERT INTO "ChannelAttributeMap"
  ("id","channel","theirCategory","fact","theirAttribute","required","checkedOn","checkedSource","updatedAt")
SELECT
  'cam_' || md5(v.channel || ':' || v.their_cat || ':' || v.fact),
  v.channel, v.their_cat, v.fact, v.their_attr, v.required,
  DATE '2026-10-04',
  'Flipkart category templates, listing-node-templates/flipkart/, downloaded 2026-10-01',
  now()
FROM (VALUES
  ('flipkart','abaya-burqa','colour','Color',true),
  ('flipkart','abaya-burqa','pattern','Pattern',false),
  ('flipkart','abaya-burqa','material','Fabric',true),
  ('flipkart','abaya-burqa','audience','Ideal For',true),
  ('flipkart','abaya-burqa','contents','Items Included',true),
  ('flipkart','bag','colour','Color',true),
  ('flipkart','bag','material','Material',false),
  ('flipkart','bag','audience','Ideal For',true),
  ('flipkart','bag','compartments','Number of Compartments',true),
  ('flipkart','bag','waterResistant','Waterproof',true),
  ('flipkart','hand-messenger-bag','colour','Color',true),
  ('flipkart','hand-messenger-bag','material','Material',true),
  ('flipkart','hand-messenger-bag','audience','Ideal For',true),
  ('flipkart','hand-messenger-bag','occasion','Occasion',true),
  ('flipkart','hand-messenger-bag','closure','Closure',true),
  ('flipkart','incense-stick','scentFamily','Fragrance',true),
  ('flipkart','mat','colour','Color',true),
  ('flipkart','mat','pattern','Pattern',true),
  ('flipkart','mat','material','Material',true),
  ('flipkart','mat','packQuantity','Pack of',true),
  ('flipkart','ring','colour','Color',true),
  ('flipkart','ring','packQuantity','Pack of',true),
  ('flipkart','ring','audience','Ideal For',true),
  ('flipkart','ring','fit','Fit',true),
  ('flipkart','ring','baseMaterial','Base Material',true),
  ('flipkart','ring','certification','Certification',true),
  ('flipkart','ring','gemstone','Gemstone',true),
  ('flipkart','ring','plating','Plating',true),
  ('flipkart','ring','purity','Silver Purity',true),
  ('flipkart','salwar','colour','Color',true),
  ('flipkart','salwar','pattern','Pattern',true),
  ('flipkart','salwar','material','Fabric',true),
  ('flipkart','salwar','audience','Ideal For',true),
  ('flipkart','salwar','occasion','Occasion',false),
  ('flipkart','salwar','contents','Items Included',true),
  ('flipkart','sling-bag','colour','Color',true),
  ('flipkart','sling-bag','material','Material',true),
  ('flipkart','sling-bag','packQuantity','Pack of',true),
  ('flipkart','sling-bag','audience','Ideal For',true),
  ('flipkart','sling-bag','occasion','Occasion',true),
  ('flipkart','sock','colour','Color',true),
  ('flipkart','sock','pattern','Pattern',false),
  ('flipkart','sock','material','Fabric',true),
  ('flipkart','sock','packQuantity','Pack of',true),
  ('flipkart','sock','audience','Ideal For',true),
  ('flipkart','travel-pouch','colour','Color',true),
  ('flipkart','travel-pouch','material','Material',true),
  ('flipkart','travel-pouch','audience','Ideal For',false),
  ('flipkart','travel-toiletry-kit','colour','Color',true),
  ('flipkart','travel-toiletry-kit','audience','Ideal For',true),
  ('flipkart','travel-toiletry-kit','compartments','Number of Compartments',true),
  ('flipkart','trouser','colour','Color',true),
  ('flipkart','trouser','pattern','Pattern',true),
  ('flipkart','trouser','material','Fabric',true),
  ('flipkart','trouser','packQuantity','Pack of',true),
  ('flipkart','trouser','audience','Ideal For',true),
  ('flipkart','trouser','occasion','Occasion',true),
  ('flipkart','trouser','fit','Fit',true),
  ('flipkart','trouser','waistRise','Rise',false),
  ('flipkart','trouser','surfaceStyling','Surface Styling',false)
) AS v(channel, their_cat, fact, their_attr, required)
ON CONFLICT DO NOTHING;
