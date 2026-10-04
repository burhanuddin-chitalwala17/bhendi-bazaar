-- The two columns this phase replaced, and the two that depended on them.
--
-- `Product.sizes` and `Product.colors` were free text: a colour typed three ways was three
-- colours to a marketplace. They are replaced by the listing vocabulary — a colour is chosen
-- from a list and stored by its key, and a size is *derived* from stored measurements rather
-- than typed ([listing-vocabulary](../../docs/specs/listing-vocabulary/)).
--
-- Dropped in a **later** migration than the one that replaced them, which is
-- [variants](../../docs/specs/listing-vocabulary/variants/) D8: if the new shape had read
-- something wrong, the old data was still there to re-read. Nothing has read either column since
-- the product form and the bulk sheet stopped offering them.
--
-- `BiddingEvent.size` and `.color` go with them. They existed for one rule — an event names
-- exactly one item, so a product with options could not be auctioned without saying which — and
-- the rule is obsolete rather than broken: every colour is its own product with its own stock
-- now, so "a product with options" no longer exists. Kept, the columns would have been two
-- fields nothing could ever fill. The owner confirmed on 2026-10-04 that production holds no
-- bidding events, so nothing recorded is lost.

/*
  Warnings:

  - You are about to drop the column `color` on the `BiddingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `BiddingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `colors` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `sizes` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BiddingEvent" DROP COLUMN "color",
DROP COLUMN "size";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "colors",
DROP COLUMN "sizes";
