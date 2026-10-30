-- org-profile unit 2: Shop details, buyer part (docs/specs/own-store/org-profile/trd.md D4, D6).
-- Additive only. No stored text is rewritten and nothing is dropped: `story`, `pillars`,
-- `deliveryPolicy` and `returnsPolicy` keep their data (expand step of expand-and-contract).

CREATE TYPE "ReturnsPreset" AS ENUM ('STANDARD', 'EXCHANGE_7_DAY', 'NO_RETURNS');

ALTER TABLE "OrgProfile"
    ADD COLUMN "storyMergedAt" TIMESTAMP(3),
    ADD COLUMN "returnsPreset" "ReturnsPreset" NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN "promiseNote" TEXT;
