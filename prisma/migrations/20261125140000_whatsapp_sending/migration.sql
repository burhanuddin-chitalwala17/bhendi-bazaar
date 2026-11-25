-- social-selling/whatsapp-sending unit 1 (D1, D4, D6; A-D13): messaging settings, monthly spend, the send
-- rows the port writes and the marketing touches the how-often rule counts. New tables only; nothing dropped.
-- CreateTable
CREATE TABLE "MessagingSettings" (
    "orgId" TEXT NOT NULL,
    "limitPaise" INTEGER,
    "limitSetAt" TIMESTAMP(3),
    "hours" JSONB NOT NULL,
    "howOftenDay" INTEGER NOT NULL DEFAULT 1,
    "howOftenWeek" INTEGER NOT NULL DEFAULT 4,
    "greetingDelaySeconds" INTEGER NOT NULL DEFAULT 30,
    "botPauseHours" INTEGER NOT NULL DEFAULT 12,
    "alertsPerProductPerDay" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingSettings_pkey" PRIMARY KEY ("orgId")
);

-- CreateTable
CREATE TABLE "MessagingSpend" (
    "orgId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "reservedPaise" INTEGER NOT NULL DEFAULT 0,
    "spentPaise" INTEGER NOT NULL DEFAULT 0,
    "limitNoticeAt" TIMESTAMP(3),

    CONSTRAINT "MessagingSpend_pkey" PRIMARY KEY ("orgId","month")
);

-- CreateTable
CREATE TABLE "WhatsAppSend" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "purpose" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reason" TEXT,
    "estimatePaise" INTEGER NOT NULL DEFAULT 0,
    "actualPaise" INTEGER,
    "spendMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingTouch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,

    CONSTRAINT "MarketingTouch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppSend_orgId_state_createdAt_idx" ON "WhatsAppSend"("orgId", "state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSend_orgId_idempotencyKey_key" ON "WhatsAppSend"("orgId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketingTouch_orgId_contactId_at_idx" ON "MarketingTouch"("orgId", "contactId", "at");

-- AddForeignKey
ALTER TABLE "MessagingSettings" ADD CONSTRAINT "MessagingSettings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingSpend" ADD CONSTRAINT "MessagingSpend_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppSend" ADD CONSTRAINT "WhatsAppSend_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppSend" ADD CONSTRAINT "WhatsAppSend_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTouch" ADD CONSTRAINT "MarketingTouch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTouch" ADD CONSTRAINT "MarketingTouch_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Money is never negative, and the port's reservation guard reads these sums (Invariant 3).
ALTER TABLE "MessagingSpend" ADD CONSTRAINT "MessagingSpend_amounts_check" CHECK (
    "reservedPaise" >= 0 AND "spentPaise" >= 0
);
ALTER TABLE "MessagingSettings" ADD CONSTRAINT "MessagingSettings_limit_check" CHECK (
    "limitPaise" IS NULL OR "limitPaise" >= 10000
);

-- Closed sets the send job and the how-often count read by.
ALTER TABLE "WhatsAppSend" ADD CONSTRAINT "WhatsAppSend_closed_sets_check" CHECK (
    "state" IN ('HELD', 'QUEUED', 'CLAIMED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'UNCERTAIN', 'SKIPPED')
    AND "purpose" IN ('MARKETING', 'UTILITY')
    AND "language" IN ('EN', 'HI')
    AND "estimatePaise" >= 0 AND ("actualPaise" IS NULL OR "actualPaise" >= 0)
);
ALTER TABLE "MarketingTouch" ADD CONSTRAINT "MarketingTouch_channel_check" CHECK (
    "channel" IN ('WHATSAPP', 'EMAIL')
);
