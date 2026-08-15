-- Drop `Product.salePrice` (promotions D9, ADR-0018 decision 4).
--
-- Safe only because the migration before this one copied every valid markdown into an
-- equivalent offer, and every read path now resolves prices through the offer engine.
-- Run in this order: markdowns become offers, then the column goes.
--
-- Deliberately irreversible in the down direction — a column restored empty would look
-- like "nothing is on sale" rather than like missing data, which is the worse failure.
-- The offers carry the information now.

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "salePrice";

