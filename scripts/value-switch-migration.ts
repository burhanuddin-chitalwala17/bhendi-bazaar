// Writes the full switch's migration (listing-model/dynamic-form Q16): value rows keep every answer verbatim,
// the sync triggers go, the value functions come, every product moves, and the migration refuses to finish
// if any answer would be lost.
//   npx tsx scripts/value-switch-migration.ts >> prisma/migrations/<stamp>_answers_live_in_values/migration.sql
import { valueSwitchSql } from "./value-switch-sql";

process.stdout.write(`
-- ── The sync triggers go: from here product-value.repository writes values in each write's transaction ────
DROP TRIGGER IF EXISTS "Product_values_sync" ON "Product";
DROP TRIGGER IF EXISTS "Brand_values_sync" ON "Brand";
DROP TRIGGER IF EXISTS "Brand_values_insert" ON "Brand";
DROP TRIGGER IF EXISTS "BrandParty_values_sync" ON "BrandParty";
DROP TRIGGER IF EXISTS "OrgListingDefaults_values_sync" ON "OrgListingDefaults";
DROP TRIGGER IF EXISTS "OrgListingDefaults_values_insert" ON "OrgListingDefaults";
DROP FUNCTION IF EXISTS bb_product_values_on_product(), bb_product_values_on_brand(), bb_product_values_on_brand_party(), bb_product_values_on_defaults();
-- A type's measure unit moving no longer re-derives its products' rows here: the type save asks (Q16).
CREATE OR REPLACE FUNCTION bb_type_attributes_on_type() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM bb_type_attributes_sync(NEW."key");
  RETURN NULL;
END
$fn$;
DROP FUNCTION IF EXISTS bb_sync_product_values(text);
${valueSwitchSql()}
-- ── Every product moves: its facts and measurements, verbatim ──────────────────────────────────────────
DELETE FROM "ProductValue";
SELECT bb_write_answers(p."id", p."facts", p."measurements", p."weight") FROM "Product" p;

-- Nothing lost: every key each product held is a row holding exactly that answer, or the migration fails.
DO $check$
DECLARE
  lost int;
BEGIN
  SELECT count(*) INTO lost FROM (
    SELECT p."id", f.key, f.value, false AS measured FROM "Product" p, jsonb_each(CASE WHEN jsonb_typeof(p."facts") = 'object' THEN p."facts" ELSE '{}'::jsonb END) f
    UNION ALL
    SELECT p."id", m.key, m.value, true FROM "Product" p, jsonb_each(CASE WHEN jsonb_typeof(p."measurements") = 'object' THEN p."measurements" ELSE '{}'::jsonb END) m
  ) held
  WHERE NOT EXISTS (SELECT 1 FROM "ProductValue" v WHERE v."productId" = held."id" AND v."attributeKey" = held.key AND v."measured" = held.measured AND v."answer" = held.value);
  IF lost > 0 THEN RAISE EXCEPTION 'switch would lose % answers; nothing changed', lost; END IF;
END
$check$;
`);
