// src/domain/cart.ts

export interface Cart {
  id?: string;
  userId?: string;
  items: CartItem[];
  totals: CartTotals;
  updatedAt: Date;
  version?: number;
}

export interface CartItem {
  weight: number;
  // Identity
  id: string;                    // Unique cart item ID (not product ID)
  productId: string;             // Reference to product
  productSlug: string;           // For navigation

  // Display
  productName: string;           // Name at time of add
  thumbnail: string;             // Primary image

  // Pricing (frozen at add-to-cart time)
  price: number;                 // Original price
  salePrice?: number;            // Sale price if applicable

  // Selection
  quantity: number;              // How many
  size?: string;                 // Selected size
  color?: string;                // Selected color

  // Shipping (for multi-org/warehouse support)
  shippingFromPincode: string;   // Origin pincode
  org: {                      // Minimal org info
    id: string;
    name: string;
    code: string;
    // Include full org info (needed for shipping)
    defaultPincode: string;
    defaultCity: string;
    defaultState: string;
    defaultAddress: string;
  };
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
