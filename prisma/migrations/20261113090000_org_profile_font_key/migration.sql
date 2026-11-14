-- storefront-font D3: a shop's heading-face key, published with its look and kept for Switch back.
-- Additive and nullable: null is the theme's own face, so no row needs a value. Nothing is dropped.
ALTER TABLE "OrgProfile" ADD COLUMN "fontKey" TEXT;
ALTER TABLE "OrgProfile" ADD COLUMN "previousFontKey" TEXT;
