import {
  Gavel,
  House,
  IdCard,
  Images,
  LayoutTemplate,
  LifeBuoy,
  ListChecks,
  MapPin,
  Package,
  Plug,
  Repeat,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Tags,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  [PORTAL_GROUP.SELL]: "Sell",
  [PORTAL_GROUP.SHOP]: "Your shop",
  [PORTAL_GROUP.GROW]: "Grow",
  [PORTAL_GROUP.MONEY]: "Money",
  [PORTAL_GROUP.SETTINGS]: "Settings",
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
  | "reviews" | "promotions" | "channels" | "bidding" | "earnings" | "details" | "setup" | "help" | "switch";

export interface PortalNavEntry {
  key: PortalNavKey;
  label: string;
  /** One line, shown under the label wherever the item is listed (R5). */
  purpose: string;
  icon: LucideIcon;
  target: PortalNavTarget;
  /** Absent for the tabs that stand on their own (Home, Shop). */
  group?: PortalGroup;
  /** A bottom-bar tab on a phone (own-store Q13). */
  tab?: boolean;
  /** Further sections a tab counts as its own, so it stays marked on them. */
  alsoActiveOn?: string[];
}

export const PORTAL_NAV: readonly PortalNavEntry[] = [
  { key: "home", label: "Home", purpose: "What needs you today", icon: House, target: { page: "" }, tab: true },
  { key: "orders", label: "Orders", purpose: "Pack and track parcels", icon: ShoppingCart, target: { page: "orders" }, group: PORTAL_GROUP.SELL, tab: true },
  { key: "products", label: "Products", purpose: "Add and edit what you sell", icon: Package, target: { page: "products" }, group: PORTAL_GROUP.SELL, tab: true },
  {
    key: "shop",
    label: "Shop",
    purpose: "Your link and what buyers see",
    icon: Store,
    target: { page: "shop" },
    tab: true,
    alsoActiveOn: ["storefront", "locations", "reviews"],
  },
  { key: "listing", label: "Brands and defaults", purpose: "Facts every product starts with", icon: Tags, target: { page: "listing" }, group: PORTAL_GROUP.SELL },
  { key: "library", label: "Photos", purpose: "All your pictures in one place", icon: Images, target: { page: "library" }, group: PORTAL_GROUP.SELL },
  { key: "storefront", label: "Shop page", purpose: "What buyers see", icon: LayoutTemplate, target: { page: "storefront" }, group: PORTAL_GROUP.SHOP },
  { key: "locations", label: "Pickup addresses", purpose: "Where couriers collect from", icon: MapPin, target: { page: "locations" }, group: PORTAL_GROUP.SHOP },
  { key: "reviews", label: "Reviews", purpose: "What buyers say", icon: Star, target: { page: "reviews" }, group: PORTAL_GROUP.SHOP },
  { key: "promotions", label: "Offers", purpose: "Discounts you run", icon: Tag, target: { page: "promotions" }, group: PORTAL_GROUP.GROW },
  { key: "channels", label: "Channels", purpose: "Sell on Amazon, Flipkart and more", icon: Plug, target: { page: "channels" }, group: PORTAL_GROUP.GROW },
  { key: "bidding", label: "Bidding", purpose: "Auctions for one-off pieces", icon: Gavel, target: { page: "bidding" }, group: PORTAL_GROUP.GROW },
  { key: "earnings", label: "Money you'll receive", purpose: "What you earned and when it's paid", icon: Wallet, target: { page: "earnings" }, group: PORTAL_GROUP.MONEY },
  { key: "details", label: "Shop details", purpose: "Name, contact, tax", icon: IdCard, target: { page: "shop/details" }, group: PORTAL_GROUP.SETTINGS },
  // Home's setup list carries this id; when hidden it keeps a "Show" row there (onboarding U3).
  { key: "setup", label: "Setup list", purpose: "Your five first steps", icon: ListChecks, target: { page: "#setup-list" }, group: PORTAL_GROUP.SETTINGS },
  { key: "help", label: "Help", purpose: "Ask us anything", icon: LifeBuoy, target: { action: PORTAL_ACTION.CONTACT }, group: PORTAL_GROUP.SETTINGS },
  { key: "switch", label: "Switch shop", purpose: "Work on another shop", icon: Repeat, target: { href: "/org" }, group: PORTAL_GROUP.SETTINGS },
];

/** The href an entry opens for one shop, or null for an action. */
export function portalHref(entry: PortalNavEntry, orgId: string): string | null {
  const { target } = entry;
  if ("action" in target) return null;
  if ("href" in target) return target.href;
  const base = `/org/${orgId}`;
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
  const base = `/org/${orgId}`;
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
