-- notification-hub/notifications-core unit 2 (D6, Q15): parcel notices move onto the hub. Every `Notice` row
-- is copied first, as one event and its one email delivery keeping the notice's id, its address and its sent
-- state, so a send job queued before this runs finds its row and nothing is sent twice. Whose data the DROP
-- discards: none. Confirmed on 2026-11-25 against a disposable database (TRD D6, which the owner accepted): every
-- Notice column is carried into the event or its delivery above, so nothing recorded is lost.

-- One transaction, Notice locked: a row the old code writes mid-deploy waits, then is refused by the drop, never lost unseen.
BEGIN;
LOCK TABLE "Notice" IN EXCLUSIVE MODE;

-- AlterTable
ALTER TABLE "NotificationEvent" ADD COLUMN     "shipmentId" TEXT;

-- CreateIndex
CREATE INDEX "NotificationEvent_shipmentId_kind_idx" ON "NotificationEvent"("shipmentId", "kind");

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: the event key is notice.service's `parcelNoticeKey`; the audience maps NOTICE_AUDIENCE to the hub's.
INSERT INTO "NotificationEvent" ("eventKey", "kind", "audience", "orgId", "facts", "shipmentId", "createdAt")
SELECT 'notice:' || n."shipmentId" || ':' || n."kind" || ':' || n."audience" || ':' || n."ref",
       n."kind",
       CASE n."audience" WHEN 'shop' THEN 'SHOP_INBOX' WHEN 'admin' THEN 'STAFF_INBOX' WHEN 'buyer' THEN 'BUYER' END,
       s."orgId",
       n."data",
       n."shipmentId",
       n."createdAt"
FROM "Notice" n
JOIN "Shipment" s ON s."id" = n."shipmentId";

INSERT INTO "Delivery" ("id", "eventKey", "recipientId", "channel", "timing", "state", "at")
SELECT n."id",
       'notice:' || n."shipmentId" || ':' || n."kind" || ':' || n."audience" || ':' || n."ref",
       n."recipient",
       'email',
       'AT_ONCE',
       CASE WHEN n."sentAt" IS NULL THEN 'PENDING' ELSE 'SENT' END,
       COALESCE(n."sentAt", n."createdAt")
FROM "Notice" n;

-- DropForeignKey
ALTER TABLE "Notice" DROP CONSTRAINT "Notice_shipmentId_fkey";

-- DropTable
DROP TABLE "Notice";

COMMIT;
