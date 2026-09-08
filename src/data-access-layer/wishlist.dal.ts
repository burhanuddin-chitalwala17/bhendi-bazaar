// src/data-access-layer/wishlist.dal.ts

import { getServerSession } from "next-auth";
import { unstable_rethrow } from "next/navigation";
import { authOptions } from "@/lib/auth-config";
import { wishlistService } from "@server/wishlist/wishlist.service";
import type { WishlistProduct } from "@server/wishlist/wishlist.types";

export type { WishlistProduct };

/**
 * The signed-in user's wishlist, read on the server.
 *
 * Session is read here rather than by each caller because every question this module
 * answers is "what has *this* user saved" — the layout painting hearts and the
 * wishlist page listing them would otherwise each plumb a session through.
 *
 * A signed-out visitor has no wishlist by design, so both reads answer empty rather
 * than throwing; the pages above decide whether that means a sign-in redirect or
 * simply hollow hearts.
 */
export const wishlistDAL = {
  getSavedProductIds: async (): Promise<string[]> => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) return [];
      return await wishlistService.getSavedProductIds(session.user.id);
    } catch (error) {
      // Reading the session marks the route dynamic by throwing; that is Next's
      // control flow, not a failure, and swallowing it makes a build log full of
      // errors out of a page rendering exactly as intended.
      unstable_rethrow(error);
      // A wishlist read must never take a product listing down with it: an unpainted
      // heart is a far smaller failure than a blank category page.
      console.error("Failed to fetch saved product ids:", error);
      return [];
    }
  },

  getWishlist: async (): Promise<WishlistProduct[]> => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) return [];
      return await wishlistService.getWishlist(session.user.id);
    } catch (error) {
      unstable_rethrow(error);
      console.error("Failed to fetch wishlist:", error);
      return [];
    }
  },
};
