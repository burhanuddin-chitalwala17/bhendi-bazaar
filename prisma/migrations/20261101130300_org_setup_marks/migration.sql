-- seller-onboarding unit 3: Home's setup list (docs/specs/own-store/seller-onboarding/trd.md D6, Q23).
-- Additive: two nullable columns, no backfill. Drops and rewrites nothing.
ALTER TABLE "Org" ADD COLUMN "setupHiddenAt" TIMESTAMP(3);
ALTER TABLE "Org" ADD COLUMN "firstSharedAt" TIMESTAMP(3);
