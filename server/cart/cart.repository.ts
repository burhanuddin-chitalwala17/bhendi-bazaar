import { prisma } from "@server/shared/prisma";
import type { CartItem, CartLineInput, ServerCart } from "@server/cart/cart.types";
import { ConflictError } from "@server/shared/domain-error";

/**
 * Cart repository — the only place `prisma.cart` / `prisma.cartItem` are touched
 * (ADR-0003). Lines are rows since order-and-cart-lines: a write persists only the
 * buyer's choice; a read derives display fields and prices from the product join.
 */

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        include: {
          stockLocations: {
            where: { orgAddress: { isActive: true } },
            select: {
              quantity: true,
              orgAddress: { select: { address: { select: { pincode: true } } } },
            },
          },
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
      },
    },
  },
} as const;

interface CartLineRow {
  id: string;
  quantity: number;
  size: string | null;
  color: string | null;
  product: {
    id: string;
    slug: string;
    name: string;
    thumbnail: string;
    price: number;
    salePrice: number | null;
    weight: number | null;
    shippingFromPincode: string | null;
    stockLocations: Array<{ quantity: number; orgAddress: { address: { pincode: string } } }>;
    org: Omit<CartItem["org"], "defaultAddress"> & { defaultAddress: string | null };
  };
}

/** Exported for tests: the stored choice plus everything the product row answers for. */
export function toWireCartItem(row: CartLineRow): CartItem {
  return {
    id: row.id,
    productId: row.product.id,
    productSlug: row.product.slug,
    productName: row.product.name,
    thumbnail: row.product.thumbnail,
    price: row.product.price,
    salePrice: row.product.salePrice ?? undefined,
    quantity: row.quantity,
    size: row.size ?? undefined,
    color: row.color ?? undefined,
    weight: row.product.weight ?? 0,
    // Indicative origin only — allocation picks the real one at checkout.
    shippingFromPincode:
      [...row.product.stockLocations].sort((a, b) => b.quantity - a.quantity)[0]?.orgAddress
        .address.pincode ||
      row.product.shippingFromPincode ||
      row.product.org.defaultPincode,
    org: { ...row.product.org, defaultAddress: row.product.org.defaultAddress ?? "" },
  };
}

type CartRow = {
  id: string;
  userId: string;
  version: number;
  updatedAt: Date;
  items: CartLineRow[];
};

function toServerCart(cart: CartRow): ServerCart {
  return {
    id: cart.id,
    userId: cart.userId,
    items: cart.items.map(toWireCartItem),
    version: cart.version,
    updatedAt: cart.updatedAt,
  };
}

/** Whitelist the line fields a write may set — the payload carries more (Invariant 4). */
function toLineRows(lines: CartLineInput[]) {
  return lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    size: line.size || null,
    color: line.color || null,
  }));
}

export class CartRepository {
  async findByUserId(userId: string): Promise<ServerCart | null> {
    try {
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: CART_INCLUDE,
      });
      return cart ? toServerCart(cart) : null;
    } catch (error) {
      console.error("[CartRepository] findByUserId failed:", error);
      throw new Error("Failed to fetch cart from database", { cause: error });
    }
  }

  /**
   * Replace the cart's lines, guarded by the optimistic version.
   *
   * Lines whose product has vanished are dropped rather than failing the write —
   * a cart is a wish list, and the product join is what would have priced them.
   */
  async upsert(
    userId: string,
    lines: CartLineInput[],
    expectedVersion?: number
  ): Promise<ServerCart> {
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const existing = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const known = new Set(existing.map((p) => p.id));
    const rows = toLineRows(lines.filter((line) => known.has(line.productId)));

    await prisma.$transaction(async (tx) => {
      // With a version, the staleness check IS the where clause (ADR-0007) — the
      // previous read-then-compare could pass for two tabs at once, which is the
      // exact silent overwrite the version exists to prevent (inventory-reservation R7).
      if (expectedVersion !== undefined) {
        const updated = await tx.cart.updateMany({
          where: { userId, version: expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (updated.count === 0) {
          const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
          if (cart) {
            throw new ConflictError(
              "Your cart changed in another tab or on another device. It has been refreshed — please review it."
            );
          }
          // No cart yet: the version was optimistic about a row that does not exist.
          await tx.cart.create({ data: { userId, version: 1 } });
        }
      } else {
        await tx.cart.upsert({
          where: { userId },
          update: { version: { increment: 1 } },
          create: { userId, version: 1 },
        });
      }

      const cart = await tx.cart.findUniqueOrThrow({ where: { userId }, select: { id: true } });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      if (rows.length > 0) {
        await tx.cartItem.createMany({
          data: rows.map((row) => ({ ...row, cartId: cart.id })),
        });
      }
    });

    const saved = await prisma.cart.findUniqueOrThrow({
      where: { userId },
      include: CART_INCLUDE,
    });
    return toServerCart(saved);
  }

  /** Empty the cart, bumping the version so other tabs learn about it. */
  async clear(userId: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        const cart = await tx.cart.update({
          where: { userId },
          data: { version: { increment: 1 } },
          select: { id: true },
        });
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      });
    } catch (error) {
      console.error("[CartRepository] clear failed:", error);
      throw new Error("Failed to clear cart", { cause: error });
    }
  }

  /** Delete cart completely — lines cascade with it. */
  async delete(userId: string): Promise<void> {
    try {
      await prisma.cart.delete({ where: { userId } });
    } catch (error) {
      console.error("[CartRepository] delete failed:", error);
      throw new Error("Failed to delete cart", { cause: error });
    }
  }
}

export const cartRepository = new CartRepository();
