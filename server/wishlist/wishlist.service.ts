import { prisma } from "@server/shared/prisma";
import { wishlistRepository } from "@server/wishlist/wishlist.repository";
import type { WishlistProduct } from "@server/wishlist/wishlist.types";
import { NotFoundError } from "@server/shared/domain-error";

/**
 * Wishlist service — saving a product, forgetting one, and reading the set back.
 *
 * There is no guest wishlist and so no sign-in merge: hearting is an authenticated
 * action, and a signed-out visitor is asked to sign in before anything is stored.
 */
export class WishlistService {
  async getWishlist(userId: string): Promise<WishlistProduct[]> {
    return await wishlistRepository.listByUserId(userId);
  }

  async getSavedProductIds(userId: string): Promise<string[]> {
    return await wishlistRepository.listProductIds(userId);
  }

  /**
   * Save a product.
   *
   * The existence check is for the message, not the guarantee — `WishlistItem`'s
   * foreign key is what actually stops a row pointing at nothing, and it still holds
   * if the product is deleted between this read and the insert.
   */
  async addItem(userId: string, productId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundError("That product is no longer available");
    }
    await wishlistRepository.add(userId, productId);
  }

  /**
   * Record that a saved product was carted after being opened from the wishlist.
   *
   * A hint about provenance, not a transaction: it never throws at the caller, because
   * failing to note where a buyer came from must not fail adding to their cart.
   */
  async markCartedFromWishlist(userId: string, productId: string): Promise<void> {
    try {
      await wishlistRepository.markCartedFromWishlist(userId, productId);
    } catch (error) {
      console.error("[WishlistService] markCartedFromWishlist failed:", error);
    }
  }

  /**
   * Clear the wishes a paid order fulfilled — marked rows only, so a product bought
   * from anywhere but the wishlist stays saved.
   */
  async removePurchased(userId: string, productIds: string[]): Promise<number> {
    return await wishlistRepository.removePurchased(userId, productIds);
  }

  /** Remove a saved product. Only ever called from an explicit removal. */
  async removeItem(userId: string, productId: string): Promise<void> {
    await wishlistRepository.remove(userId, productId);
  }
}

export const wishlistService = new WishlistService();
