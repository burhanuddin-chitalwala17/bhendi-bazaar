import type { ReactNode } from "react";

import { MarketplaceChrome } from "@/components/layout/marketplace-chrome";
import { ThemedShell, themedShop } from "@/components/storefront/themed/chrome/themed-shell";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { STOREFRONT_ACCESS, storefrontAccessDAL } from "@/data-access-layer/storefront-access.dal";
import { StorefrontTeamBanner } from "@/components/subscriptions/storefront-team-banner";

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
  // Chrome and the team's banner only: each page closes itself before it reads anything, because a
  // layout that swaps its children does not stop them rendering into the payload (feature-access D11).
  const access = shop ? await storefrontAccessDAL.forViewer(shop.id) : STOREFRONT_ACCESS.OPEN;
  if (shop && access === STOREFRONT_ACCESS.CLOSED) return <MarketplaceChrome>{children}</MarketplaceChrome>;
  const banner = shop && access === STOREFRONT_ACCESS.TEAM ? <StorefrontTeamBanner shop={shop.name} /> : null;
  const themed = shop && themedShop(shop);
  if (themed) return <ThemedShell shop={themed}>{banner}{children}</ThemedShell>;
  return <MarketplaceChrome>{banner}{children}</MarketplaceChrome>;
}
