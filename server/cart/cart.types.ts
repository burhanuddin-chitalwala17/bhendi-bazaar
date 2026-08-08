/**
 * Server-side cart domain types.
 *
 * Since order-and-cart-lines, a cart stores only what the buyer chose (CartLineInput);
 * everything else on the wire item — name, price, weight, org — is derived from the
 * product at read time, so a cart can never hold a stale price or a spoofed one.
 */

/** What a write may say about a line. Anything else in the payload is ignored. */
export interface CartLineInput {
  productId: string;
  quantity: number;
  size?: string | null;
  color?: string | null;
}

/** The org block checkout groups parcels by. */
export interface CartItemOrg {
  id: string;
  name: string;
  code: string;
  defaultPincode: string;
  defaultCity: string;
  defaultState: string;
  defaultAddress: string;
}

/** A read line: the stored choice plus everything derived from the product row. */
export interface CartItem {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  thumbnail: string;
  price: number; // paise, current catalogue price
  salePrice?: number; // paise
  quantity: number;
  size?: string;
  color?: string;
  weight: number; // kg
  shippingFromPincode: string;
  org: CartItemOrg;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  total: number;
}

export interface ServerCart {
  id: string;
  userId: string;
  items: CartItem[];
  /** Optimistic-lock version — a stale write is refused, not silently merged over. */
  version: number;
  updatedAt: Date;
}
