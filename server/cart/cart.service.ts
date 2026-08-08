import { cartRepository } from "@server/cart/cart.repository";
import { mergeCartLines } from "@server/cart/cart.merge";
import type { CartItem, CartLineInput } from "@server/cart/cart.types";
import { DomainError } from "@server/shared/domain-error";

/**
 * Cart service — business logic. Storage is rows since order-and-cart-lines: a
 * write persists only the buyer's choice (product, quantity, size, colour); prices
 * and display fields on the way out are the product's, derived at read time.
 */
export class CartService {
  async getCart(userId: string) {
    return await cartRepository.findByUserId(userId);
  }

  /** Replace the cart. Returns the saved version for the client's next write. */
  async updateCart(
    userId: string,
    lines: CartLineInput[],
    expectedVersion?: number
  ): Promise<{ version: number }> {
    this.validateCartLines(lines);
    const cart = await cartRepository.upsert(userId, lines, expectedVersion);
    return { version: cart.version };
  }

  /**
   * Sign-in merge: union of the device cart and the server cart, the device's
   * quantity winning where a line exists on both sides (cart.merge.ts). The saved
   * read derives fresh prices and org data from the products, and lines whose
   * product has vanished drop out — the blob-era "refresh prices" pass is now just
   * what reading a cart means.
   */
  async syncCart<L extends CartLineInput>(
    userId: string,
    localLines: L[]
  ): Promise<{ items: CartItem[] | L[]; version: number }> {
    try {
      this.validateCartLines(localLines);
      const remote = await cartRepository.findByUserId(userId);
      const merged = mergeCartLines<CartLineInput>(
        localLines,
        (remote?.items ?? []).map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
        }))
      );
      // Unconditional write: signing in is the tiebreak, not a stale-tab race.
      const saved = await cartRepository.upsert(userId, merged);
      return { items: saved.items, version: saved.version };
    } catch (error) {
      console.error("[CartService] syncCart failed:", error);
      // The device cart survives — the client sets whatever comes back, so failure
      // must echo it. Version 0 says the next write has no basis to assert one.
      return { items: localLines, version: 0 };
    }
  }

  async clearCart(userId: string): Promise<void> {
    await cartRepository.clear(userId);
  }

  private validateCartLines(lines: CartLineInput[]): void {
    if (!Array.isArray(lines)) {
      throw new DomainError("Cart items must be an array");
    }
    for (const line of lines) {
      if (!line.productId) {
        throw new DomainError("Each item must have a productId");
      }
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new DomainError("Item quantity must be a positive whole number");
      }
    }
  }
}

export const cartService = new CartService();
