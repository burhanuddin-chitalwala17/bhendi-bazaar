/**
 * Admin Sidebar Component
 * Navigation sidebar for admin panel
 */

"use client";

import { PortalSidebar } from "@/components/layout/PortalSidebar";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FolderTree,
  Star,
  ShoppingBag,
  Truck,
  Store,
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
    title: "Shipping Providers",
    href: "/admin/shipping/providers",
    icon: Truck,
  },
];

export function AdminSidebar() {
  return (
    <PortalSidebar
      header={
        <div className="border-b border-border p-6">
          <h2 className="font-heading text-xl font-bold">Bhendi Bazaar</h2>
          <p className="text-sm text-muted-foreground">Admin Panel</p>
        </div>
      }
      items={navItems.map((item) => ({ ...item, exact: item.href === "/admin" }))}
    />
  );
}
