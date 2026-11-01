import type { ReactNode } from "react";

import { WishlistProvider } from "@/context/WishlistContext";
import { wishlistDAL } from "@/data-access-layer/wishlist.dal";

/**
 * Every storefront route shares the wishlist; the chrome is chosen below, per shop (D6): a
 * themed shop draws its own, everything else keeps the marketplace's (org-storefront R11).
 */
export default async function StoreLayout({ children }: { children: ReactNode }) {
  // Same reasoning as the marketplace layout: one query here lets every heart render
  // filled or hollow on first paint instead of flickering after a fetch.
  const savedProductIds = await wishlistDAL.getSavedProductIds();
  return <WishlistProvider initialProductIds={savedProductIds}>{children}</WishlistProvider>;
}
