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
        version: cart.version,
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
    // With a version, the staleness check IS the where clause (ADR-0007) — the
    // previous read-then-compare could pass for two tabs at once, which is the exact
    // silent overwrite the version exists to prevent (inventory-reservation R7).
    if (expectedVersion !== undefined) {
      const updated = await prisma.cart.updateMany({
        where: { userId, version: expectedVersion },
        data: { items: this.toJsonValue(items), version: { increment: 1 } },
      });
      if (updated.count === 0) {
        const existing = await prisma.cart.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictError(
            "Your cart changed in another tab or on another device. It has been refreshed — please review it."
          );
        }
        // No cart yet: the version was optimistic about a row that does not exist.
      } else {
        const cart = await prisma.cart.findUniqueOrThrow({ where: { userId } });
        return {
          id: cart.id,
          userId: cart.userId,
          items: this.parseCartItems(cart.items),
          version: cart.version,
          updatedAt: cart.updatedAt,
        };
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
      version: cart.version,
      updatedAt: cart.updatedAt,
    };
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