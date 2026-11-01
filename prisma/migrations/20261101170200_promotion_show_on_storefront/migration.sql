-- storefront-themes U4: a coupon the shop ticked "Show on my shop" (Q20). Additive, default off; no backfill.
-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "showOnStorefront" BOOLEAN NOT NULL DEFAULT false;
