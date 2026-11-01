-- storefront-themes U6 (D13): when the content was last saved, so "Changed by {Name}" names the editor only when theirs was the last save. Additive only.
ALTER TABLE "OrgProfile" ADD COLUMN "contentEditedAt" TIMESTAMP(3);
