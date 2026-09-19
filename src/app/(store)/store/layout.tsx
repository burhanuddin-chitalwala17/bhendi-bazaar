import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar/Navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { WishlistProvider } from "@/context/WishlistContext";
import { wishlistDAL } from "@/data-access-layer/wishlist.dal";

/**
 * A storefront keeps the marketplace's chrome (org-storefront R11).
 *
 * The shop's own identity goes *inside* the page, not in place of the navbar: a visitor
 * arriving from a shared link must be able to reach the cart, their account and the
 * wider marketplace without leaving through the browser's back button. Replacing the
 * chrome would make a storefront feel more like its own site and trap the shopper in
 * it, which is the trade R11 refuses.
 */
export default async function StoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Same reasoning as the marketplace layout: one query here lets every heart render
  // filled or hollow on first paint instead of flickering after a fetch.
  const savedProductIds = await wishlistDAL.getSavedProductIds();

  return (
    <WishlistProvider initialProductIds={savedProductIds}>
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex-1">
          <div className="mx-auto max-w-page px-3 py-4 pb-tabbar sm:px-6 sm:py-8 md:pb-8 lg:px-8">
            {children}
          </div>
        </main>
        <div className="hidden md:block">
          <Footer />
        </div>
        <MobileTabBar />
      </div>
    </WishlistProvider>
  );
}
