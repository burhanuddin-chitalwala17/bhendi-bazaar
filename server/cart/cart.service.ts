// src/server/services/cartService.ts

import { cartRepository } from "@server/cart/cart.repository";
import type { CartItem } from "@server/cart/cart.types";
import { prisma, toJsonColumn } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";
import { DomainError } from "@server/shared/domain-error";

/**
 * Cart service - Business logic layer
 * Only uses server-side types and dependencies
 */
export class CartService {
  /**
   * Update user's cart
   */
  async updateCart(
    userId: string,
    items: CartItem[],
    expectedVersion?: number
  ): Promise<{ version: number }> {
    this.validateCartItems(items);

    const cart = await cartRepository.upsert(userId, items, expectedVersion);
    return { version: cart.version };
  }

  /**
   * Sync local cart with server cart on login
   * Uses Prisma transaction for atomicity
   */
  async syncCart(
    userId: string,
    localItems: CartItem[]
  ): Promise<{ items: CartItem[]; version: number }> {
    try {
      // Use Prisma transaction for atomicity
      const mergedItems = await prisma.$transaction(async (tx) => {
        // Fetch remote cart within transaction
        const remoteCart = await tx.cart.findUnique({
          where: { userId },
        });
        const remoteItems = remoteCart?.items
          ? Array.isArray(remoteCart.items)
            ? (remoteCart.items as unknown as CartItem[])
            : []
          : [];

        // Merge carts
        let merged = this.mergeCartItems(localItems, remoteItems);
        // Fetch all products in one query (within transaction)
        const slugs = merged.map((i) => i.productSlug);
        const products = await tx.product.findMany({
          where: { slug: { in: slugs } },
          include: {
            org: {
              select: {
                id: true,
                name: true,
                code: true,
                defaultPincode: true,
                defaultCity: true,
                defaultState: true,
                defaultAddress: true,
              },
            },
          },
        });
        const productMap = new Map(products.map((p) => [p.slug, p]));

        // Filter deleted products and refresh prices + org data
        merged = merged
          .filter((i) => productMap.has(i.productSlug))
          .map((i) => {
            const product = productMap.get(i.productSlug)!;
            return {
              ...i,
              price: product.price,
              salePrice: product.salePrice ?? undefined,
              thumbnail: product.thumbnail,
              // ✨ Add org and shipping info
              shippingFromPincode: product.shippingFromPincode || product.org.defaultPincode,
              org: {
                id: product.org.id,
                name: product.org.name,
                code: product.org.code,
                defaultPincode: product.org.defaultPincode,
                defaultCity: product.org.defaultCity,
                defaultState: product.org.defaultState,
                defaultAddress: product.org.defaultAddress,
              },
            };
          });
        // Save merged cart within transaction
        const saved = await tx.cart.upsert({
          where: { userId },
          update: {
            items: toJsonColumn(merged),
            version: { increment: 1 },
            updatedAt: new Date(),
          },
          create: {
            userId,
            items: toJsonColumn(merged),
            version: 1,
          },
        });

        return { items: merged, version: saved.version };
      });

      return mergedItems;
    } catch (error) {
      console.error("[CartService] syncCart failed:", error);
      // The local cart survives; version 0 tells the client it has no basis to
      // assert one on its next write.
      return { items: localItems, version: 0 };
    }
  }

  /**
   * Clear user's cart
   */
  async clearCart(userId: string): Promise<void> {
    await cartRepository.clear(userId);
  }

  /**
   * Validate cart items
   */
  private validateCartItems(items: CartItem[]): void {
    if (!Array.isArray(items)) {
      throw new DomainError("Cart items must be an array");
    }

    for (const item of items) {
      if (!item.productId) {
        throw new DomainError("Each item must have a productId");
      }
      if (!item.productName) {
        throw new DomainError("Each item must have a productName");
      }
      if (!item.productSlug) {
        throw new DomainError("Each item must have a productSlug");
      }
      if (item.quantity <= 0) {
        throw new DomainError("Item quantity must be positive");
      }
      if (item.price < 0) {
        throw new DomainError("Item price cannot be negative");
      }
    }
  }

  /**
   * Merge cart items
   */
  private mergeCartItems(
    localItems: CartItem[],
    remoteItems: CartItem[]
  ): CartItem[] {
    const mergedMap = new Map<string, Omit<CartItem, "id">>();

    // Add remote items (without ID)
    for (const item of remoteItems) {
      const key = this.getItemKey(item);
      mergedMap.set(key, item);
    }

    // Merge local items
    for (const item of localItems) {
      const key = this.getItemKey(item);
      const existing = mergedMap.get(key);

      if (existing) {
        mergedMap.set(key, {
          ...existing,
          quantity: item.quantity,
        });
      } else {
        mergedMap.set(key, item);
      }
    }

    // Generate fresh IDs for all merged items
    const result = Array.from(mergedMap.values()).map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));

    return result;
  }

  /**
   * Generate unique key for cart item
   */
  private getItemKey(item: CartItem): string {
    return `${item.productId}-${item.size || "default"}-${item.color || "default"
      }`;
  }
}

export const cartService = new CartService();
