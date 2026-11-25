-- social-selling inbox-core unit 1 (D1, D2; A-D12, A-D14): conversations and their messages, fed by the
-- inbox's sinks, with bodies and previews sealed under each shop's key. Additive only: two new tables;
-- no DROP. Each table's changeSeq has its own sequence, taken afresh on every write (decisions Q17).
-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "threadKey" TEXT NOT NULL,
    "personKey" TEXT NOT NULL,
    "personName" TEXT,
    "personHandle" TEXT,
    "personPhone" TEXT,
    "postRef" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "lastInboundAt" TIMESTAMP(3),
    "lastPreviewSealed" TEXT,
    "lastMessageKind" TEXT,
    "unread" BOOLEAN NOT NULL DEFAULT false,
    "needsYou" BOOLEAN NOT NULL DEFAULT false,
    "needsYouReason" TEXT,
    "autoAnswered" BOOLEAN NOT NULL DEFAULT false,
    "sortRank" INTEGER NOT NULL DEFAULT 1,
    "botPausedUntil" TIMESTAMP(3),
    "window" JSONB,
    "changeSeq" BIGSERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "memberId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "bodySealed" TEXT,
    "attachmentRef" TEXT,
    "refersTo" TEXT,
    "platformMessageId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "state" TEXT,
    "sendAfter" TIMESTAMP(3),
    "errorCode" TEXT,
    "sentAt" TIMESTAMP(3),
    "changeSeq" BIGSERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_orgId_platform_sortRank_lastMessageAt_id_idx" ON "Conversation"("orgId", "platform", "sortRank", "lastMessageAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Conversation_orgId_changeSeq_idx" ON "Conversation"("orgId", "changeSeq");

-- CreateIndex
CREATE INDEX "Conversation_connectionId_idx" ON "Conversation"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_orgId_platform_threadKey_key" ON "Conversation"("orgId", "platform", "threadKey");

-- CreateIndex
CREATE UNIQUE INDEX "Message_dedupeKey_key" ON "Message"("dedupeKey");

-- CreateIndex
CREATE INDEX "Message_conversationId_sentAt_id_idx" ON "Message"("conversationId", "sentAt", "id");

-- CreateIndex
CREATE INDEX "Message_orgId_platformMessageId_idx" ON "Message"("orgId", "platformMessageId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The list's counts and search (D4, D8): partial-index counts per shop and platform, never stored
-- counters; a name prefix search on the lowered name.
CREATE INDEX "Conversation_needs_you_idx" ON "Conversation"("orgId", "platform") WHERE "needsYou";
CREATE INDEX "Conversation_unread_idx" ON "Conversation"("orgId", "platform") WHERE "unread";
CREATE INDEX "Conversation_person_name_idx" ON "Conversation"("orgId", lower("personName") text_pattern_ops);

-- The held-send sweep (D6) reads only held rows by when they fall due.
CREATE INDEX "Message_held_idx" ON "Message"("state", "sendAfter") WHERE "state" = 'HELD';
