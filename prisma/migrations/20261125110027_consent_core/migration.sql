-- social-selling/consent-core unit 1 (D1): contacts per shop, the append-only consent log and its
-- current-state projection. New tables only; nothing dropped.
-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bsuid" TEXT,
    "phoneE164" TEXT,
    "name" TEXT,
    "nameSource" TEXT,
    "email" TEXT,
    "language" TEXT NOT NULL DEFAULT 'EN',
    "source" TEXT NOT NULL,
    "firstOfferAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "change" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "contactId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "sourceEventId" TEXT NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("contactId","sender","channel")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_orgId_bsuid_key" ON "Contact"("orgId", "bsuid");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_orgId_phoneE164_key" ON "Contact"("orgId", "phoneE164");

-- CreateIndex
CREATE INDEX "ConsentEvent_contactId_at_idx" ON "ConsentEvent"("contactId", "at");

-- CreateIndex
CREATE INDEX "Consent_sender_channel_state_idx" ON "Consent"("sender", "channel", "state");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "ConsentEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The Audience page's search by name (D1 indexes).
CREATE INDEX "Contact_orgId_lower_name_idx" ON "Contact"("orgId", lower("name"));

-- Closed sets the projection is read by: a stray value would answer `may` wrongly.
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_closed_sets_check" CHECK (
    "channel" IN ('WHATSAPP', 'EMAIL') AND "change" IN ('OPT_IN', 'STOP')
);
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_closed_sets_check" CHECK (
    "channel" IN ('WHATSAPP', 'EMAIL') AND "state" IN ('OPTED_IN', 'STOPPED')
);
