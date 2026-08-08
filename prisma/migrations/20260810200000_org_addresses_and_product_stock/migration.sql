-- stock-locations PR 3 (additive): OrgAddress (pickup locations) + ProductStock
-- (quantity per location) + Shipment.orgAddressId. Nothing reads these yet; the
-- cutover PR flips reads and re-points the stock guard. Org.default* and
-- Product.stock/shippingFrom* remain authoritative until the destructive PR.

CREATE TABLE "OrgAddress" (
  "id"           TEXT NOT NULL,
  "orgId"        TEXT NOT NULL,
  "addressId"    TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "contactName"  TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "providerRef"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrgAddress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrgAddress_orgId_idx" ON "OrgAddress"("orgId");
-- Restrict both ways: R8 belongs to the database, not a service check (D9).
ALTER TABLE "OrgAddress" ADD CONSTRAINT "OrgAddress_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrgAddress" ADD CONSTRAINT "OrgAddress_addressId_fkey"
  FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductStock" (
  "productId"    TEXT NOT NULL,
  "orgAddressId" TEXT NOT NULL,
  "quantity"     INTEGER NOT NULL,
  CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("productId", "orgAddressId")
);
CREATE INDEX "ProductStock_orgAddressId_idx" ON "ProductStock"("orgAddressId");
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_orgAddressId_fkey"
  FOREIGN KEY ("orgAddressId") REFERENCES "OrgAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Shipment" ADD COLUMN "orgAddressId" TEXT;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orgAddressId_fkey"
  FOREIGN KEY ("orgAddressId") REFERENCES "OrgAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill (TRD data-model table): one location per org from Org.default*, one more
-- per distinct product origin override, one ProductStock row per product at its
-- resolved location carrying today's Product.stock. Deterministic ids so the script
-- is re-runnable in dev. Overridden origins arrive with only a pincode, a city and
-- a label — no street line, no contact — so those rows are created with '' and a
-- human completes them before real courier booking exists (acknowledged in the TRD).
DO $$
DECLARE
  org_locations integer;
  override_locations integer;
  stock_rows integer;
BEGIN
  -- 1. The shop itself, from the org's default columns.
  INSERT INTO "Address" ("id", "addressLine1", "city", "state", "pincode", "country", "createdAt", "updatedAt")
  SELECT 'adr_' || md5('org-default:' || o."id"),
         COALESCE(o."defaultAddress", ''),
         o."defaultCity", o."defaultState", o."defaultPincode", 'India',
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM "Org" o
  ON CONFLICT ("id") DO NOTHING;

  WITH ins AS (
    INSERT INTO "OrgAddress" ("id", "orgId", "addressId", "name", "contactName", "contactPhone", "createdAt", "updatedAt")
    SELECT 'oa_' || md5('org-default:' || o."id"),
           o."id",
           'adr_' || md5('org-default:' || o."id"),
           'Primary pickup',
           COALESCE(o."contactPerson", ''),
           COALESCE(o."phone", ''),
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "Org" o
    ON CONFLICT ("id") DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO org_locations FROM ins;

  -- 2. One location per distinct overridden origin. Pincode and city are the
  --    product's; the state is the org's — the very mismatch this feature retires,
  --    recorded as found rather than guessed at (empty street line marks it).
  CREATE TEMP TABLE "_overrides" ON COMMIT DROP AS
  SELECT DISTINCT
    p."orgId",
    p."shippingFromPincode" AS pincode,
    COALESCE(NULLIF(p."shippingFromCity", ''), o."defaultCity") AS city,
    o."defaultState" AS state,
    COALESCE(NULLIF(p."shippingFromLocation", ''), 'Warehouse ' || p."shippingFromPincode") AS name
  FROM "Product" p
  JOIN "Org" o ON o."id" = p."orgId"
  WHERE p."shippingFromPincode" IS NOT NULL
    AND p."shippingFromPincode" <> ''
    AND p."shippingFromPincode" <> o."defaultPincode";

  INSERT INTO "Address" ("id", "addressLine1", "city", "state", "pincode", "country", "createdAt", "updatedAt")
  SELECT 'adr_' || md5('override:' || v."orgId" || ':' || v.pincode),
         '', v.city, v.state, v.pincode, 'India', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM "_overrides" v
  ON CONFLICT ("id") DO NOTHING;

  WITH ins AS (
    INSERT INTO "OrgAddress" ("id", "orgId", "addressId", "name", "contactName", "contactPhone", "createdAt", "updatedAt")
    SELECT 'oa_' || md5('override:' || v."orgId" || ':' || v.pincode),
           v."orgId",
           'adr_' || md5('override:' || v."orgId" || ':' || v.pincode),
           v.name, '', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "_overrides" v
    ON CONFLICT ("id") DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO override_locations FROM ins;

  -- 3. Every product's stock, at its resolved location (override else primary).
  WITH ins AS (
    INSERT INTO "ProductStock" ("productId", "orgAddressId", "quantity")
    SELECT p."id",
           CASE
             WHEN p."shippingFromPincode" IS NOT NULL
              AND p."shippingFromPincode" <> ''
              AND p."shippingFromPincode" <> o."defaultPincode"
             THEN 'oa_' || md5('override:' || p."orgId" || ':' || p."shippingFromPincode")
             ELSE 'oa_' || md5('org-default:' || p."orgId")
           END,
           p."stock"
    FROM "Product" p
    JOIN "Org" o ON o."id" = p."orgId"
    ON CONFLICT ("productId", "orgAddressId") DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO stock_rows FROM ins;

  RAISE NOTICE 'stock-locations backfill: % org locations, % override locations, % stock rows',
    org_locations, override_locations, stock_rows;
END $$;
