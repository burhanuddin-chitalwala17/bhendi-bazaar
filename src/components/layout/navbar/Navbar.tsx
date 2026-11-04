"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BrandLogo } from "@/components/layout/brand-logo";
import { useAuthSheet } from "@/context/AuthSheetContext";
import { isFocusedFlow } from "@/components/layout/mobile-tab-bar";
import { NavbarSearch } from "./NavbarSearch";
import { ProfileMenu } from "./ProfileMenu";
import { NAVBAR_COPY } from "./navbar-copy";
import { ROUTES } from "@server/shared/routes";

export interface NavLink {
  href: string;
  label: string;
}

const ICON_LINK =
  "relative inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors duration-fast hover:bg-muted";

/** The store's top bar: logo, search and bag on a phone (the tab bar carries the rest); the full row from `lg`. */
export function Navbar({ links = [] }: { links?: NavLink[] }) {
  const pathname = usePathname();
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const { data: session } = useSession();
  const { open: openAuthSheet } = useAuthSheet();

  if (isFocusedFlow(pathname)) return <FocusedBar />;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-page items-center gap-2 px-3 sm:px-6 md:h-16 md:gap-4 lg:px-8">
        <Link href="/" prefetch={false} className="flex shrink-0 items-center">
          <BrandLogo size="sm" priority className="md:h-10" />
        </Link>

        {links.length > 0 && (
          <nav aria-label={NAVBAR_COPY.browse} className="hidden items-center gap-5 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cn(
                  "text-small font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground",
                  pathname === link.href && "text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <NavbarSearch />

        <div className="flex shrink-0 items-center gap-1">
          <Link href={ROUTES.wishlist} prefetch={false} aria-label={NAVBAR_COPY.saved} className={cn(ICON_LINK, "hidden md:inline-flex")}>
            <Icon name="saved" size="md" filled={pathname === ROUTES.wishlist} />
          </Link>
          <div className="hidden md:block">
            {session?.user ? (
              <ProfileMenu />
            ) : (
              <Button type="button" variant="ghost" shape="icon" size="lg" aria-label={NAVBAR_COPY.signIn} onClick={() => openAuthSheet()} className="rounded-full">
                <Icon name="account" size="md" />
              </Button>
            )}
          </div>
          {/* Always opens: an empty bag is a page with somewhere to go, not a dead control. */}
          <Link
            href={ROUTES.cart}
            prefetch={false}
            aria-label={cartCount > 0 ? `Bag, ${cartCount} items` : "Bag"}
            className={ICON_LINK}
          >
            <Icon name="bag" size="md" filled={pathname === ROUTES.cart} />
            {cartCount > 0 && (
              <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold leading-none text-primary-foreground">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Checkout's bar (design-system Q20): one way back to the bag, the title, and a word on safety. */
function FocusedBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-page items-center gap-2 px-3 sm:px-6 md:h-16 lg:px-8">
        <Link href={ROUTES.cart} prefetch={false} aria-label={NAVBAR_COPY.backToBag} className={ICON_LINK}>
          <Icon name="back" size="lg" />
        </Link>
        <Link href="/" prefetch={false} className="hidden shrink-0 md:flex">
          <BrandLogo size="sm" />
        </Link>
        <p className="flex-1 font-heading text-title font-semibold md:text-center">{NAVBAR_COPY.checkout}</p>
        <p className="inline-flex items-center gap-1 text-caption text-muted-foreground">
          <Icon name="secure" size="sm" tone="success" />
          {NAVBAR_COPY.secure}
        </p>
      </div>
    </header>
  );
}
