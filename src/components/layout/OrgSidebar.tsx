"use client";

import {
  Gavel,
  LayoutDashboard,
  MapPin,
  Package,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Wallet,
  Tags,
  Images,
} from "lucide-react";
import { PortalSidebar } from "@/components/layout/PortalSidebar";
import { OrgSwitcher, type SwitcherOrg } from "@/components/org/org-switcher";

export function OrgSidebar({
  orgId,
  orgs,
}: {
  orgId: string;
  orgs: SwitcherOrg[];
}) {
  const base = `/org/${orgId}`;

  return (
    <PortalSidebar
      header={<OrgSwitcher orgs={orgs} currentOrgId={orgId} />}
      items={[
        { title: "Dashboard", href: base, icon: LayoutDashboard, exact: true },
        { title: "Storefront", href: `${base}/storefront`, icon: Store },
        { title: "Products", href: `${base}/products`, icon: Package },
        { title: "What you sell", href: `${base}/listing`, icon: Tags },
        { title: "Library", href: `${base}/library`, icon: Images },
        { title: "Orders", href: `${base}/orders`, icon: ShoppingCart },
        { title: "Offers", href: `${base}/promotions`, icon: Tag },
        { title: "Bidding", href: `${base}/bidding`, icon: Gavel },
        { title: "Earnings", href: `${base}/earnings`, icon: Wallet },
        { title: "Locations", href: `${base}/locations`, icon: MapPin },
        { title: "Reviews", href: `${base}/reviews`, icon: Star },
      ]}
    />
  );
}
