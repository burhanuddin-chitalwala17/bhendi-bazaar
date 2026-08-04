/**
 * Admin Cart Service (Client-side)
 * Handles API calls for abandoned cart management
 */

import type {
  AbandonedCartFilters,
  AbandonedCartResult,
} from "@/domain/admin";

class AdminCartService {
  async getAbandonedCarts(
    filters: AbandonedCartFilters = {}
  ): Promise<AbandonedCartResult> {
    const params = new URLSearchParams();

    if (filters.minValue) params.append("minValue", String(filters.minValue));
    if (filters.minDays) params.append("minDays", String(filters.minDays));
    if (filters.page) params.append("page", String(filters.page));
    if (filters.limit) params.append("limit", String(filters.limit));
    if (filters.sortBy) params.append("sortBy", filters.sortBy);
    if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

    const response = await fetch(
      `/api/admin/abandoned-carts?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch abandoned carts");
    }

    return response.json();
  }

  async sendReminder(cartId: string): Promise<void> {
    // TODO: Implement email reminder functionality
    console.log(`Sending reminder to ${cartId}`);
    return Promise.resolve();
  }
}

export const adminCartApiClient = new AdminCartService();

