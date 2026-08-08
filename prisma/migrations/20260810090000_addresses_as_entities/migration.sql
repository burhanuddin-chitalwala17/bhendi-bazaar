-- addresses-as-entities: the Profile.addresses blob becomes Address (postal fact) +
-- UserAddress (a person's relationship to one). The blob column survives, read by
-- nothing, until the lift is verified (trd.md D7).
--
-- The lift coalesces across the four shape variants observed in production:
--   fullName | name, mobile | phone, label top-level | metadata.label,
--   notes under metadata. isDefault is deliberately NOT migrated (D3 — no defaults).
-- Two rows missing recipient/phone migrate with '' rather than being dropped; the
-- schema requires those fields on next edit (D5).

CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Address_pincode_idx" ON "Address"("pincode");

CREATE TABLE "UserAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "label" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserAddress_userId_idx" ON "UserAddress"("userId");
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_addressId_fkey"
  FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The lift. Ids are generated per source element in one CTE so the two inserts agree.
WITH src AS (
  SELECT
    p."userId",
    elem,
    gen_random_uuid()::text AS address_id,
    gen_random_uuid()::text AS user_address_id
  FROM "Profile" p,
       LATERAL jsonb_array_elements(p."addresses"::jsonb) AS elem
  WHERE p."addresses" IS NOT NULL
    AND jsonb_typeof(p."addresses"::jsonb) = 'array'
),
lifted_addresses AS (
  INSERT INTO "Address"
    ("id", "addressLine1", "addressLine2", "landmark", "city", "state", "pincode", "country", "createdBy", "createdAt", "updatedAt")
  SELECT
    address_id,
    COALESCE(elem->>'addressLine1', ''),
    elem->>'addressLine2',
    elem->>'landmark',
    COALESCE(elem->>'city', ''),
    COALESCE(elem->>'state', ''),
    COALESCE(elem->>'pincode', ''),
    COALESCE(elem->>'country', 'India'),
    "userId",
    now(), now()
  FROM src
  RETURNING id
)
INSERT INTO "UserAddress"
  ("id", "userId", "addressId", "label", "fullName", "phone", "email", "notes", "createdAt", "updatedAt")
SELECT
  user_address_id,
  "userId",
  address_id,
  COALESCE(elem->>'label', elem->'metadata'->>'label'),
  COALESCE(elem->>'fullName', elem->>'name', ''),
  COALESCE(elem->>'mobile', elem->>'phone', ''),
  elem->>'email',
  elem->'metadata'->>'notes',
  now(), now()
FROM src;
