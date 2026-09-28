-- The platform's two numbers, as one row addressed by a constant id. No foreign key: they belong
-- to the platform, not to anything in the tree, and the primary key's default is what makes a
-- second row impossible to write by accident.
CREATE TABLE "EnhancementSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "defaultMonthlyAllowance" INTEGER NOT NULL,
    "dailyCapPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnhancementSettings_pkey" PRIMARY KEY ("id")
);

-- An org's row now records a deviation from the platform's default rather than a copy of it:
-- null is "whatever the platform says". Widening, so every existing row stays valid.
ALTER TABLE "OrgEnhancementPolicy" ALTER COLUMN "monthlyAllowance" DROP NOT NULL;
