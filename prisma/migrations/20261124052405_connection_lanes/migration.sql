-- social-selling meta-foundation unit 3 (TRD A-D9): one lease per (connection, lane), so each account's
-- work runs serially while accounts run in parallel; and two MetaEvent columns: arrival order and a
-- count of retries after a sink was down. Additive: one table, two columns; the pending index is
-- dropped and made again on the new order (an index only: no data is discarded).
-- CreateTable
CREATE TABLE "ConnectionLane" (
    "connectionId" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionLane_pkey" PRIMARY KEY ("connectionId","lane")
);

-- AddForeignKey
ALTER TABLE "ConnectionLane" ADD CONSTRAINT "ConnectionLane_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Arrival order within a second, and outage retries kept apart from poison attempts (ADR-0084).
ALTER TABLE "MetaEvent" ADD COLUMN "seq" BIGSERIAL NOT NULL,
ADD COLUMN "retries" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "MetaEvent_pending_idx";
CREATE INDEX "MetaEvent_pending_idx" ON "MetaEvent"("connectionId", "occurredAt", "seq") WHERE "state" = 'PENDING';
