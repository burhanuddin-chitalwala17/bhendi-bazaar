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
   * Saves per product, for the org and admin product tables — the wishlist domain's
   * public answer to "how many people want this", so catalog never reads these rows
   * itself.
   */
  async countSavesByProduct(productIds: string[]): Promise<Map<string, number>> {
    return await wishlistRepository.countByProductIds(productIds);
  }

  /**
   * Which products anyone has saved, for the tables' "wishlisted only" filter. Scoped
   * to an org in the portal; unscoped only for the platform's cross-vendor view.
   */
  async listSavedProductIds(orgId?: string): Promise<string[]> {
    return await wishlistRepository.listSavedProductIds(orgId);
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
   * Remove a saved product. Reached only from an explicit removal — un-hearting, or
   * Remove on the wishlist page. Carting, buying and stocking out leave a wish alone.
   */
  async removeItem(userId: string, productId: string): Promise<void> {
    await wishlistRepository.remove(userId, productId);
  }
}

export const wishlistService = new WishlistService();
