"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Headset, Home, Receipt, ShoppingBag, User } from "lucide-react";

import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { useAuthSheet } from "@/context/AuthSheetContext";

// The phone's primary navigation (ADR-0016). It exists so the four things a shopper
// does are one thumb-reach apart instead of behind a header dropdown, and so the app
// bar above can shrink to a search field. Hidden from `md`, where the navbar carries
// the same paths. Categories left this bar when the lane row took over: browsing is
// something the page shows, not a destination.

const TAB_CLASSES =
  "flex flex-1 flex-col items-center justify-center gap-0.5 text-3xs font-medium transition-colors";

function tabTone(active: boolean) {
  return active ? "text-primary" : "text-muted-foreground";
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const items = useCartStore((state) => state.items);
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const { open: openAuthSheet } = useAuthSheet();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-safe backdrop-blur md:hidden"
    >
      <div className="mx-auto flex h-tabbar max-w-6xl items-stretch">
        {/* Contact first and Home centred; Contact opens a sheet, so it is never "active". */}
        <ContactLauncher className={cn(TAB_CLASSES, tabTone(false))}>
          <Headset className="size-5" />
          Contact
        </ContactLauncher>

        <Link
          prefetch={false}
          href="/cart"
          className={cn(TAB_CLASSES, tabTone(pathname === "/cart"))}
        >
          <span className="relative">
            <ShoppingBag className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-4xs font-semibold leading-none text-primary-foreground">
                {cartCount}
              </span>
            )}
          </span>
          Cart
        </Link>

        <Link href="/" className={cn(TAB_CLASSES, tabTone(pathname === "/"))} prefetch={false}>
          <Home className="size-5" />
          Home
        </Link>

        <Link
          prefetch={false}
          href="/orders"
          className={cn(TAB_CLASSES, tabTone(pathname.startsWith("/order")))}
        >
          <Receipt className="size-5" />
          Orders
        </Link>

        {session?.user ? (
          <Link
            prefetch={false}
            href="/profile"
            className={cn(TAB_CLASSES, tabTone(pathname === "/profile"))}
          >
            <User className="size-5" />
            Account
          </Link>
        ) : (
          // Opens the sheet over this page, so like Contact it is never "active".
          <button
            type="button"
            onClick={() => openAuthSheet()}
            className={cn(TAB_CLASSES, tabTone(pathname === "/signin"))}
          >
            <User className="size-5" />
            Login
          </button>
        )}
      </div>
    </nav>
  );
}
