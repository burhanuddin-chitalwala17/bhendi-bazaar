// src/services/cartApiClient.ts

import type { CartItem } from "@/domain/cart";
import { toast } from "sonner";

/**
 * Client-side cart service
 * Only uses client-side types
 * Communicates with server via HTTP (no direct imports)
 */
export class CartApiClient {
  private baseUrl = "/api/cart";

  async syncCart(localItems: CartItem[]): Promise<CartItem[]> {
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
      return data.items as CartItem[];
    } catch (error) {
      console.error("[CartApiClient] syncCart failed:", error);
      toast.error("Failed to sync your cart with the server", {
        description:
          "Your local cart is still safe. We'll retry when you're back online.",
      });
      return localItems;
    }
  }

  async updateCart(items: CartItem[]): Promise<void> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to update cart: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error("[CartApiClient] updateCart failed:", error);
      const message =
        error instanceof Error ? error.message : "Failed to update cart";

      // Show user-friendly error
      if (message.includes("offline") || message.includes("network")) {
        toast.error("You're offline", {
          description:
            "Your cart changes are saved locally and will sync when you're back online.",
        });
      } else {
        toast.error("Failed to save cart", {
          description:
            "Your changes are saved locally. We'll try to sync again shortly.",
        });
      }

      // Re-throw for retry logic
      throw error;
    }
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