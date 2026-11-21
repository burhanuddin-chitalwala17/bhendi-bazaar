-- ai-images/improve-with-ai D1: the STYLED tool, and a styled run's brief, references and the run it regenerates.
-- Additive: an enum value and three nullable or defaulted columns.
-- AlterEnum
ALTER TYPE "EnhancementTool" ADD VALUE 'STYLED';

-- AlterTable
ALTER TABLE "Enhancement" ADD COLUMN     "brief" TEXT,
ADD COLUMN     "previousId" TEXT,
ADD COLUMN     "referenceRefs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "Enhancement" ADD CONSTRAINT "Enhancement_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "Enhancement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

