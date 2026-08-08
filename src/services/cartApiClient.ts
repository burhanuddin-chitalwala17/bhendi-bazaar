// src/services/cartApiClient.ts

import type { CartItem } from "@/domain/cart";
import { toast } from "sonner";
import { readApiError } from "@/lib/api-error";

/**
 * Client-side cart service
 * Only uses client-side types
 * Communicates with server via HTTP (no direct imports)
 */
export class CartApiClient {
  private baseUrl = "/api/cart";

  async syncCart(
    localItems: CartItem[]
  ): Promise<{ items: CartItem[]; version: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ items: localItems }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync cart: ${response.statusText}`);
      }

      const data = await response.json();
      return { items: data.items as CartItem[], version: (data.version as number) ?? 0 };
    } catch (error) {
      console.error("[CartApiClient] syncCart failed:", error);
      toast.error("Failed to sync your cart with the server", {
        description:
          "Your local cart is still safe. We'll retry when you're back online.",
      });
      return { items: localItems, version: 0 };
    }
  }

  /**
   * Persist the cart. Sends the version this write is based on; a 409 means another
   * tab or device wrote first — the caller re-syncs and merges rather than
   * overwriting (inventory-reservation R7).
   */
  async updateCart(items: CartItem[], version?: number): Promise<{ version: number }> {
    const response = await fetch(this.baseUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ items, version }),
    });
    if (!response.ok) throw await readApiError(response);
    return response.json();
  }


  async clearCart(): Promise<void> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to clear cart: ${response.statusText}`);
      }
    } catch (error) {
      console.error("[CartApiClient] clearCart failed:", error);
      toast.error("Failed to clear cart on server", {
        description:
          "Your local cart is cleared. Server sync will happen next time.",
      });
      throw error;
    }
  }
}

export const cartApiClient = new CartApiClient();