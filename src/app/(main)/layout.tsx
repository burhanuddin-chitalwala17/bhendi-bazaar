import type { ReactNode } from "react";
import { headers } from "next/headers";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar/Navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { EmailVerificationBanner } from "@/components/layout/EmailVerificationBanner";
import { ThemedShell, themedShop } from "@/components/storefront/themed/chrome/themed-shell";
import { WishlistProvider } from "@/context/WishlistContext";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { wishlistDAL } from "@/data-access-layer/wishlist.dal";
import { STOREFRONT_PRODUCT_HEADER, STOREFRONT_SHOP_HEADER } from "@/lib/storefront-chrome";

/** The page's own column, under either chrome. px-3 on a phone: at 3-up, every 4px of gutter is 4px off each tile. */
const PAGE = "mx-auto max-w-page px-3 py-4 pb-tabbar sm:px-6 sm:py-8 md:pb-8 lg:px-8";

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Read here, not in each heart: the set is per-user and the storefront is already
  // dynamic, so this costs one query and lets every heart render filled or hollow in
  // the first paint instead of flickering after a fetch. Guests get an empty set.
  const [savedProductIds, shop] = await Promise.all([
    wishlistDAL.getSavedProductIds(),
    productShop(),
  ]);

  // A product reached from a themed shop keeps that shop's chrome (storefront-themes Q33).
  if (shop) {
    return (
      <WishlistProvider initialProductIds={savedProductIds}>
        <ThemedShell shop={shop} aroundProduct>
          <div className={PAGE}>{children}</div>
        </ThemedShell>
      </WishlistProvider>
    );
  }

  return (
    <WishlistProvider initialProductIds={savedProductIds}>
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <EmailVerificationBanner />
        <main className="flex-1">
          <div className={PAGE}>{children}</div>
        </main>
        {/* The tab bar is the phone's footer; the real one is desktop chrome. */}
        <div className="hidden md:block">
          <Footer />
        </div>
        <MobileTabBar />
      </div>
    </WishlistProvider>
  );
}

/** Middleware forwards `?shop=` on a product path only; the DAL checks the product is that shop's. */
async function productShop() {
  const forwarded = await headers();
  const handle = forwarded.get(STOREFRONT_SHOP_HEADER);
  const slug = forwarded.get(STOREFRONT_PRODUCT_HEADER);
  if (!handle || !slug) return null;
  const shop = await storefrontDAL.chromeShopForProduct(handle, slug);
  return shop && themedShop(shop);
}
