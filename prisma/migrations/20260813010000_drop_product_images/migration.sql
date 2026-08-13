-- product-video (destructive): the column the cutover stopped reading.
--
-- A product's gallery has one home now ("ProductMedia"), and two sources of truth for
-- one gallery is how a product comes to have two shapes (ADR-0003's reasoning applied
-- to a column). Deliberately separate from 20260813000000_product_media so that
-- migration was reversible by redeploying the previous build.

ALTER TABLE "Product" DROP COLUMN IF EXISTS "images";
