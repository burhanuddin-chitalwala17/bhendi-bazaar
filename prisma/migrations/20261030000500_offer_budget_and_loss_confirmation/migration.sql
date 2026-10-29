-- offers-hardening D5, D6 (R4, own-store Q20): a platform offer's budget, what it has spent,
-- and who confirmed it may run at a loss. Additive; existing offers get no budget and spent 0,
-- so no pre-check query is needed.

ALTER TABLE "Promotion" ADD COLUMN     "lossConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "lossConfirmedByUserId" TEXT,
ADD COLUMN     "platformBudgetPaise" INTEGER,
ADD COLUMN     "platformSpentPaise" INTEGER NOT NULL DEFAULT 0;

-- Restrict, like Settlement.createdBy: the record of who accepted a loss outlives nothing.
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_lossConfirmedByUserId_fkey" FOREIGN KEY ("lossConfirmedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The conditional spend write is the guard; these are its backstop (D10's pattern).
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_budget_positive"
  CHECK ("platformBudgetPaise" IS NULL OR "platformBudgetPaise" > 0);

ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_spent_within_budget"
  CHECK ("platformSpentPaise" >= 0
     AND ("platformBudgetPaise" IS NULL OR "platformSpentPaise" <= "platformBudgetPaise"));

-- What each attribution charged the budget, so expiry releases exactly that (D5).
ALTER TABLE "OrderDiscount" ADD COLUMN "budgetChargedPaise" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_budget_charged_non_negative"
  CHECK ("budgetChargedPaise" >= 0);
