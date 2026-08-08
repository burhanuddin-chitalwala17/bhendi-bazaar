"use client";

import { LayoutDashboard, Package, ShoppingCart, Star } from "lucide-react";
import { PortalSidebar } from "@/components/layout/PortalSidebar";
import { OrgSwitcher, type SwitcherOrg } from "@/org/org-switcher";

export function OrgSidebar({ orgId, orgs }: { orgId: string; orgs: SwitcherOrg[] }) {
  const base = `/org/${orgId}`;

  return (
    <PortalSidebar
      header={<OrgSwitcher orgs={orgs} currentOrgId={orgId} />}
      items={[
        { title: "Dashboard", href: base, icon: LayoutDashboard, exact: true },
        { title: "Products", href: `${base}/products`, icon: Package },
        { title: "Orders", href: `${base}/orders`, icon: ShoppingCart },
        { title: "Reviews", href: `${base}/reviews`, icon: Star },
      ]}
    />
  );
}
