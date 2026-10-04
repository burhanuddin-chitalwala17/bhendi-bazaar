-- Combos sell on this store only — the owner's call on 2026-10-04, now written down.
--
-- It was already true and already acted on: no channel carries a category for `combo`, so nothing
-- publishes one. What was missing is the difference between having decided and not having got to
-- it, and without that the register listed 18 masalla bags among the work still to do. A to-do
-- list that keeps naming a settled question is a list that stops being read.
--
-- One row per publishable channel, with `kind` null so it covers gift, prayer and masalla sets
-- alike. Reversible from the register: clearing a row puts the type back among the undecided,
-- with the choice still to make — and on Flipkart that choice is real work, because it has no
-- combo node and a masalla set would have to list under whatever dominates the bag.

INSERT INTO "ChannelCategoryMap"
  ("id","channel","productType","kind","theirCategory","notSold","fit","note","checkedOn","checkedSource","updatedAt")
SELECT
  'ccm_' || md5(c.channel || ':combo:*'),
  c.channel, 'combo', NULL, NULL, true, 'EXACT',
  'Sold on this store only. Owner''s call, 2026-10-04.',
  DATE '2026-10-04', 'Decided in the channel register: not sold here', now()
FROM (VALUES ('google'), ('meta'), ('amazon'), ('flipkart'), ('meesho')) AS c(channel)
WHERE EXISTS (SELECT 1 FROM "ProductType" WHERE key = 'combo')
ON CONFLICT DO NOTHING;
