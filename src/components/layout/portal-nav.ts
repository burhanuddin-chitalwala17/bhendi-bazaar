import type { IconName } from "@/components/ui/icon";
import { ROUTES } from "@server/shared/routes";
import { PORTAL_GROUP_COPY, PORTAL_NAV_COPY } from "@/components/layout/portal-copy";

/**
 * The shop portal's one navigation list (own-store onboarding D1): the phone tab bar, More and the
 * sidebar all render this, so the three cannot drift. Labels and purposes are ux.md's copy deck.
 */
export const PORTAL_GROUP = {
  SELL: "sell",
  SHOP: "shop",
  GROW: "grow",
  MONEY: "money",
  SETTINGS: "settings",
} as const;
export type PortalGroup = (typeof PORTAL_GROUP)[keyof typeof PORTAL_GROUP];
export const PORTAL_GROUPS = Object.values(PORTAL_GROUP) as readonly PortalGroup[];

export const PORTAL_GROUP_LABEL: Record<PortalGroup, string> = {
  [PORTAL_GROUP.SELL]: PORTAL_GROUP_COPY.sell,
  [PORTAL_GROUP.SHOP]: PORTAL_GROUP_COPY.shop,
  [PORTAL_GROUP.GROW]: PORTAL_GROUP_COPY.grow,
  [PORTAL_GROUP.MONEY]: PORTAL_GROUP_COPY.money,
  [PORTAL_GROUP.SETTINGS]: PORTAL_GROUP_COPY.settings,
};

/** What an item does when tapped that is not opening a portal page. */
export const PORTAL_ACTION = { CONTACT: "contact" } as const;
export type PortalAction = (typeof PORTAL_ACTION)[keyof typeof PORTAL_ACTION];

export type PortalNavTarget =
  /** A page under `/org/[orgId]`; `""` is Home. May carry a `#fragment`. */
  | { page: string }
  /** A page outside the shop's own routes. */
  | { href: string }
  | { action: PortalAction };

/** Every navigation key, closed so a page's "?" (help=…) cannot name one that does not exist. */
export type PortalNavKey =
  | "home" | "orders" | "products" | "shop" | "listing" | "library" | "storefront" | "locations"
  | "reviews" | "promotions" | "channels" | "bidding" | "earnings" | "details" | "requests" | "help";

export interface PortalNavEntry {
  key: PortalNavKey;
  label: string;
  /** One line, shown under the label wherever the item is listed (R5). */
  purpose: string;
  icon: IconName;
  target: PortalNavTarget;
  /** Absent only for Home, which stands on its own. */
  group?: PortalGroup;
  /** A bottom-bar tab on a phone (design-system revamp: Home · Products · Orders · Earnings). */
  tab?: boolean;
  /** The tab bar's one word, where the full label would not fit under an icon. */
  tabLabel?: string;
  /** Further sections a tab counts as its own, so it stays marked on them. */
  alsoActiveOn?: string[];
}

export const PORTAL_NAV: readonly PortalNavEntry[] = [
  { key: "home", label: PORTAL_NAV_COPY.home.label, purpose: PORTAL_NAV_COPY.home.purpose, icon: "home", target: { page: "" }, tab: true },
  { key: "products", label: PORTAL_NAV_COPY.products.label, purpose: PORTAL_NAV_COPY.products.purpose, icon: "products", target: { page: "products" }, group: PORTAL_GROUP.SELL, tab: true },
  { key: "orders", label: PORTAL_NAV_COPY.orders.label, purpose: PORTAL_NAV_COPY.orders.purpose, icon: "orders", target: { page: "orders" }, group: PORTAL_GROUP.SELL, tab: true },
  { key: "shop", label: PORTAL_NAV_COPY.shop.label, purpose: PORTAL_NAV_COPY.shop.purpose, icon: "shop", target: { page: "shop" }, group: PORTAL_GROUP.SHOP },
  { key: "listing", label: PORTAL_NAV_COPY.listing.label, purpose: PORTAL_NAV_COPY.listing.purpose, icon: "layers", target: { page: "listing" }, group: PORTAL_GROUP.SELL },
  { key: "library", label: PORTAL_NAV_COPY.library.label, purpose: PORTAL_NAV_COPY.library.purpose, icon: "photos", target: { page: "library" }, group: PORTAL_GROUP.SELL },
  { key: "storefront", label: PORTAL_NAV_COPY.storefront.label, purpose: PORTAL_NAV_COPY.storefront.purpose, icon: "layout", target: { page: "storefront" }, group: PORTAL_GROUP.SHOP },
  { key: "locations", label: PORTAL_NAV_COPY.locations.label, purpose: PORTAL_NAV_COPY.locations.purpose, icon: "location", target: { page: "locations" }, group: PORTAL_GROUP.SHOP },
  { key: "reviews", label: PORTAL_NAV_COPY.reviews.label, purpose: PORTAL_NAV_COPY.reviews.purpose, icon: "rating", target: { page: "reviews" }, group: PORTAL_GROUP.SHOP },
  { key: "promotions", label: PORTAL_NAV_COPY.promotions.label, purpose: PORTAL_NAV_COPY.promotions.purpose, icon: "offer", target: { page: "promotions" }, group: PORTAL_GROUP.GROW },
  { key: "channels", label: PORTAL_NAV_COPY.channels.label, purpose: PORTAL_NAV_COPY.channels.purpose, icon: "connect", target: { page: "channels" }, group: PORTAL_GROUP.GROW },
  { key: "bidding", label: PORTAL_NAV_COPY.bidding.label, purpose: PORTAL_NAV_COPY.bidding.purpose, icon: "auction", target: { page: "bidding" }, group: PORTAL_GROUP.GROW },
  { key: "earnings", label: PORTAL_NAV_COPY.earnings.label, purpose: PORTAL_NAV_COPY.earnings.purpose, icon: "payout", target: { page: "earnings" }, group: PORTAL_GROUP.MONEY, tab: true, tabLabel: PORTAL_NAV_COPY.earnings.tabLabel },
  { key: "details", label: PORTAL_NAV_COPY.details.label, purpose: PORTAL_NAV_COPY.details.purpose, icon: "id-card", target: { page: "shop/details" }, group: PORTAL_GROUP.SETTINGS },
  // Global, never a marketplace's: a request can be for any part of the shop (setup-requests Q33).
  { key: "requests", label: PORTAL_NAV_COPY.requests.label, purpose: PORTAL_NAV_COPY.requests.purpose, icon: "checklist", target: { page: "requests" }, group: PORTAL_GROUP.SETTINGS },
  { key: "help", label: PORTAL_NAV_COPY.help.label, purpose: PORTAL_NAV_COPY.help.purpose, icon: "support", target: { action: PORTAL_ACTION.CONTACT }, group: PORTAL_GROUP.SETTINGS },
];

/** The href an entry opens for one shop, or null for an action. */
export function portalHref(entry: PortalNavEntry, orgId: string): string | null {
  const { target } = entry;
  if ("action" in target) return null;
  if ("href" in target) return target.href;
  const base = ROUTES.org.home(orgId);
  if (target.page === "") return base;
  return target.page.startsWith("#") ? `${base}${target.page}` : `${base}/${target.page}`;
}

/** The fifth tab, which opens the drawer instead of a page. */
export const MORE_TAB = "more";

function pageOf(entry: PortalNavEntry): string | null {
  const { target } = entry;
  return "page" in target && !target.page.startsWith("#") ? target.page : null;
}

/**
 * The one entry `pathname` belongs to: the longest page it sits under, so Shop details
 * (`shop/details`) wins over the Shop hub (`shop`) and only one item is ever marked.
 */
export function activePortalEntry(orgId: string, pathname: string): PortalNavEntry | null {
  const base = ROUTES.org.home(orgId);
  let best: PortalNavEntry | null = null;
  let bestLength = -1;
  for (const entry of PORTAL_NAV) {
    const page = pageOf(entry);
    if (page === null) continue;
    const href = page === "" ? base : `${base}/${page}`;
    const matches = page === "" ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
    if (matches && page.length > bestLength) {
      best = entry;
      bestLength = page.length;
    }
  }
  return best;
}

/** Which tab is lit: the page's own tab, the tab that claims its section, or More. */
export function activeTabKey(orgId: string, pathname: string): string {
  const entry = activePortalEntry(orgId, pathname);
  if (!entry) return MORE_TAB;
  if (entry.tab) return entry.key;
  const page = pageOf(entry);
  const claimant = PORTAL_NAV.find((tab) => tab.tab && page !== null && tab.alsoActiveOn?.includes(page));
  return claimant?.key ?? MORE_TAB;
}
