/**
 * Admin Cart Service
 * Business logic for abandoned cart management
 */

import { adminCartRepository } from "@server/cart/admin.cart.repository";
import type {
  AbandonedCartFilters,
  AbandonedCartResult,
} from "@server/cart/admin.cart.types";

export class AdminCartService {
  /**
   * Get abandoned carts with filters
   */
  async getAbandonedCarts(
    filters: AbandonedCartFilters
  ): Promise<AbandonedCartResult> {
    const { carts, total, totalValue } =
      await adminCartRepository.getAbandonedCarts(filters);

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const totalPages = Math.ceil(total / limit);

    return {
      carts,
      total,
      page,
      limit,
      totalPages,
      totalValue,
    };
  }
}

export const adminCartService = new AdminCartService();


