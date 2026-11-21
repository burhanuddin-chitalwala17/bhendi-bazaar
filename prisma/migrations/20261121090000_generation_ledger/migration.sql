-- ai-images/generation-foundation D6, D7: one row per model call, and one exchange rate per day.
-- Additive only: two new tables and an enum; nothing existing is altered or dropped.
-- CreateEnum
CREATE TYPE "GenerationState" AS ENUM ('SUBMITTED', 'SUCCEEDED', 'FAILED', 'REFUSED');

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "modelId" TEXT,
    "state" "GenerationState" NOT NULL DEFAULT 'SUBMITTED',
    "promptVersion" TEXT NOT NULL,
    "platformPrompt" TEXT NOT NULL,
    "brief" TEXT,
    "referenceAssetIds" TEXT[],
    "aspect" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "costPaise" INTEGER NOT NULL DEFAULT 0,
    "rateDay" DATE,
    "outputKeys" TEXT[],
    "synthetic" BOOLEAN NOT NULL DEFAULT true,
    "containsPerson" BOOLEAN NOT NULL DEFAULT false,
    "retriedAfterUnknown" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "enhancementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "day" DATE NOT NULL,
    "paisePerUsd" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE UNIQUE INDEX "Generation_idempotencyKey_key" ON "Generation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Generation_enhancementId_idx" ON "Generation"("enhancementId");

-- CreateIndex
CREATE INDEX "Generation_createdAt_idx" ON "Generation"("createdAt");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_enhancementId_fkey" FOREIGN KEY ("enhancementId") REFERENCES "Enhancement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

