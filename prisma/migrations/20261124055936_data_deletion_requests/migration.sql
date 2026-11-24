-- social-selling meta-foundation unit 4 (R7, D7): data deletion requests made through Meta. Additive:
-- one new table; no DROP.
-- CreateTable
CREATE TABLE "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "userIdHash" TEXT NOT NULL,
    "sealedUserId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataDeletionRequest_code_key" ON "DataDeletionRequest"("code");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_userIdHash_idx" ON "DataDeletionRequest"("userIdHash");
