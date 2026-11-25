-- ai-images/social-posts unit 3 (D4, ADR-0087): text joins the generation ledger, and a drafted
-- caption records the prices it stated. Nothing dropped; Generation's shape and size become optional.
ALTER TABLE "Generation" ALTER COLUMN "aspect" DROP NOT NULL,
ALTER COLUMN "size" DROP NOT NULL,
ADD COLUMN "outputText" TEXT;

-- CreateTable
CREATE TABLE "CaptionDraft" (
    "postId" TEXT NOT NULL,
    "productIds" TEXT[],
    "pricesPaise" INTEGER[],
    "effectivePricesPaise" INTEGER[],
    "factsHash" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "generationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptionDraft_pkey" PRIMARY KEY ("postId"),
    CONSTRAINT "CaptionDraft_language_check" CHECK ("language" IN ('en', 'hi', 'both'))
);

-- AddForeignKey
ALTER TABLE "CaptionDraft" ADD CONSTRAINT "CaptionDraft_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
