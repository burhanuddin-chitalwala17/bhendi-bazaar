"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, ShoppingBag, Store, Tag } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { dealsHref, landingHref, shopHref } from "../section-heading";
import { useCartCount } from "./themed-cart-count";
import { MoreMenu } from "./more-menu";

const TAB = "flex flex-1 flex-col items-center justify-center gap-0.5 font-label text-3xs transition-colors";
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
      aria-label="Shop"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-safe md:hidden"
    >
      <div className="mx-auto flex h-tabbar items-stretch">
        <Link href={home} prefetch={false} className={cn(TAB, tone(pathname === home))}>
          <Home className="size-5" />
          Home
        </Link>
        <Link href={shopHref(handle)} prefetch={false} className={cn(TAB, tone(pathname === shopHref(handle)))}>
          <Store className="size-5" />
          Shop
        </Link>
        <Link href={dealsHref(handle)} prefetch={false} className={cn(TAB, tone(false))}>
          <Tag className="size-5" />
          Deals
        </Link>
        <Link href="/cart" prefetch={false} className={cn(TAB, tone(pathname === "/cart"))}>
          <span className="relative">
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-4xs font-semibold leading-none text-primary-foreground">
                {count}
              </span>
            )}
          </span>
          Cart
        </Link>
        <MoreMenu>
          <Button variant="ghost" type="button" className={cn(TAB, "h-auto rounded-none", tone(false))}>
            <Menu className="size-5" />
            More
          </Button>
        </MoreMenu>
      </div>
    </nav>
  );
}
