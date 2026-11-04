import { BrandLogo } from "@/components/layout/brand-logo";
import { PortalSidebar, type PortalNavGroup } from "@/components/layout/PortalSidebar";
import { ROUTES } from "@server/shared/routes";
import { ADMIN_NAV_COPY as C } from "./layout-copy";

const REFUNDS_HREF = ROUTES.admin.refunds;

/** The admin's places, grouped by what they are about (design-system admin canvas). One icon per meaning. */
const NAV: PortalNavGroup[] = [
  { label: C.overview, items: [{ title: C.dashboard, href: ROUTES.admin.home, icon: "dashboard", exact: true }] },
  {
    label: C.orders,
    items: [
      { title: C.orders, href: ROUTES.admin.orders, icon: "orders" },
      { title: C.pickups, href: ROUTES.admin.pickups, icon: "parcel" },
      { title: C.refunds, href: REFUNDS_HREF, icon: "returns" },
      { title: C.carts, href: ROUTES.admin.carts, icon: "bag" },
    ],
  },
  {
    label: C.catalogue,
    items: [
      { title: C.products, href: ROUTES.admin.products, icon: "products" },
      { title: C.categories, href: ROUTES.admin.categories, icon: "categories" },
      { title: C.productTypes, href: ROUTES.admin.productTypes, icon: "layers" },
      { title: C.media, href: ROUTES.admin.media, icon: "photos" },
      { title: C.enhancements, href: ROUTES.admin.enhancements, icon: "enhance" },
      { title: C.banners, href: ROUTES.admin.banners, icon: "carousel" },
      { title: C.offers, href: ROUTES.admin.promotions, icon: "offer" },
      { title: C.auctions, href: ROUTES.admin.bidding, icon: "auction" },
    ],
  },
  {
    label: C.shops,
    items: [
      { title: C.shops, href: ROUTES.admin.orgs, icon: "shop" },
      { title: C.payouts, href: ROUTES.admin.payouts, icon: "payout" },
      { title: C.channels, href: ROUTES.admin.channels, icon: "connect" },
      { title: C.reviews, href: ROUTES.admin.reviews, icon: "rating" },
    ],
  },
  {
    label: C.platform,
    items: [
      { title: C.users, href: ROUTES.admin.users, icon: "team" },
      { title: C.shippingProviders, href: ROUTES.admin.shippingProviders, icon: "delivery" },
      { title: C.fulfilmentSettings, href: ROUTES.admin.fulfilmentSettings, icon: "settings" },
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
            <span className="text-label uppercase text-muted-foreground">{C.badge}</span>
          </div>
        }
        groups={groups}
      />
    </div>
  );
}
