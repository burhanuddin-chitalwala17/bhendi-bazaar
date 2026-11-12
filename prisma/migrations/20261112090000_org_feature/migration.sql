-- subscriptions/feature-access D1, D3: what each shop may use of the paid features. Created empty:
-- an absent row is locked, so every shop but the home brand starts locked (Q14, Q15). Nothing dropped.
CREATE TABLE "OrgFeature" (
    "orgId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgFeature_pkey" PRIMARY KEY ("orgId","feature")
);

CREATE INDEX "OrgFeature_feature_enabled_idx" ON "OrgFeature"("feature", "enabled");

ALTER TABLE "OrgFeature" ADD CONSTRAINT "OrgFeature_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrgFeature" ADD CONSTRAINT "OrgFeature_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
