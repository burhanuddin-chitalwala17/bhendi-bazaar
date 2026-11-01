import type { ReactNode } from "react";

import { MarketplaceChrome } from "@/components/layout/marketplace-chrome";
import { ThemedShell, themedShop } from "@/components/storefront/themed/chrome/themed-shell";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";

/**
 * A shop's chrome (storefront-themes D6, D7). A shop that has published a look draws its own
 * header, footer and tab bar; an unthemed one, an unknown handle and a retired one keep the
 * marketplace's, and the page below answers them as before (Q19). `getByHandle` is
 * request-memoised, so the page's own read costs nothing more.
 */
export default async function ShopLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const shop = await storefrontDAL.getByHandle(handle);
  const themed = shop && themedShop(shop);
  if (themed) return <ThemedShell shop={themed}>{children}</ThemedShell>;
  return <MarketplaceChrome>{children}</MarketplaceChrome>;
}
