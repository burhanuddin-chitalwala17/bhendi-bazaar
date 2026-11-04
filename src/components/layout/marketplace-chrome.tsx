import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Navbar, type NavLink } from "@/components/layout/navbar/Navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { EmailVerificationBanner } from "@/components/layout/EmailVerificationBanner";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { ROUTES } from "@server/shared/routes";
import { CHROME_COPY } from "./layout-copy";

/** How many top-level categories the footer names. */
const NAV_CATEGORIES = 5;

/** The top-level categories, in the order the admin set; the category list is one shared read. */
async function browseLinks(): Promise<NavLink[]> {
  const categories = await categoriesDAL.getDescendants(null).catch(() => []);
  return categories
    .filter((category) => category.parentId === null)
    .sort((a, b) => a.order - b.order)
    .slice(0, NAV_CATEGORIES)
    .map((category) => ({ href: ROUTES.category(category.slug), label: category.name }));
}

/**
 * The marketplace's chrome around a page that is not a themed shop's (org-storefront R11;
 * storefront-themes Q19). A themed shop draws its own (`storefront/themed/chrome/themed-shell.tsx`).
 */
export async function MarketplaceChrome({ children }: { children: ReactNode }) {
  const categories = await browseLinks();
  // Categories are browsed from Home's picture row, not repeated as words in the bar (owner, 2026-11-04).
  const links = [{ href: ROUTES.stores, label: CHROME_COPY.shops }, { href: ROUTES.offers, label: CHROME_COPY.offers }];

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background pb-tabbar md:pb-0">
      <Navbar links={links} />
      <EmailVerificationBanner />
      <main className="flex-1">
        <div className="mx-auto max-w-page px-3 py-4 sm:px-6 md:py-8 lg:px-8">{children}</div>
      </main>
      <Footer shopLinks={categories} />
      <MobileTabBar />
    </div>
  );
}
