// src/server/domain/cart.ts

/**
 * Server-side cart domain types
 * COMPLETELY INDEPENDENT - No client imports!
 */


export interface CartItem {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  thumbnail: string;
  price: number;
  salePrice?: number;
  quantity: number;
  size?: string;
  color?: string;
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
  updatedAt: Date;
}