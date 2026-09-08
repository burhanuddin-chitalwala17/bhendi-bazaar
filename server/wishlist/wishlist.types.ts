/**
 * Server-side wishlist domain types.
 *
 * A saved product stores only the fact that it was saved — `(wishlist, product)` and
 * when. Every display field below is derived from the product row at read time, the
 * same rule cart lines follow since order-and-cart-lines, so a wishlist can never
 * show a price the catalogue has moved past.
 */

/** A saved product, resolved for display. */
export interface WishlistProduct {
  /** The WishlistItem row id. */
  id: string;
  productId: string;
  slug: string;
  name: string;
  thumbnail: string;
  /** Paise (Invariant 3) — the catalogue list price. */
  price: number;
  /** Paise. Present only when an offer beats the list price (ADR-0018). */
  salePrice?: number;
  stock: number;
  lowStockThreshold: number;
  savedAt: Date;
}
