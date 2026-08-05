// src/server/repositories/cartRepository.ts

import { prisma } from "@server/shared/prisma";
import type { CartItem, ServerCart } from "@server/cart/cart.types";
import type { Prisma } from "@prisma/client";
import { ConflictError } from "@server/shared/domain-error";

/**
 * Cart repository - Data access layer
 * Only uses server-side types and dependencies
 */
export class CartRepository {
  /**
   * Parse JSON cart items from database
   */
  private parseCartItems(items: Prisma.JsonValue): CartItem[] {
    if (!Array.isArray(items)) return [];
    return items as unknown as CartItem[];
  }

  /**
   * Convert CartItem[] to Prisma JsonValue
   */
  private toJsonValue(items: CartItem[]): Prisma.InputJsonValue {
    return items as unknown as Prisma.InputJsonValue;
  }

  /**
   * Find cart by user ID
   */
  async findByUserId(userId: string): Promise<ServerCart | null> {
    try {
      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) return null;

      return {
        id: cart.id,
        userId: cart.userId,
        items: this.parseCartItems(cart.items),
        updatedAt: cart.updatedAt,
      };
    } catch (error) {
      console.error("[CartRepository] findByUserId failed:", error);
      throw new Error("Failed to fetch cart from database", { cause: error });
    }
  }

  /**
   * Create or update cart with version control
   */
  async upsert(
    userId: string,
    items: CartItem[],
    expectedVersion?: number
  ): Promise<ServerCart> {
    try {
      // If version is provided, check for conflicts
      if (expectedVersion !== undefined) {
        const existingCart = await prisma.cart.findUnique({
          where: { userId },
          select: { version: true },
        });

        if (existingCart && existingCart.version !== expectedVersion) {
          throw new ConflictError("Cart was modified by another session. Please refresh and try again.");
        }
      }

      const cart = await prisma.cart.upsert({
        where: { userId },
        update: {
          items: this.toJsonValue(items),
          version: { increment: 1 },
          updatedAt: new Date(),
        },
        create: {
          userId,
          items: this.toJsonValue(items),
          version: 1,
        },
      });

      return {
        id: cart.id,
        userId: cart.userId,
        items: this.parseCartItems(cart.items),
        updatedAt: cart.updatedAt,
      };
    } catch (error) {
      console.error("[CartRepository] upsert failed:", error);
      if (error instanceof Error && error.message.includes("another session")) {
        throw error; // Propagate version conflict
      }
      throw new Error("Failed to save cart to database", { cause: error });
    }
  }

  /**
   * Clear cart items
   */
  async clear(userId: string): Promise<void> {
    try {
      await prisma.cart.update({
        where: { userId },
        data: {
          items: this.toJsonValue([]),
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("[CartRepository] clear failed:", error);
      throw new Error("Failed to clear cart", { cause: error });
    }
  }

  /**
   * Delete cart completely
   */
  async delete(userId: string): Promise<void> {
    try {
      await prisma.cart.delete({
        where: { userId },
      });
    } catch (error) {
      console.error("[CartRepository] delete failed:", error);
      // Ignore if cart doesn't exist
    }
  }
}

export const cartRepository = new CartRepository();