-- notification-hub/notifications-core unit 3 (D4): a member's morning-email switch, and the index the
-- morning run reads. Additive: one new table and one partial index; nothing is dropped.
-- CreateTable
CREATE TABLE "MemberNotificationPrefs" (
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "morningEmail" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberNotificationPrefs_pkey" PRIMARY KEY ("orgId","userId")
);

-- The morning email: what still waits for it, read once a day (D4).
CREATE INDEX "Delivery_open_digest_idx" ON "Delivery"("recipientId") WHERE "timing" = 'DIGEST' AND "state" = 'PENDING';
