import { readApiError } from "@/lib/api-error";

/** Saving and forgetting a product. The route's 401 is the gate, not the caller. */
export const wishlistApiClient = {
  /** Saving one already saved is a no-op, so this is safe to repeat. */
  async save(productId: string): Promise<void> {
    const response = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ productId }),
    });
    if (!response.ok) throw await readApiError(response);
  },

  async remove(productId: string): Promise<void> {
    const response = await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) throw await readApiError(response);
  },
};
