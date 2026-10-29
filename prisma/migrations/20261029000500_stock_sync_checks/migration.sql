-- inventory-sync review fixes. Adds columns and swaps one foreign key's delete rule; drops no data.

-- The order check claims each connection it checks, so a second chain of checks finds nothing and
-- stops (inventory-sync Q23). The last problem a send met is the section's line (D7).
ALTER TABLE "ChannelConnection"
    ADD COLUMN "ordersCheckedAt" TIMESTAMP(3),
    ADD COLUMN "stockProblem" TEXT,
    ADD CONSTRAINT "ChannelConnection_stock_problem_check" CHECK ("stockProblem" IS NULL OR "stockProblem" IN ('busy', 'refused'));

-- A deleted shop location leaves its marketplace location unmatched, to be matched again, rather
-- than refusing the delete.
ALTER TABLE "ChannelLocation" DROP CONSTRAINT "ChannelLocation_orgAddressId_fkey";
ALTER TABLE "ChannelLocation" ADD CONSTRAINT "ChannelLocation_orgAddressId_fkey" FOREIGN KEY ("orgAddressId") REFERENCES "OrgAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A sale from before stock sync was on is recorded without taking stock: the shop's count already
-- reflects it (inventory-sync Q24).
ALTER TABLE "MarketplaceOrder" ADD COLUMN "beforeSync" BOOLEAN NOT NULL DEFAULT false;
