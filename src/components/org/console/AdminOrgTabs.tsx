"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  Star,
  Store,
  Tags,
  Images,
  Tag,
  Gavel,
  MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabDef {
  key: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

const TABS: TabDef[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "products", label: "Products", icon: Package },
  { key: "orders", label: "Orders", icon: ShoppingCart },
  { key: "earnings", label: "Earnings", icon: Wallet },
  { key: "reviews", label: "Reviews", icon: Star },
  { key: "storefront", label: "Storefront", icon: Store, disabled: true },
  { key: "listing", label: "What they sell", icon: Tags, disabled: true },
  { key: "library", label: "Library", icon: Images, disabled: true },
  { key: "promotions", label: "Offers", icon: Tag, disabled: true },
  { key: "bidding", label: "Bidding", icon: Gavel, disabled: true },
  { key: "locations", label: "Locations", icon: MapPin, disabled: true },
];

interface Props {
  active: string;
  orgId: string;
}

export function AdminOrgTabs({ active, orgId }: Props) {
  const params = useSearchParams();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border pb-px">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        const next = new URLSearchParams(params.toString());
        next.set("tab", tab.key);

        if (tab.disabled) {
          return (
            <span
              key={tab.key}
              className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground/50 cursor-not-allowed"
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </span>
          );
        }

        return (
          <Link
            key={tab.key}
            href={`/admin/orgs/${orgId}?${next.toString()}`}
            prefetch={false}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
