-- social-selling inbox-core unit 4 (D5, D9, D10; decisions Q19-Q21): the waiting event's once-per-spell
-- guard, the account a thread is with (for retention), and the shop's support shares and their open log.
-- Additive only: two columns, two new tables; no DROP.
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "accountRef" TEXT,
ADD COLUMN     "waitingEmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupportGrant" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SealAccess" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "who" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SealAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_platform_personKey_idx" ON "Conversation"("platform", "personKey");

-- CreateIndex
CREATE INDEX "SupportGrant_conversationId_expiresAt_idx" ON "SupportGrant"("conversationId", "expiresAt");

-- CreateIndex
CREATE INDEX "SupportGrant_orgId_createdAt_idx" ON "SupportGrant"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "SealAccess_orgId_at_id_idx" ON "SealAccess"("orgId", "at" DESC, "id");

-- AddForeignKey
ALTER TABLE "SupportGrant" ADD CONSTRAINT "SupportGrant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The waiting sweep (D5): threads not yet told about, oldest waiting first.
CREATE INDEX "Conversation_waiting_due_idx" ON "Conversation"("lastInboundAt") WHERE "waitingEmittedAt" IS NULL AND ("needsYou" OR "unread");
