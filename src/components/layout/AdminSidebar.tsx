import { BrandLogo } from "@/components/layout/brand-logo";
import { PortalSidebar, type PortalNavGroup } from "@/components/layout/PortalSidebar";

const REFUNDS_HREF = "/admin/orders/refunds";

/** The admin's places, grouped by what they are about (design-system admin canvas). One icon per meaning. */
const NAV: PortalNavGroup[] = [
  { label: "Overview", items: [{ title: "Dashboard", href: "/admin", icon: "dashboard", exact: true }] },
  {
    label: "Orders",
    items: [
      { title: "Orders", href: "/admin/orders", icon: "orders" },
      { title: "Pickups", href: "/admin/orders/pickups", icon: "parcel" },
      { title: "Refunds", href: REFUNDS_HREF, icon: "returns" },
      { title: "Open carts", href: "/admin/carts", icon: "bag" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { title: "Products", href: "/admin/products", icon: "products" },
      { title: "Categories", href: "/admin/categories", icon: "categories" },
      { title: "Product types", href: "/admin/product-types", icon: "layers" },
      { title: "Media", href: "/admin/media", icon: "photos" },
      { title: "Photo enhancements", href: "/admin/enhancements", icon: "enhance" },
      { title: "Banners", href: "/admin/banners", icon: "carousel" },
      { title: "Offers", href: "/admin/promotions", icon: "offer" },
      { title: "Auctions", href: "/admin/bidding", icon: "auction" },
    ],
  },
  {
    label: "Shops",
    items: [
      { title: "Shops", href: "/admin/orgs", icon: "shop" },
      { title: "Payouts", href: "/admin/payouts", icon: "payout" },
      { title: "Channels", href: "/admin/channels", icon: "connect" },
      { title: "Reviews", href: "/admin/reviews", icon: "rating" },
    ],
  },
  {
    label: "Platform",
    items: [
      { title: "Users", href: "/admin/users", icon: "team" },
      { title: "Shipping providers", href: "/admin/shipping/providers", icon: "delivery" },
      { title: "Fulfilment settings", href: "/admin/settings/fulfilment", icon: "settings" },
    ],
  },
];

/**
 * The admin's navigation, on the dark surface: `.dark` re-scopes the surface tokens for the
 * sidebar alone, and `contents` keeps the aside the layout's flex child. Counts are only the
 * ones the layout already read (order-fulfilment ux.md: "Refunds" with a count).
 */
export function AdminSidebar({ refundsNotStarted = 0 }: { refundsNotStarted?: number }) {
  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.map((item) => (item.href === REFUNDS_HREF ? { ...item, count: refundsNotStarted } : item)),
  }));
  return (
    <div className="dark contents">
      <PortalSidebar
        header={
          <div className="flex items-center gap-3 border-b border-border p-5">
            <BrandLogo size="sm" tone="light" />
            <span className="text-label uppercase text-muted-foreground">Admin</span>
          </div>
        }
        groups={groups}
      />
    </div>
  );
}
