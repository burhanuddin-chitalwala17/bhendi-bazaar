/**
 * Admin Cart Repository
 * Handles database operations for abandoned cart tracking
 */

import { prisma } from "@server/shared/prisma";
import { loadPriceContext, resolveProductPrice } from "@server/promotions/price-context";
import type {
  AbandonedCart,
  AbandonedCartFilters,
} from "@server/cart/admin.cart.types";

/** What an abandoned line is worth today, offers included (ADR-0018). */
const offerPriceOf = (
  product: { id: string; price: number; orgId: string; categoryId: string },
  context: Awaited<ReturnType<typeof loadPriceContext>>
): number | undefined => {
  const { pricePaise, offerPricePaise } = resolveProductPrice(product, context);
  return offerPricePaise < pricePaise ? offerPricePaise : undefined;
};

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
        items: {
          include: {
            product: {
              select: { id: true, name: true, slug: true, thumbnail: true, price: true, orgId: true, categoryId: true },
            },
          },
        },
      },
    });

    // Lines are rows since order-and-cart-lines; value is the product's price
    // today — what recovering the cart would actually be worth.
    const context = await loadPriceContext();

    const abandonedCarts: AbandonedCart[] = carts
      .map((cart) => {
        const items = cart.items.map((line) => ({
          productId: line.productId,
          productName: line.product.name,
          productSlug: line.product.slug,
          thumbnail: line.product.thumbnail,
          price: line.product.price,
          salePrice: offerPriceOf(line.product, context),
          quantity: line.quantity,
          size: line.size ?? undefined,
          color: line.color ?? undefined,
        }));
        const itemsCount = items.length;
        const totalValue = items.reduce(
          (sum, item) =>
            sum +
            (item.salePrice && item.salePrice > 0 && item.salePrice < item.price
              ? item.salePrice
              : item.price) *
              item.quantity,
          0
        );

        const daysSinceUpdate = Math.floor(
          (Date.now() - cart.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: cart.id,
          userId: cart.userId,
          userName: cart.user.name,
          userEmail: cart.user.email,
          items,
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


