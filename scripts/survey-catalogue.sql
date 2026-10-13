-- A read-only survey of the live catalogue, to plan the listing-vocabulary migration.
--
-- SELECT only: nothing here writes, locks or creates. Run it against production with
--   psql "$(grep -oE '^DATABASE_URL="[^"]+"' .env.production.reference | sed 's/^DATABASE_URL="//; s/"$//')" \
--     -f scripts/survey-catalogue.sql > /tmp/catalogue-survey.txt
-- then hand the output back. It names no customer and prints no credential.

\echo '=== 1. How much is there ==='
SELECT
  (SELECT count(*) FROM "Product")                          AS products,
  (SELECT count(*) FROM "Product" WHERE "archivedAt" IS NULL) AS on_sale,
  (SELECT count(*) FROM "Category")                         AS categories,
  (SELECT count(*) FROM "Org")                              AS orgs;

\echo ''
\echo '=== 2. The category tree, with what hangs off each ==='
SELECT
  c.slug,
  c.name,
  COALESCE(p.name, '(root)')              AS parent,
  count(pr.id)                            AS products,
  count(pr.id) FILTER (WHERE pr."archivedAt" IS NULL) AS on_sale
FROM "Category" c
LEFT JOIN "Category" p ON p.id = c."parentId"
LEFT JOIN "Product" pr ON pr."categoryId" = c.id
GROUP BY c.id, c.slug, c.name, p.name
ORDER BY products DESC, c.name;

\echo ''
\echo '=== 3. What `sizes` actually holds, by category ==='
\echo '    (the column carries four different kinds of thing: garment letters, a capacity,'
\echo '     a physical dimension, and free-size words — each needs a different migration)'
SELECT
  c.name AS category,
  s.value AS size_value,
  count(*) AS products
FROM "Product" pr
JOIN "Category" c ON c.id = pr."categoryId"
CROSS JOIN LATERAL unnest(pr.sizes) AS s(value)
GROUP BY c.name, s.value
ORDER BY c.name, products DESC, s.value;

\echo ''
\echo '=== 4. What `colors` actually holds ==='
\echo '    (whether the new vocabulary knows each word is checked in code, not here: this must'
\echo '     run against a database that has not had the ListingValue migration deployed yet)'
SELECT
  col.value AS colour_value,
  count(*)  AS products,
  string_agg(DISTINCT c.name, ', ') AS categories
FROM "Product" pr
JOIN "Category" c ON c.id = pr."categoryId"
CROSS JOIN LATERAL unnest(pr.colors) AS col(value)
GROUP BY col.value
ORDER BY products DESC, col.value;

\echo ''
\echo '=== 5. The cartesian question: how many products would become how many ==='
SELECT
  c.name AS category,
  count(*) AS products,
  sum(GREATEST(COALESCE(array_length(pr.colors, 1), 1), 1)) AS members_if_colour_is_the_axis,
  sum(GREATEST(COALESCE(array_length(pr.sizes, 1), 1), 1))  AS members_if_size_were_the_axis
FROM "Product" pr
JOIN "Category" c ON c.id = pr."categoryId"
GROUP BY c.name
ORDER BY products DESC;

\echo ''
\echo '=== 6. What a migration would have to carry across (per product) ==='
SELECT
  count(*) FILTER (WHERE array_length(pr.sizes, 1)  > 1) AS more_than_one_size,
  count(*) FILTER (WHERE array_length(pr.colors, 1) > 1) AS more_than_one_colour,
  count(*) FILTER (WHERE array_length(pr.sizes, 1)  > 1
                     AND array_length(pr.colors, 1) > 1) AS both_vary,
  count(*) FILTER (WHERE pr.sku IS NULL)                 AS no_sku,
  count(*) FILTER (WHERE pr.weight IS NULL)              AS no_weight
FROM "Product" pr;

\echo ''
\echo '=== 7. Stock, which is the part that cannot be guessed ==='
\echo '    (one stock number covers every colour today; splitting it is a decision, not a sum)'
SELECT
  count(DISTINCT ps."productId")            AS products_with_stock_rows,
  count(*)                                  AS stock_rows,
  count(DISTINCT ps."orgAddressId")         AS locations,
  sum(ps.quantity)                          AS total_units
FROM "ProductStock" ps;
