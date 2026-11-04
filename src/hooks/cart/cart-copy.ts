/** Words for cart/ (ADR-0067): one object per component file, kept byte-identical to what it showed. */

/** useCartSync.ts */
export const USE_CART_SYNC_COPY = {
  failedToSyncYourCart: "Failed to sync your cart with the server",
  yourCartWasUpdatedIn: "Your cart was updated in another tab — merged.",
  localCartSafe: "Your local cart is still safe. We'll retry when you're back online.",
} as const;
