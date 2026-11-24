-- social-selling meta-foundation unit 5 (D9, ADR-0085): each shop's data key, wrapped by the platform
-- key ring. Additive: one new table; no DROP.
-- CreateTable
CREATE TABLE "OrgDataKey" (
    "orgId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "OrgDataKey_pkey" PRIMARY KEY ("orgId","version")
);
