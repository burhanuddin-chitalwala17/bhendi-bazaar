"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, LayoutGrid, Receipt, ShoppingBag, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategorySheet } from "@/components/layout/category-sheet";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";

// The phone's primary navigation (ADR-0016). It exists so the five things a shopper
// does are one thumb-reach apart instead of behind a header dropdown, and so the app
// bar above can shrink to a search field. Hidden from `md`, where the navbar carries
// the same five paths.

const TAB_CLASSES =
  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium transition-colors";

function tabTone(active: boolean) {
  return active ? "text-primary" : "text-muted-foreground";
}

export function MobileTabBar() {
  const pathname = usePathname();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { data: session } = useSession();

  const items = useCartStore((state) => state.items);
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const accountHref = session?.user ? "/profile" : "/signin";
  const isCategories = categoriesOpen || pathname.startsWith("/category");

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-safe backdrop-blur md:hidden"
      >
        <div className="mx-auto flex h-tabbar max-w-6xl items-stretch">
          <Link
            href="/"
            className={cn(TAB_CLASSES, tabTone(pathname === "/"))}
          >
            <Home className="size-5" />
            Home
          </Link>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setCategoriesOpen(true)}
            aria-expanded={categoriesOpen}
            className={cn(
              TAB_CLASSES,
              tabTone(isCategories),
              "h-auto rounded-none px-0 py-0"
            )}
          >
            <LayoutGrid className="size-5" />
            Categories
          </Button>

          <Link
            href="/cart"
            className={cn(TAB_CLASSES, tabTone(pathname === "/cart"))}
          >
            <span className="relative">
              <ShoppingBag className="size-5" />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.5625rem] font-semibold leading-none text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </span>
            Cart
          </Link>

          <Link
            href="/orders"
            className={cn(TAB_CLASSES, tabTone(pathname.startsWith("/order")))}
          >
            <Receipt className="size-5" />
            Orders
          </Link>

          <Link
            href={accountHref}
            className={cn(
              TAB_CLASSES,
              tabTone(pathname === "/profile" || pathname === "/signin")
            )}
          >
            <User className="size-5" />
            {session?.user ? "Account" : "Login"}
          </Link>
        </div>
      </nav>

      <CategorySheet open={categoriesOpen} onOpenChange={setCategoriesOpen} />
    </>
  );
}
