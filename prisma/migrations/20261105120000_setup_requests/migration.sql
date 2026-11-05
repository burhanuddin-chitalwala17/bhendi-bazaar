-- setup-requests (D2, D3, D6): tickets keyed by what fixes them, each shop's need beside it, and
-- the attribute fills a type needs where no fact answers. Three new tables; nothing existing changes.
-- A fill carries exactly one of source or constant.

-- CreateTable
CREATE TABLE "ChannelAttributeFill" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "theirCategory" TEXT NOT NULL,
    "theirAttribute" TEXT NOT NULL,
    "source" TEXT,
    "constant" TEXT,
    "checkedOn" TIMESTAMP(3) NOT NULL,
    "checkedSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAttributeFill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "subject" JSONB NOT NULL,
    "closedReason" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketNeed" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL DEFAULT '',
    "detail" JSONB,
    "category" TEXT,
    "words" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "TicketNeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAttributeFill_channel_theirCategory_theirAttribute_key" ON "ChannelAttributeFill"("channel", "theirCategory", "theirAttribute");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_key_key" ON "Ticket"("key");

-- CreateIndex
CREATE INDEX "Ticket_status_type_idx" ON "Ticket"("status", "type");

-- CreateIndex
CREATE INDEX "TicketNeed_orgId_idx" ON "TicketNeed"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketNeed_ticketId_orgId_productId_key" ON "TicketNeed"("ticketId", "orgId", "productId");

-- AddForeignKey
ALTER TABLE "TicketNeed" ADD CONSTRAINT "TicketNeed_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketNeed" ADD CONSTRAINT "TicketNeed_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "ChannelAttributeFill" ADD CONSTRAINT "ChannelAttributeFill_source_xor_constant"
  CHECK (("source" IS NULL) <> ("constant" IS NULL));
