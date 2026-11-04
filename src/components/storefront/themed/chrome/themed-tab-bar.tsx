"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { dealsHref, landingHref, shopHref } from "../section-heading";
import { useCartCount } from "./themed-cart-count";
import { MoreMenu } from "./more-menu";
import { THEMED_COPY } from "../themed-copy";
import { ROUTES } from "@server/shared/routes";

const TAB = "flex flex-1 flex-col items-center justify-center gap-0.5 font-label text-2xs transition-colors";
const tone = (active: boolean) => (active ? "text-primary" : "text-muted-foreground");

/**
 * A themed shop's phone tab bar (Q6, ADR-0016): Home, Shop, Deals, Cart, More. Cart is the
 * marketplace's cart and More reaches the account and the whole marketplace, so a buyer is one
 * tap from all three on every themed page (A5).
 */
export function ThemedTabBar({ handle }: { handle: string }) {
  const pathname = usePathname();
  const count = useCartCount();
  const home = landingHref(handle);

  return (
    <nav
      aria-label={THEMED_COPY.tabs.region}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-safe md:hidden"
    >
      <div className="mx-auto flex h-tabbar items-stretch">
        <Link href={home} prefetch={false} className={cn(TAB, tone(pathname === home))}>
          <Icon name="home" size="md" />
          {THEMED_COPY.tabs.home}
        </Link>
        <Link href={shopHref(handle)} prefetch={false} className={cn(TAB, tone(pathname === shopHref(handle)))}>
          <Icon name="shop" size="md" />
          {THEMED_COPY.tabs.shop}
        </Link>
        <Link href={dealsHref(handle)} prefetch={false} className={cn(TAB, tone(false))}>
          <Icon name="offer" size="md" />
          {THEMED_COPY.tabs.deals}
        </Link>
        <Link href={ROUTES.cart} prefetch={false} className={cn(TAB, tone(pathname === ROUTES.cart))}>
          <span className="relative">
            <Icon name="bag" size="md" />
            {count > 0 && (
              <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold leading-none text-primary-foreground">
                {count}
              </span>
            )}
          </span>
          {THEMED_COPY.tabs.cart}
        </Link>
        <MoreMenu>
          <Button variant="ghost" type="button" className={cn(TAB, "h-auto rounded-none", tone(false))}>
            <Icon name="menu" size="md" />
            {THEMED_COPY.tabs.more}
          </Button>
        </MoreMenu>
      </div>
    </nav>
  );
}
