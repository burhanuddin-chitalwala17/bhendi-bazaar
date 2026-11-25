-- notification-hub/notifications-core unit 1 (D1, D2, D3): the hub's events and deliveries. Additive: two
-- new tables and their indexes; nothing is dropped.
-- CreateTable
CREATE TABLE "NotificationEvent" (
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("eventKey")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "timing" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "providerId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationEvent_createdAt_idx" ON "NotificationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Delivery_at_idx" ON "Delivery"("at");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_eventKey_recipientId_channel_key" ON "Delivery"("eventKey", "recipientId", "channel");

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_eventKey_fkey" FOREIGN KEY ("eventKey") REFERENCES "NotificationEvent"("eventKey") ON DELETE CASCADE ON UPDATE CASCADE;


-- The badge: a member's unread items, read and counted on every portal page (D3).
CREATE INDEX "Delivery_open_badge_idx" ON "Delivery"("recipientId", "at") WHERE "channel" = 'badge' AND "state" = 'PENDING';
