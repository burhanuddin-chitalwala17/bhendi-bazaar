-- `rida` as a kind of Islamic wear, and a masalla set as a kind of combo.
--
-- Data rather than code, through the path product-types built: a kind is a row's content now, so
-- this is the first change that would otherwise have waited for a release and does not.
--
-- **Rida is a kind, not a type of its own.** It is thirty-five of this store's ninety-four
-- products and its largest line, which argued for a type — but the mapping cost is identical
-- either way, since `(type, kind)` resolves a platform node in both shapes, and the questions are
-- the same. The owner had already been mapping abaya and burqa fields onto rida fields, which
-- settles it: one question set, one more kind.
--
-- The four rida categories — formal, semi-formal, casual, ohbat — stay categories. They are not
-- kinds, because all four hold the same kind and map to the same node; and they need no `style`
-- fact, because neither Flipkart's `abaya-burqa` nor Meesho's `Abayas` asks for one and the
-- category already says it. Recording it on the product would be storing the same fact twice.
UPDATE "ProductType"
   SET "kinds" = '[
         {"key":"rida","label":"Rida"},
         {"key":"abaya","label":"Abaya"},
         {"key":"burqa","label":"Burqa"},
         {"key":"niqab","label":"Niqab"},
         {"key":"hijab","label":"Hijab"},
         {"key":"other","label":"Other Islamic wear"}
       ]'::jsonb
 WHERE "key" = 'islamic-wear';

-- A masalla bag is a handbag and a prayer mat sold together, so it is a combo rather than a bag:
-- mapping it to a bag node would send a buyer a mat they did not read about. Eighteen products
-- here, the second largest line, and they stay typeless until the owner points the category at
-- this type — the kind exists first so that is one click rather than a release.
UPDATE "ProductType"
   SET "kinds" = '[
         {"key":"masalla-set","label":"Masalla bag (bag with prayer mat)"},
         {"key":"prayer-set","label":"Prayer set"},
         {"key":"gift-set","label":"Gift set"}
       ]'::jsonb
 WHERE "key" = 'combo';
