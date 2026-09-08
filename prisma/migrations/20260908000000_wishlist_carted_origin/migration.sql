-- Records that a saved product was carted after being opened from the wishlist, so a
-- confirmed payment can clear that wish and leave an identical product bought from
-- anywhere else alone. Nullable: every existing row predates the distinction, and NULL
-- is the safe answer — it keeps the item rather than removing one the buyer still wants.
ALTER TABLE "WishlistItem" ADD COLUMN "cartedFromWishlistAt" TIMESTAMP(3);
