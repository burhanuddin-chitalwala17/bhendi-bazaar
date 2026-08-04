/**
 * Admin Cart Repository
 * Handles database operations for abandoned cart tracking
 */

import { prisma } from "@server/shared/prisma";
import type {
  AbandonedCart,
  AbandonedCartFilters,
} from "@server/cart/admin.cart.types";

export class AdminCartRepository {
  /**
   * Get abandoned carts with filters
   */
  async getAbandonedCarts(filters: AbandonedCartFilters) {
    const {
      minValue = 0,
      minDays = 1,
      page = 1,
      limit = 20,
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = filters;

    const skip = (page - 1) * limit;

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - minDays);

    const carts = await prisma.cart.findMany({
      where: {
        updatedAt: {
          lte: dateThreshold,
        },
      },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Transform and filter
    const abandonedCarts: AbandonedCart[] = carts
      .map((cart) => {
        const items = cart.items as any[];
        const itemsCount = items.length;
        const totalValue = items.reduce((sum, item) => {
          return sum + (item.price || 0) * (item.quantity || 0);
        }, 0);

        const daysSinceUpdate = Math.floor(
          (Date.now() - cart.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: cart.id,
          userId: cart.userId,
          userName: cart.user.name,
          userEmail: cart.user.email,
          items: cart.items,
          itemsCount,
          totalValue,
          createdAt: cart.createdAt,
          updatedAt: cart.updatedAt,
          daysSinceUpdate,
        };
      })
      .filter((cart) => cart.totalValue >= minValue);

    const totalValue = abandonedCarts.reduce(
      (sum, cart) => sum + cart.totalValue,
      0
    );

    return {
      carts: abandonedCarts,
      total: abandonedCarts.length,
      totalValue,
    };
  }
}

export const adminCartRepository = new AdminCartRepository();


