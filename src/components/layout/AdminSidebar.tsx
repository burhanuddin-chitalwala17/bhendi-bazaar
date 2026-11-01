"use client";

import { PortalSidebar } from "@/components/layout/PortalSidebar";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FolderTree,
  Radio,
  Star,
  ShoppingBag,
  Truck,
  Store,
  Tag,
  Wallet,
  GalleryHorizontal,
  Gavel,
  Sparkles,
  Layers,
  Images,
  Settings,
  Undo2,
} from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Orders",
    href: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    title: "Pickups",
    href: "/admin/orders/pickups",
    icon: Truck,
  },
  {
    title: "Refunds",
    href: "/admin/orders/refunds",
    icon: Undo2,
  },
  {
    title: "Products",
    href: "/admin/products",
    icon: Package,
  },
  {
    title: "Categories",
    href: "/admin/categories",
    icon: FolderTree,
  },
  {
    title: "Product Types",
    href: "/admin/product-types",
    icon: Layers,
  },
  {
    title: "Media",
    href: "/admin/media",
    icon: Images,
  },
  {
    title: "Channels",
    href: "/admin/channels",
    icon: Radio,
  },
  {
    title: "Banners",
    href: "/admin/banners",
    icon: GalleryHorizontal,
  },
  {
    title: "Offers",
    href: "/admin/promotions",
    icon: Tag,
  },
  {
    title: "Bidding",
    href: "/admin/bidding",
    icon: Gavel,
  },
  {
    title: "Payouts",
    href: "/admin/payouts",
    icon: Wallet,
  },
  {
    title: "Enhancements",
    href: "/admin/enhancements",
    icon: Sparkles,
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Organisations",
    href: "/admin/orgs",
    icon: Store,
  },
  {
    title: "Reviews",
    href: "/admin/reviews",
    icon: Star,
  },
  {
    title: "Abandoned Carts",
    href: "/admin/carts",
    icon: ShoppingBag,
  },
  {
    title: "Settings",
    href: "/admin/settings/fulfilment",
    icon: Settings,
  },
  {
    title: "Shipping Providers",
    href: "/admin/shipping/providers",
    icon: Truck,
  },
];

/** Counts the server read for the nav (order-fulfilment ux.md: "Refunds" with a count). */
export function AdminSidebar({ refundsNotStarted = 0 }: { refundsNotStarted?: number }) {
  return (
    <PortalSidebar
      header={
        <div className="border-b border-border p-6">
          <h2 className="font-heading text-xl font-bold">Bhendi Bazaar</h2>
          <p className="text-sm text-muted-foreground">Admin Panel</p>
        </div>
      }
      items={navItems.map((item) => ({
        ...item,
        exact: item.href === "/admin",
        count: item.href === "/admin/orders/refunds" ? refundsNotStarted : undefined,
      }))}
    />
  );
}
