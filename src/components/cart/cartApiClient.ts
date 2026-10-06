import { apiRequest } from "@/lib/api-client";
import type { CartItem } from "@/domain/cart";

/** The signed-in buyer's server cart. */
export const cartApiClient = {
  /** Merge this device's lines into the server cart; resolves to the merged cart. */
  async syncCart(localItems: CartItem[]): Promise<{ items: CartItem[]; version: number }> {
    const data = await apiRequest<{ items: CartItem[]; version?: number }>("/api/cart/sync", {
      method: "POST",
      body: { items: localItems },
    });
    return { items: data.items, version: data.version ?? 0 };
  },

  /**
   * Persist the cart. Sends the version this write is based on; a 409 means another
   * tab or device wrote first — the caller re-syncs and merges rather than
   * overwriting (inventory-reservation R7).
   */
  updateCart(items: CartItem[], version?: number): Promise<{ version: number }> {
    return apiRequest("/api/cart", { method: "PUT", body: { items, version } });
  },

  clearCart(): Promise<void> {
    return apiRequest("/api/cart", { method: "DELETE" });
  },
};
