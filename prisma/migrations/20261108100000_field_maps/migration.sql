-- listing-model/field-maps (D1, Q7, Q8): where each channel field's value comes from, and our answers in
-- each channel's words. Two new tables; nothing existing changes.

-- CreateTable
CREATE TABLE "FieldMap" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "bbType" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "attributeKey" TEXT,
    "ruleKey" TEXT,
    "coreKey" TEXT,
    "shopKey" TEXT,
    "constant" TEXT,
    "unitTarget" TEXT,
    "checkedSource" TEXT NOT NULL,
    "checkedOn" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldValueMap" (
    "id" TEXT NOT NULL,
    "fieldMapId" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "channelValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldValueMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FieldMap_channel_channelType_fieldPath_bbType_key" ON "FieldMap"("channel", "channelType", "fieldPath", "bbType");

-- CreateIndex
CREATE UNIQUE INDEX "FieldValueMap_fieldMapId_optionKey_key" ON "FieldValueMap"("fieldMapId", "optionKey");

-- AddForeignKey
ALTER TABLE "FieldValueMap" ADD CONSTRAINT "FieldValueMap_fieldMapId_fkey" FOREIGN KEY ("fieldMapId") REFERENCES "FieldMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

