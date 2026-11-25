-- social-selling connect-instagram unit 3 (D3, D4; R6, R7): what the Instagram card shows of the
-- account (its @username and kind), and the message-access facts its checklist is computed from:
-- when the shop said it turned replies on, when the first message arrived, when Meta said access is off.
ALTER TABLE "ChannelConnection"
    ADD COLUMN "externalUsername" TEXT,
    ADD COLUMN "externalAccountKind" TEXT,
    ADD COLUMN "repliesAskedAt" TIMESTAMP(3),
    ADD COLUMN "firstMessageAt" TIMESTAMP(3),
    ADD COLUMN "messagesOffAt" TIMESTAMP(3);
