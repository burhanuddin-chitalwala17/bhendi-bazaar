import { cartRepository } from "@server/cart/cart.repository";
import { mergeCartLines } from "@server/cart/cart.merge";
import type { CartItem, CartLineInput } from "@server/cart/cart.types";
import { DomainError } from "@server/shared/domain-error";
import { assertNotUnderBidding, lockedAmong } from "@server/bidding/bidding-lock";

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
    // Refused here as well as in the order transaction, so someone adding an item that
    // has gone to auction is told now rather than at payment (bidding spec R30/R31).
    // The transaction remains the enforcement point; this is where the message is good.
    await assertNotUnderBidding(
      lines.map((line) => line.productId),
      new Date()
    );
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
      // An item that went to auction while the device cart sat there drops out, the
      // same way one whose product has vanished does. Signing in must not fail because
      // of it, and it cannot be bought anyway (bidding spec R30).
      const locked = await lockedAmong(
        merged.map((line) => line.productId),
        new Date()
      );
      const sellable = merged.filter((line) => !locked.has(line.productId));
      // Unconditional write: signing in is the tiebreak, not a stale-tab race.
      const saved = await cartRepository.upsert(userId, sellable);
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
