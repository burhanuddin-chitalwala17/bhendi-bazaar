-- inventory-sync D5, Q9: each count the daily check put back, for the shop to see. Adds a table only;
-- drops nothing.

CREATE TABLE "StockCorrection" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "theirs" INTEGER NOT NULL,
    "ours" INTEGER NOT NULL,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockCorrection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockCorrection_counts_check" CHECK ("theirs" >= 0 AND "ours" >= 0)
);

CREATE INDEX "StockCorrection_connectionId_correctedAt_idx" ON "StockCorrection"("connectionId", "correctedAt");
