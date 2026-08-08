// SIMPLIFIED: components/layout/navbar.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useProfileContext } from "@/context/ProfileContext";
import { Button } from "@/components/ui/button";
import { NavbarSearch } from "./NavbarSearch";
import { CategoriesDropdown } from "./CategoriesDropdown";
import { ProfileMenu } from "./ProfileMenu";
import Image from "next/image";
import { APP_NAME, LOGO } from "@/lib/config";
import { useSession } from "next-auth/react";

export function Navbar() {
  const pathname = usePathname();
  const items = useCartStore((state) => state.items);
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const hasCartItems = cartCount > 0;

  const { data: session } = useSession();
  const user = session?.user;
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur z-10">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src={LOGO.FULL}
            alt={APP_NAME}
            width={160}
            height={160}
            priority
            className="h-16 w-auto"
          />
        </Link>

        {/* Middle: categories dropdown + search */}
        <div className="hidden flex-1 items-center gap-4 md:flex">
          <CategoriesDropdown />
          <NavbarSearch />
        </div>

        {/* Right side: auth + cart */}
        <div className="flex items-center gap-3">
          {user ? (
            <ProfileMenu />
          ) : (
            <Button
              asChild
              variant="outline"
              className="hidden rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] sm:inline-flex"
            >
              <Link href="/signin">Login</Link>
            </Button>
          )}

          {/* Orders link for guests */}
          {!user && (
            <Link
              href="/orders"
              className={cn(
                "hidden text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors sm:inline-block",
                pathname === "/orders" && "text-primary"
              )}
            >
              Orders
            </Link>
          )}

          {/* Cart button */}
          <Button
            asChild={true}
            variant={hasCartItems ? "default" : "outline"}
            disabled={!hasCartItems}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]",
              !hasCartItems &&
                "cursor-not-allowed border-border/80 bg-muted text-muted-foreground"
            )}
          >
            <Link
              href="/cart"
              onClick={(e) => {
                if (!hasCartItems) e.preventDefault();
              }}
            >
              <ShoppingBag className="mr-1 h-4 w-4" />
              Cart
              {cartCount > 0 && (
                <span className="ml-2 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-semibold leading-none text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}