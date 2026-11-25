-- social-selling/inbox-core unit 3: sending with a hold (D6). Additive: one column, one index, one
-- foreign key (decisions Q18: memberId gains its key now that a member's send writes it). Nothing dropped.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "sendAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Message_memberId_idx" ON "Message"("memberId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
