import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Navbar, type NavLink } from "@/components/layout/navbar/Navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { EmailVerificationBanner } from "@/components/layout/EmailVerificationBanner";
import { categoriesDAL } from "@/data-access-layer/categories.dal";

/** How many top-level categories the desktop bar and the footer name before "Shops". */
const NAV_CATEGORIES = 5;

/** The top-level categories, in the order the admin set; the category list is one shared read. */
async function browseLinks(): Promise<NavLink[]> {
  const categories = await categoriesDAL.getDescendants(null).catch(() => []);
  return categories
    .filter((category) => category.parentId === null)
    .sort((a, b) => a.order - b.order)
    .slice(0, NAV_CATEGORIES)
    .map((category) => ({ href: `/category/${category.slug}`, label: category.name }));
}

/**
 * The marketplace's chrome around a page that is not a themed shop's (org-storefront R11;
 * storefront-themes Q19). A themed shop draws its own (`storefront/themed/chrome/themed-shell.tsx`).
 */
export async function MarketplaceChrome({ children }: { children: ReactNode }) {
  const categories = await browseLinks();
  const links = [...categories, { href: "/store", label: "Shops" }, { href: "/offers", label: "Offers" }];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-tabbar md:pb-0">
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
