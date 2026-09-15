-- A phone number is contact data, not an identity key (ADR-0024): one number may back any
-- number of accounts. Email stays unique and remains the credential sign-in looks up.

-- Nothing performs an exact lookup on "mobile" any more, and the admin user search is a
-- `contains` scan a btree cannot serve, so the index is dropped rather than made non-unique.
DROP INDEX IF EXISTS "User_mobile_key";

-- phone_numbers_e164 skipped any user whose '+91' spelling was already taken, because this
-- index refused it. Those rows are still bare digits, outside the E.164 every reader assumes.
-- With the constraint gone the skip has no reason to exist, so the backfill is completed here.
UPDATE "User" SET "mobile" = '+91' || "mobile"
WHERE "mobile" ~ '^[0-9]{10}$';

DO $$
DECLARE leftover integer;
BEGIN
  SELECT count(*) FROM "User"
  WHERE "mobile" IS NOT NULL AND "mobile" !~ '^\+[1-9][0-9]{6,14}$'
  INTO leftover;
  RAISE NOTICE 'phone_is_not_an_identity_key: % account phone value(s) left outside E.164 for a person to correct', leftover;
END $$;
