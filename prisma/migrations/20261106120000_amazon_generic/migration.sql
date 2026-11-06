-- setup-requests Q35: a shop whose brand is not on Amazon lists there as "Generic". One column,
-- off for every existing shop, so nothing changes until a shop turns it on. Nothing dropped.
ALTER TABLE "OrgListingDefaults" ADD COLUMN "amazonGeneric" BOOLEAN NOT NULL DEFAULT false;
