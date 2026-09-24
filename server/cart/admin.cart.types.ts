/**
 * Admin Cart Management Domain Types
 */

export interface AbandonedCartItem {
  productId: string;
  productName: string;
  productSlug: string;
  thumbnail: string;
  price: number; // paise, current catalogue price
  salePrice?: number;
  /**
   * What this line is actually worth — `salePrice` when an offer beats the list price, else
   * `price`. Carried on the item rather than re-derived by each caller: the console's dialog
   * used `price` while the cart total used the offer, so the lines did not sum to the total
   * shown beneath them ([ADR-0018](../../docs/adr/0018-one-effective-price-function.md)).
   */
  effectivePrice: number;
  quantity: number;
  size?: string;
  color?: string;
}

export interface AbandonedCart {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  items: AbandonedCartItem[];
  itemsCount: number;
  totalValue: number;
  createdAt: Date;
  updatedAt: Date;
  daysSinceUpdate: number;
}

export interface AbandonedCartFilters {
  minValue?: number;
  minDays?: number; // Minimum days since last update
  page?: number;
  limit?: number;
  /**
   * `totalValue` is deliberately absent: a cart's value is summed in JavaScript from its items
   * (`admin.cart.repository.ts`), so no `orderBy` can serve it — and sorting a page of
   * already-fetched rows would order the page rather than the result. It was declared here and
   * reached Prisma as an unknown argument until 2026-09-24. Same shape as `totalSpent` on users;
   * serving either properly needs a denormalised column.
   */
  sortBy?: "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface AbandonedCartResult {
  carts: AbandonedCart[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalValue: number; // Sum of all abandoned cart values
}


