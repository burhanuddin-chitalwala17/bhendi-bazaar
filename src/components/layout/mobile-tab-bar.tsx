"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";
import { useAuthSheet } from "@/context/AuthSheetContext";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { isUnder, routeSection } from "@/lib/route-section";
import { ROUTES } from "@server/shared/routes";
import { TAB_BAR_COPY } from "./layout-copy";

/** The phone's primary navigation (ADR-0016, design-system Q21); hidden from `md`, where the navbar carries it. */
export const SHOPPER_TABS = [
  { key: "home", label: TAB_BAR_COPY.home, href: ROUTES.home, icon: "home" },
  { key: "shop", label: TAB_BAR_COPY.shop, href: ROUTES.shopAll, icon: "shop" },
  { key: "saved", label: TAB_BAR_COPY.saved, href: ROUTES.wishlist, icon: "saved" },
  { key: "bag", label: TAB_BAR_COPY.bag, href: ROUTES.cart, icon: "bag" },
  { key: "account", label: TAB_BAR_COPY.account, href: ROUTES.profile, icon: "account" },
] as const satisfies ReadonlyArray<{ key: string; label: string; href: string; icon: IconName }>;

type TabKey = (typeof SHOPPER_TABS)[number]["key"];

/** Browsing anywhere in the catalogue is the Shop tab, so a product page keeps it lit. */
const BROWSE = [
  ROUTES.shopAll,
  routeSection(ROUTES.category("")),
  routeSection(ROUTES.product("")),
  ROUTES.search,
  ROUTES.offers,
  ROUTES.stores,
  routeSection(ROUTES.bid("")),
];
const ACCOUNT = [ROUTES.profile, ROUTES.orders, routeSection(ROUTES.order(""))];

export function activeTab(pathname: string): TabKey | null {
  const under = (section: string) => isUnder(pathname, section);
  if (pathname === ROUTES.home) return "home";
  if (BROWSE.some(under)) return "shop";
  if (under(ROUTES.wishlist)) return "saved";
  if (under(ROUTES.cart)) return "bag";
  if (ACCOUNT.some(under)) return "account";
  return null;
}

/** Paths that hide the tab bar so nothing competes with paying. */
export const isFocusedFlow = (pathname: string) => isUnder(pathname, ROUTES.checkout);

const TAB = "flex min-h-10 flex-1 flex-col items-center justify-center gap-0.5 text-2xs font-medium transition-colors duration-fast";

export function MobileTabBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { open: openAuthSheet } = useAuthSheet();
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const current = activeTab(pathname);

  // Checkout is a focused flow with its own way back (design-system Q20).
  if (isFocusedFlow(pathname)) return null;

  return (
    <nav aria-label={TAB_BAR_COPY.nav} className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-safe backdrop-blur md:hidden">
      <div className="mx-auto flex h-tabbar max-w-page items-stretch">
        {SHOPPER_TABS.map((tab) => {
          const on = current === tab.key;
          const tone = on ? "text-primary" : "text-muted-foreground";
          const glyph = (
            <span className="relative">
              <Icon name={tab.icon} size="lg" filled={on} />
              {tab.key === "bag" && cartCount > 0 && (
                <span className="absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold leading-none text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </span>
          );

          // A guest's Account opens the sign-in sheet over this page rather than a page that would only ask.
          if (tab.key === "account" && !session?.user) {
            return (
              <Button key={tab.key} variant="ghost" type="button" onClick={() => openAuthSheet()} className={cn(TAB, "h-auto rounded-none", tone)}>
                {glyph}
                {tab.label}
              </Button>
            );
          }

          return (
            <Link
              key={tab.key}
              href={tab.href}
              prefetch={false}
              aria-current={on ? "page" : undefined}
              aria-label={tab.key === "bag" && cartCount > 0 ? TAB_BAR_COPY.bagCount(cartCount) : undefined}
              className={cn(TAB, tone)}
            >
              {glyph}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
