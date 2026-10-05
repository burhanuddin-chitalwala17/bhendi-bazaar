import { apiRequest } from "@/lib/api-client";

/** Saving and forgetting a product. The route's 401 is the gate, not the caller. */
export const wishlistApiClient = {
  /** Saving one already saved is a no-op, so this is safe to repeat. */
  async save(productId: string): Promise<void> {
    await apiRequest("/api/wishlist", { method: "POST", body: { productId } });
  },

  async remove(productId: string): Promise<void> {
    await apiRequest(`/api/wishlist?productId=${encodeURIComponent(productId)}`, { method: "DELETE" });
  },
};
