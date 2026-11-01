import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar/Navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

/**
 * The marketplace's chrome around a page that is not a themed shop's: the directory and every
 * unthemed storefront keep it (org-storefront R11; storefront-themes Q19). A themed shop draws
 * its own instead (`src/components/storefront/themed/chrome/themed-shell.tsx`).
 */
export function MarketplaceChrome({ children }: { children: ReactNode }) {
  return (
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
  );
}
