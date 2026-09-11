-- Phones are E.164 from here on (docs/specs/international-phone/trd.md D2, D5). Every earlier input
-- took only a bare 10-digit Indian number, so +91 is exact; Order.address is a snapshot, left untouched.

-- A user whose +91 spelling already belongs to another account is skipped, not failed on:
-- that is a duplicate account for a person to resolve, and it must not block the deploy.
UPDATE "User" SET "mobile" = '+91' || "mobile"
WHERE "mobile" ~ '^[0-9]{10}$'
  AND NOT EXISTS (SELECT 1 FROM "User" taken WHERE taken."mobile" = '+91' || "User"."mobile");

UPDATE "UserAddress" SET "phone" = '+91' || "phone"
WHERE "phone" ~ '^[0-9]{10}$';

UPDATE "OrgAddress" SET "contactPhone" = '+91' || "contactPhone"
WHERE "contactPhone" ~ '^[0-9]{10}$';

UPDATE "Org" SET "phone" = '+91' || "phone"
WHERE "phone" ~ '^[0-9]{10}$';

UPDATE "Bid" SET "guestPhone" = '+91' || "guestPhone"
WHERE "guestPhone" ~ '^[0-9]{10}$';

DO $$
DECLARE leftover integer;
BEGIN
  SELECT
    (SELECT count(*) FROM "User" WHERE "mobile" IS NOT NULL AND "mobile" !~ '^\+[1-9][0-9]{6,14}$')
  + (SELECT count(*) FROM "UserAddress" WHERE "phone" !~ '^\+[1-9][0-9]{6,14}$')
  + (SELECT count(*) FROM "OrgAddress" WHERE "contactPhone" <> '' AND "contactPhone" !~ '^\+[1-9][0-9]{6,14}$')
  + (SELECT count(*) FROM "Org" WHERE "phone" IS NOT NULL AND "phone" <> '' AND "phone" !~ '^\+[1-9][0-9]{6,14}$')
  + (SELECT count(*) FROM "Bid" WHERE "guestPhone" IS NOT NULL AND "guestPhone" !~ '^\+[1-9][0-9]{6,14}$')
  INTO leftover;
  RAISE NOTICE 'phone_numbers_e164: % phone value(s) left outside E.164 for a person to correct', leftover;
END $$;
