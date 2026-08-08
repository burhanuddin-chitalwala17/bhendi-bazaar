// src/domain/cart.ts

// The one CartItem, declared in server/cart/cart.types.ts and re-exported here —
// the two sides drifted for months (weight and the org block existed only on this
// side, bridged by casts) until PR-44 made them agree and PR-45 merged them.
import type { CartItem } from "@server/cart/cart.types";
export type { CartItem, OrgSummary } from "@server/cart/cart.types";

export interface Cart {
  id?: string;
  userId?: string;
  items: CartItem[];
  totals: CartTotals;
  updatedAt: Date;
  version?: number;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

// NEW: Service interface for client-side operations
export interface CartService {
  syncCart(localItems: CartItem[]): Promise<CartItem[]>;
  updateCart(items: CartItem[]): Promise<void>;
  clearCart(): Promise<void>;
}
